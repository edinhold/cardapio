import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || "restaurant.db";
const dbDir = path.dirname(dbPath);

// Ensure database directory exists
if (dbDir !== "." && !fs.existsSync(dbDir)) {
  console.log(`Creating database directory: ${dbDir}`);
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (err) {
    console.error(`Error creating database directory ${dbDir}:`, err);
  }
}

console.log(`Server initializing at ${new Date().toISOString()}`);
console.log(`Database path: ${path.resolve(dbPath)}`);

const db = new Database(dbPath);

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
    icon TEXT,
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
    status TEXT DEFAULT 'pending', -- 'pending', 'preparing', 'ready', 'delivered', 'paid', 'canceled'
    type TEXT DEFAULT 'table', -- 'table', 'counter', 'delivery'
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

// Log current state
const itemCount = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
const orderCount = db.prepare("SELECT COUNT(*) as count FROM orders").get() as { count: number };
console.log(`Database state: ${itemCount.count} items, ${orderCount.count} orders found.`);

// Migration: Ensure observation column exists in order_items
try {
  db.prepare("ALTER TABLE order_items ADD COLUMN observation TEXT").run();
} catch (e) {
  // Column probably already exists
}

// Migration: Ensure type column exists in orders
try {
  db.prepare("ALTER TABLE orders ADD COLUMN type TEXT DEFAULT 'table'").run();
} catch (e) {
  // Column probably already exists
}

