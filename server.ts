import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";

const db = new Database("restaurant.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    category TEXT NOT NULL, -- 'dish', 'drink'
    is_dish_of_day INTEGER DEFAULT 0,
    image_url TEXT,
    observation_info TEXT
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'available'
  );

  CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_id INTEGER,
    total_price REAL NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'delivered', 'paid'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(table_id) REFERENCES tables(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER,
    item_id INTEGER,
    quantity INTEGER NOT NULL,
    price_at_time REAL NOT NULL,
    observation TEXT,
    FOREIGN KEY(order_id) REFERENCES orders(id),
    FOREIGN KEY(item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS order_item_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id INTEGER,
    addon_id INTEGER,
    price_at_time REAL NOT NULL,
    FOREIGN KEY(order_item_id) REFERENCES order_items(id),
    FOREIGN KEY(addon_id) REFERENCES addons(id)
  );
`);

// Migration: Ensure observation column exists in order_items
try {
  db.prepare("ALTER TABLE order_items ADD COLUMN observation TEXT").run();
} catch (e) {
  // Column probably already exists
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json());

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  
  // Items
  app.get("/api/items", (req, res) => {
    const items = db.prepare("SELECT * FROM items").all();
    res.json(items);
  });

  app.post("/api/items", (req, res) => {
    const { name, description, price, category, is_dish_of_day, image_url } = req.body;
    const result = db.prepare(
      "INSERT INTO items (name, description, price, category, is_dish_of_day, image_url) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(name, description, price, category, is_dish_of_day ? 1 : 0, image_url);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/items/:id", (req, res) => {
    db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/items/:id", (req, res) => {
    const { name, description, price, category, is_dish_of_day, image_url, observation_info } = req.body;
    db.prepare(
      "UPDATE items SET name = ?, description = ?, price = ?, category = ?, is_dish_of_day = ?, image_url = ?, observation_info = ? WHERE id = ?"
    ).run(name, description, price, category, is_dish_of_day ? 1 : 0, image_url, observation_info, req.params.id);
    res.json({ success: true });
  });

  // Addons
  app.get("/api/addons", (req, res) => {
    const addons = db.prepare("SELECT * FROM addons").all();
    res.json(addons);
  });

  app.post("/api/addons", (req, res) => {
    const { name, price } = req.body;
    const result = db.prepare("INSERT INTO addons (name, price) VALUES (?, ?)").run(name, price);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/addons/:id", (req, res) => {
    db.prepare("DELETE FROM addons WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/addons/:id", (req, res) => {
    const { name, price } = req.body;
    db.prepare("UPDATE addons SET name = ?, price = ? WHERE id = ?").run(name, price, req.params.id);
    res.json({ success: true });
  });

  // Employees
  app.get("/api/employees", (req, res) => {
    const employees = db.prepare("SELECT * FROM employees").all();
    res.json(employees);
  });

  app.post("/api/employees", (req, res) => {
    const { name, role } = req.body;
    const result = db.prepare("INSERT INTO employees (name, role) VALUES (?, ?)").run(name, role);
    res.json({ id: result.lastInsertRowid });
  });

  // Tables
  app.get("/api/tables", (req, res) => {
    const tables = db.prepare("SELECT * FROM tables").all();
    res.json(tables);
  });

  app.post("/api/tables", (req, res) => {
    const { number } = req.body;
    try {
      const result = db.prepare("INSERT INTO tables (number) VALUES (?)").run(number);
      res.json({ id: result.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Table already exists" });
    }
  });

  // Orders
  app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC
    `).all();
    
    const ordersWithItems = orders.map((order: any) => {
      const items = db.prepare(`
        SELECT oi.*, i.name 
        FROM order_items oi 
        JOIN items i ON oi.item_id = i.id 
        WHERE oi.order_id = ?
      `).all(order.id);

      const itemsWithAddons = items.map((item: any) => {
        const addons = db.prepare(`
          SELECT oia.*, a.name 
          FROM order_item_addons oia 
          JOIN addons a ON oia.addon_id = a.id 
          WHERE oia.order_item_id = ?
        `).all(item.id);
        return { ...item, addons };
      });

      return { ...order, items: itemsWithAddons };
    });
    
    res.json(ordersWithItems);
  });

  app.post("/api/orders", (req, res) => {
    const { table_id, items, total_price } = req.body;
    
    const transaction = db.transaction(() => {
      const orderResult = db.prepare(
        "INSERT INTO orders (table_id, total_price, status) VALUES (?, ?, 'pending')"
      ).run(table_id, total_price);
      
      const orderId = orderResult.lastInsertRowid;
      
      const insertItem = db.prepare(
        "INSERT INTO order_items (order_id, item_id, quantity, price_at_time, observation) VALUES (?, ?, ?, ?, ?)"
      );

      const insertAddon = db.prepare(
        "INSERT INTO order_item_addons (order_item_id, addon_id, price_at_time) VALUES (?, ?, ?)"
      );
      
      for (const item of items) {
        const itemResult = insertItem.run(orderId, item.id, item.quantity, item.price, item.observation);
        const orderItemId = itemResult.lastInsertRowid;

        if (item.selectedAddons) {
          for (const addon of item.selectedAddons) {
            insertAddon.run(orderItemId, addon.id, addon.price);
          }
        }
      }
      
      return orderId;
    });

    const orderId = transaction();
    const newOrder = { id: orderId, table_id, total_price, status: 'pending', items };
    broadcast({ type: 'NEW_ORDER', order: newOrder });
    res.json({ id: orderId });
  });

  app.patch("/api/orders/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
    broadcast({ type: 'ORDER_UPDATED', id: req.params.id, status });
    res.json({ success: true });
  });

  // CRM / Sales Stats
  app.get("/api/stats", (req, res) => {
    const daily = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) = date('now')").get();
    const weekly = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) >= date('now', '-7 days')").get();
    const monthly = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) >= date('now', '-30 days')").get();
    
    const salesOverTime = db.prepare(`
      SELECT date(created_at) as date, SUM(total_price) as total 
      FROM orders 
      WHERE date(created_at) >= date('now', '-30 days')
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all();

    res.json({
      daily: daily.total || 0,
      weekly: weekly.total || 0,
      monthly: monthly.total || 0,
      salesOverTime
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  const PORT = 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