// Migration: Ensure icon column exists in items
try {
  db.prepare("ALTER TABLE items ADD COLUMN icon TEXT").run();
} catch (e) {
  // Column probably already exists
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // WebSocket broadcast helper
  const broadcast = (data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // API Routes
  
  app.get("/api/health", (req, res) => {
    const itemCount = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
    res.json({
      status: "ok",
      uptime: process.uptime(),
      database: {
        path: dbPath,
        items: itemCount.count
      },
      environment: process.env.NODE_ENV || "development"
    });
  });

  // Items
  app.get("/api/items", (req, res) => {
    const items = db.prepare("SELECT * FROM items").all();
    res.json(items);
  });

  app.post("/api/items", (req, res) => {
    const { name, description, price, category, is_dish_of_day, image_url, icon, observation_info } = req.body;
    const result = db.prepare(
      "INSERT INTO items (name, description, price, category, is_dish_of_day, image_url, icon, observation_info) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(name, description, price, category, is_dish_of_day ? 1 : 0, image_url, icon, observation_info);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/items/:id", (req, res) => {
    db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.patch("/api/items/:id", (req, res) => {
    const { name, description, price, category, is_dish_of_day, image_url, icon, observation_info } = req.body;
    db.prepare(
      "UPDATE items SET name = ?, description = ?, price = ?, category = ?, is_dish_of_day = ?, image_url = ?, icon = ?, observation_info = ? WHERE id = ?"
    ).run(name, description, price, category, is_dish_of_day ? 1 : 0, image_url, icon, observation_info, req.params.id);
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

  app.delete("/api/employees/:id", (req, res) => {
    db.prepare("DELETE FROM employees WHERE id = ?").run(req.params.id);
    res.json({ success: true });
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

  app.patch("/api/tables/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE tables SET status = ? WHERE id = ?").run(status, req.params.id);
    broadcast({ type: 'TABLE_UPDATED', id: req.params.id, status });
    res.json({ success: true });
  });

  app.delete("/api/tables/:id", (req, res) => {
    const orders = db.prepare("SELECT * FROM orders WHERE table_id = ? AND status != 'paid'").all(req.params.id);
    if (orders.length > 0) {
      return res.status(400).json({ error: "Cannot delete table with active orders" });
    }
    db.prepare("DELETE FROM tables WHERE id = ?").run(req.params.id);
    broadcast({ type: 'TABLE_UPDATED', id: req.params.id, status: 'deleted' });
    res.json({ success: true });
  });

  app.post("/api/tables/:id/close", (req, res) => {
    const tableId = req.params.id;
    const transaction = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'paid' WHERE table_id = ? AND status NOT IN ('paid', 'canceled')").run(tableId);
      db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(tableId);
    });
    transaction();
    broadcast({ type: 'TABLE_UPDATED', id: tableId, status: 'available' });
    res.json({ success: true });
  });

  app.post("/api/counter/close", (req, res) => {
    const transaction = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'paid' WHERE (type = 'counter' OR (type = 'table' AND table_id IS NULL)) AND status NOT IN ('paid', 'canceled')").run();
    });
    transaction();
    broadcast({ type: 'ORDER_UPDATED', id: 'counter', status: 'paid' });
    res.json({ success: true });
  });

  app.get("/api/counter/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, 'Balcão' as table_number 
      FROM orders o 
      WHERE (o.type = 'counter' OR (o.type = 'table' AND o.table_id IS NULL)) AND o.status NOT IN ('paid', 'canceled')
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

  app.get("/api/tables/:id/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE o.table_id = ? AND o.status NOT IN ('paid', 'canceled')
      ORDER BY o.created_at DESC
    `).all(req.params.id);
    
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

  // Orders
  app.get("/api/orders", (req, res) => {
    const { status } = req.query;
    let query = `
      SELECT o.*, t.number as table_number 
      FROM orders o 
      LEFT JOIN tables t ON o.table_id = t.id
    `;
    const params: any[] = [];

    if (status === 'active') {
      query += " WHERE o.status NOT IN ('paid', 'delivered', 'canceled')";
    } else if (status) {
      query += " WHERE o.status = ?";
      params.push(status);
    }

    query += " ORDER BY o.created_at DESC";
    
    const orders = db.prepare(query).all(...params);
    
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
    const { table_id, items, total_price, type = 'table' } = req.body;
    
    const transaction = db.transaction(() => {
      const orderResult = db.prepare(
        "INSERT INTO orders (table_id, total_price, status, type) VALUES (?, ?, 'pending', ?)"
      ).run(table_id, total_price, type);
      
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

      if (table_id) {
        db.prepare("UPDATE tables SET status = 'occupied' WHERE id = ?").run(table_id);
      }
      
      return orderId;
    });

    const orderId = transaction();
    console.log(`Novo pedido criado: ID ${orderId}, Mesa ${table_id || 'Balcão'}`);
    if (table_id) {
      broadcast({ type: 'TABLE_UPDATED', id: table_id, status: 'occupied' });
    }
    const newOrder = { id: orderId, table_id, total_price, status: 'pending', items };
    broadcast({ type: 'NEW_ORDER', order: newOrder });
    res.json({ id: orderId });
  });

  app.patch("/api/orders/:id", (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;
    
    const transaction = db.transaction(() => {
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, orderId);
      
      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
      if (order && order.table_id && (status === 'paid' || status === 'canceled')) {
        // Check if there are other active orders for this table
        const otherOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('paid', 'canceled')").get(order.table_id) as { count: number };
        if (otherOrders.count === 0) {
          db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);
          broadcast({ type: 'TABLE_UPDATED', id: order.table_id, status: 'available' });
        }
      }
    });
    
    transaction();
    broadcast({ type: 'ORDER_UPDATED', id: orderId, status });
    res.json({ success: true });
  });

  app.delete("/api/orders/:id", (req, res) => {
    const orderId = req.params.id;
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
    
    if (!order) return res.status(404).json({ error: "Pedido não encontrado" });

    const transaction = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'canceled' WHERE id = ?").run(orderId);
      if (order.table_id) {
        // Check if there are other active orders for this table
        const otherOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE table_id = ? AND status NOT IN ('paid', 'canceled')").get(order.table_id) as { count: number };
        if (otherOrders.count === 0) {
          db.prepare("UPDATE tables SET status = 'available' WHERE id = ?").run(order.table_id);
          broadcast({ type: 'TABLE_UPDATED', id: order.table_id, status: 'available' });
        }
      }
    });
    transaction();
    broadcast({ type: 'ORDER_UPDATED', id: orderId, status: 'canceled' });
    res.json({ success: true });
  });

  app.get("/api/delivery/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, 'Delivery' as table_number 
      FROM orders o 
      WHERE o.type = 'delivery' AND o.status != 'paid' AND o.status != 'canceled'
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

  app.post("/api/delivery/close", (req, res) => {
    const transaction = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'paid' WHERE type = 'delivery' AND status != 'paid' AND status != 'canceled'").run();
    });
    transaction();
    broadcast({ type: 'ORDER_UPDATED', id: 'delivery', status: 'paid' });
    res.json({ success: true });
  });

  // CRM / Sales Stats
  app.get("/api/reports", (req, res) => {
    const { period } = req.query; // 'day', 'week', 'month'
    let dateFilter = "date('now')";
    if (period === 'week') dateFilter = "date('now', '-7 days')";
    if (period === 'month') dateFilter = "date('now', '-30 days')";

    const itemsSold = db.prepare(`
      SELECT i.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.price_at_time) as total
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      WHERE date(o.created_at) >= ${dateFilter}
      AND o.status = 'paid'
      GROUP BY i.id
      ORDER BY quantity DESC
    `).all();

    const totalRevenue = db.prepare(`
      SELECT SUM(total_price) as total
      FROM orders
      WHERE date(created_at) >= ${dateFilter}
      AND status = 'paid'
    `).get() as { total: number | null };

    res.json({ itemsSold, totalRevenue: totalRevenue?.total || 0 });
  });

  app.get("/api/stats", (req, res) => {
    const daily = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) = date('now') AND status = 'paid'").get() as { total: number | null } | undefined;
    const weekly = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) >= date('now', '-7 days') AND status = 'paid'").get() as { total: number | null } | undefined;
    const monthly = db.prepare("SELECT SUM(total_price) as total FROM orders WHERE date(created_at) >= date('now', '-30 days') AND status = 'paid'").get() as { total: number | null } | undefined;
    
    const salesOverTime = db.prepare(`
      SELECT date(created_at) as date, SUM(total_price) as total 
      FROM orders 
      WHERE date(created_at) >= date('now', '-30 days') AND status = 'paid'
      GROUP BY date(created_at)
      ORDER BY date(created_at) ASC
    `).all();

    res.json({
      daily: daily?.total || 0,
      weekly: weekly?.total || 0,
      monthly: monthly?.total || 0,
      salesOverTime
    });
  });

  app.post("/api/system/reset", (req, res) => {
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM order_item_addons").run();
      db.prepare("DELETE FROM order_items").run();
      db.prepare("DELETE FROM orders").run();
      db.prepare("UPDATE tables SET status = 'available'").run();
    });
    transaction();
    broadcast({ type: 'SYSTEM_RESET' });
    res.json({ success: true });
  });

  app.post("/api/system/clear-menu", (req, res) => {
    const transaction = db.transaction(() => {
      // We must clear orders first because of foreign keys
      db.prepare("DELETE FROM order_item_addons").run();
      db.prepare("DELETE FROM order_items").run();
      db.prepare("DELETE FROM orders").run();
      db.prepare("DELETE FROM addons").run();
      db.prepare("DELETE FROM items").run();
      db.prepare("UPDATE tables SET status = 'available'").run();
    });
    transaction();
    broadcast({ type: 'MENU_CLEARED' });
    res.json({ success: true });
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  
  if (!isProd) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite not found, falling back to static serving if dist exists");
      app.use(express.static(path.join(process.cwd(), "dist")));
    }
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
