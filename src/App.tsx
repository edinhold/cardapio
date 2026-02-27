import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Users, 
  Table as TableIcon, 
  TrendingUp, 
  Plus, 
  Trash2,
  Beer,
  ChefHat,
  Printer,
  CheckCircle2,
  Clock,
  X,
  PlusCircle,
  Bell,
  Search
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Item, Employee, Table, Order, SalesStats, Addon } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
      active 
        ? "bg-stone-900 text-white shadow-lg shadow-stone-200" 
        : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
    )}
  >
    <Icon size={20} />
    <span className="font-medium">{label}</span>
  </button>
);

const StatCard = ({ label, value, trend }: { label: string, value: string, trend?: string }) => (
  <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
    <p className="text-stone-500 text-sm font-medium uppercase tracking-wider mb-1">{label}</p>
    <h3 className="text-3xl font-bold text-stone-900">{value}</h3>
    {trend && <p className="text-emerald-600 text-xs font-medium mt-2">↑ {trend}</p>}
  </div>
);

// --- Views ---

const AdminDashboard = () => {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(setStats)
      .catch(err => console.error('Stats fetch error:', err));
    
    const fetchOrders = () => {
      fetch('/api/orders')
        .then(res => res.json())
        .then(data => setRecentOrders(data.slice(0, 5)))
        .catch(err => console.error('Orders fetch error:', err));
    };

    fetchOrders();

    // WebSocket for instant updates
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_ORDER' || data.type === 'ORDER_UPDATED') {
            fetchOrders();
            // Also refresh stats on new order
            if (data.type === 'NEW_ORDER') {
              fetch('/api/stats').then(res => res.json()).then(setStats);
            }
          }
        } catch (e) { console.error('WS error:', e); }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  if (!stats) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Vendas Hoje" value={`R$ ${stats.daily.toFixed(2)}`} />
        <StatCard label="Vendas Semana" value={`R$ ${stats.weekly.toFixed(2)}`} />
        <StatCard label="Vendas Mês" value={`R$ ${stats.monthly.toFixed(2)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm h-[400px]">
          <h3 className="text-xl font-bold mb-6 font-serif italic">Desempenho de Vendas</h3>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.salesOverTime}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1c1917" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#1c1917" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f4" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716c', fontSize: 12}} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Area type="monotone" dataKey="total" stroke="#1c1917" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm overflow-y-auto">
          <h3 className="text-xl font-bold mb-6 font-serif italic">Pedidos Recentes</h3>
          <div className="space-y-4">
            {recentOrders.map(order => (
              <div key={order.id} className="flex justify-between items-center p-4 rounded-2xl bg-stone-50 border border-stone-100">
                <div>
                  <p className="font-bold text-stone-900">#{order.id} - {order.table_number ? `Mesa ${order.table_number}` : 'Balcão'}</p>
                  <p className="text-xs text-stone-400">{new Date(order.created_at).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-900">R$ {order.total_price.toFixed(2)}</p>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                    order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                    order.status === 'preparing' ? "bg-blue-100 text-blue-700" :
                    "bg-emerald-100 text-emerald-700"
                  )}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MenuManagement = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'dish',
    is_dish_of_day: false,
    image_url: '',
    observation_info: ''
  });

  const fetchItems = () => 
    fetch('/api/items')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch items');
        return res.json();
      })
      .then(setItems)
      .catch(err => console.error('Items fetch error:', err));
  useEffect(() => { fetchItems(); }, []);

  const handleOpenForm = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price.toString(),
        category: item.category,
        is_dish_of_day: item.is_dish_of_day === 1,
        image_url: item.image_url || '',
        observation_info: item.observation_info || ''
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        category: 'dish',
        is_dish_of_day: false,
        image_url: '',
        observation_info: ''
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem && !confirm('Deseja salvar as alterações neste item?')) {
      return;
    }

    const url = editingItem ? `/api/items/${editingItem.id}` : '/api/items';
    const method = editingItem ? 'PATCH' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, price: parseFloat(formData.price) })
    });
    
    setFormData({ name: '', description: '', price: '', category: 'dish', is_dish_of_day: false, image_url: '', observation_info: '' });
    setEditingItem(null);
    setShowForm(false);
    fetchItems();
  };

  const deleteItem = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja remover este item?')) {
      await fetch(`/api/items/${id}`, { method: 'DELETE' });
      fetchItems();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-serif italic">Gestão de Cardápio</h2>
        <button 
          onClick={() => handleOpenForm()}
          className="bg-stone-900 text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-stone-800 transition-colors"
        >
          <Plus size={18} /> Novo Item
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div 
            key={item.id} 
            onClick={() => handleOpenForm(item)}
            className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm group cursor-pointer hover:border-stone-300 transition-all"
          >
            <div className="aspect-video bg-stone-100 rounded-xl mb-4 overflow-hidden relative">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-400">
                  {item.category === 'dish' ? <UtensilsCrossed size={32} /> : <Beer size={32} />}
                </div>
              )}
              {item.is_dish_of_day === 1 && (
                <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold uppercase px-2 py-1 rounded-full">Prato do Dia</span>
              )}
            </div>
            <div className="flex justify-between items-start mb-2">
              <div>
                <h4 className="font-bold text-lg">{item.name}</h4>
                <p className="text-stone-500 text-sm line-clamp-1">{item.description}</p>
              </div>
              <span className="font-bold text-stone-900">R$ {item.price.toFixed(2)}</span>
            </div>
            <button 
              onClick={(e) => deleteItem(e, item.id)}
              className="mt-4 w-full flex items-center justify-center gap-2 text-red-500 text-sm font-medium py-2 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} /> Remover
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">{editingItem ? 'Editar Item' : 'Adicionar Item'}</h3>
                <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-900"><X /></button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input 
                  placeholder="Nome do Item" 
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  required
                />
                <textarea 
                  placeholder="Descrição" 
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
                <div className="grid grid-cols-2 gap-4">
                  <input 
                    type="number" step="0.01" placeholder="Preço" 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: e.target.value})}
                    required
                  />
                  <select 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value as any})}
                  >
                    <option value="dish">Prato</option>
                    <option value="drink">Bebida</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-stone-400">URL da Imagem (JPG, PNG)</label>
                  <input 
                    placeholder="Cole o link da imagem aqui..." 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    value={formData.image_url}
                    onChange={e => setFormData({...formData, image_url: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-stone-400">Info de Observação (ex: "Sem cebola?")</label>
                  <input 
                    placeholder="Instrução para o cliente (opcional)" 
                    className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
                    value={formData.observation_info}
                    onChange={e => setFormData({...formData, observation_info: e.target.value})}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.is_dish_of_day}
                    onChange={e => setFormData({...formData, is_dish_of_day: e.target.checked})}
                    className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                  />
                  <span className="text-sm font-medium text-stone-700">Prato do Dia</span>
                </label>
                <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-colors">
                  {editingItem ? 'Salvar Alterações' : 'Salvar Item'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmployeeManagement = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const fetchEmployees = () => 
    fetch('/api/employees')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch employees');
        return res.json();
      })
      .then(setEmployees)
      .catch(err => console.error('Employees fetch error:', err));
  useEffect(() => { fetchEmployees(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role })
    });
    setName(''); setRole('');
    fetchEmployees();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-stone-100 shadow-sm h-fit">
        <h3 className="text-xl font-bold mb-6">Cadastrar Funcionário</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            placeholder="Nome Completo" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <input 
            placeholder="Cargo (ex: Garçom, Cozinheiro)" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
            value={role} onChange={e => setRole(e.target.value)} required
          />
          <button className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">Adicionar</button>
        </form>
      </div>
      <div className="lg:col-span-2 space-y-4">
        {employees.map(emp => (
          <div key={emp.id} className="bg-white p-6 rounded-2xl border border-stone-100 flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
              <Users size={24} />
            </div>
            <div>
              <h4 className="font-bold">{emp.name}</h4>
              <p className="text-stone-500 text-sm">{emp.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TableManagement = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [number, setNumber] = useState('');

  const fetchTables = () => 
    fetch('/api/tables')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch tables');
        return res.json();
      })
      .then(setTables)
      .catch(err => console.error('Tables fetch error:', err));
  useEffect(() => { fetchTables(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: parseInt(number) })
    });
    setNumber('');
    fetchTables();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-stone-100 shadow-sm h-fit">
        <h3 className="text-xl font-bold mb-6">Cadastrar Mesa</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            type="number" placeholder="Número da Mesa" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
            value={number} onChange={e => setNumber(e.target.value)} required
          />
          <button className="w-full bg-stone-900 text-white py-4 rounded-xl font-bold">Adicionar</button>
        </form>
      </div>
      <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
        {tables.map(table => (
          <div key={table.id} className="bg-white p-6 rounded-2xl border border-stone-100 flex flex-col items-center gap-2">
            <TableIcon size={32} className="text-stone-300" />
            <span className="font-bold text-xl">Mesa {table.number}</span>
            <span className={cn(
              "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
              table.status === 'available' ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
            )}>
              {table.status === 'available' ? 'Disponível' : 'Ocupada'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main App Components ---

const AddonManagement = () => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);

  const fetchAddons = () => 
    fetch('/api/addons')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch addons');
        return res.json();
      })
      .then(setAddons)
      .catch(err => console.error('Addons fetch error:', err));
  
  useEffect(() => { fetchAddons(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingAddon ? `/api/addons/${editingAddon.id}` : '/api/addons';
    const method = editingAddon ? 'PATCH' : 'POST';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price: parseFloat(price) })
    });
    
    cancelEdit();
    fetchAddons();
  };

  const handleEdit = (addon: Addon) => {
    setEditingAddon(addon);
    setName(addon.name);
    setPrice(addon.price.toString());
  };

  const cancelEdit = () => {
    setEditingAddon(null);
    setName('');
    setPrice('');
  };

  const deleteAddon = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm('Remover este adicional?')) {
      await fetch(`/api/addons/${id}`, { method: 'DELETE' });
      fetchAddons();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-stone-100 shadow-sm h-fit">
        <h3 className="text-xl font-bold mb-6">{editingAddon ? 'Editar Adicional' : 'Cadastrar Adicional'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input 
            placeholder="Nome do Adicional (ex: Bacon, Queijo Extra)" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
            value={name} onChange={e => setName(e.target.value)} required
          />
          <input 
            type="number" step="0.01" placeholder="Preço" 
            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900"
            value={price} onChange={e => setPrice(e.target.value)} required
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-stone-900 text-white py-4 rounded-xl font-bold hover:bg-stone-800 transition-colors">
              {editingAddon ? 'Salvar' : 'Adicionar'}
            </button>
            {editingAddon && (
              <button 
                type="button" 
                onClick={cancelEdit}
                className="px-6 py-4 rounded-xl border border-stone-200 font-bold hover:bg-stone-50 transition-colors"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        {addons.map(addon => (
          <div 
            key={addon.id} 
            onClick={() => handleEdit(addon)}
            className={cn(
              "bg-white p-6 rounded-2xl border transition-all flex items-center justify-between cursor-pointer group",
              editingAddon?.id === addon.id ? "border-stone-900 ring-1 ring-stone-900" : "border-stone-100 hover:border-stone-300"
            )}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                editingAddon?.id === addon.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-400 group-hover:bg-stone-200"
              )}>
                <PlusCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold">{addon.name}</h4>
                <p className="text-stone-500 text-sm">R$ {addon.price.toFixed(2)}</p>
              </div>
            </div>
            <button 
              onClick={(e) => deleteAddon(e, addon.id)} 
              className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminPanel = ({ onViewChange }: { onViewChange: (view: 'customer' | 'admin' | 'kitchen') => void }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'employees' | 'tables' | 'addons'>('dashboard');

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className="w-64 bg-white border-r border-stone-100 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-3 px-2">
          <div className="bg-stone-900 p-2 rounded-lg text-white">
            <TrendingUp size={20} />
          </div>
          <h1 className="font-bold text-xl tracking-tight">SaborAdmin</h1>
        </div>
        
        <nav className="flex flex-col gap-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem icon={UtensilsCrossed} label="Cardápio" active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
          <SidebarItem icon={PlusCircle} label="Adicionais" active={activeTab === 'addons'} onClick={() => setActiveTab('addons')} />
          <SidebarItem icon={Users} label="Funcionários" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} />
          <SidebarItem icon={TableIcon} label="Mesas" active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} />
          
          <div className="my-4 border-t border-stone-100 pt-4">
            <SidebarItem icon={ChefHat} label="Painel Cozinha" active={false} onClick={() => onViewChange('kitchen')} />
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-stone-900">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'menu' && 'Gerenciar Itens'}
              {activeTab === 'addons' && 'Adicionais'}
              {activeTab === 'employees' && 'Equipe'}
              {activeTab === 'tables' && 'Salão'}
            </h2>
            <p className="text-stone-500">Bem-vindo ao painel de controle.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold">Admin User</p>
              <p className="text-xs text-stone-400">Gerente</p>
            </div>
            <div className="w-10 h-10 bg-stone-200 rounded-full" />
          </div>
        </header>

        {activeTab === 'dashboard' && <AdminDashboard />}
        {activeTab === 'menu' && <MenuManagement />}
        {activeTab === 'addons' && <AddonManagement />}
        {activeTab === 'employees' && <EmployeeManagement />}
        {activeTab === 'tables' && <TableManagement />}
      </main>
    </div>
  );
};

const KitchenPanel = ({ onViewChange }: { onViewChange: (view: 'customer' | 'admin' | 'kitchen') => void }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
  }, [audioEnabled]);

  const fetchOrders = () => 
    fetch('/api/orders')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(setOrders)
      .catch(err => console.error('Orders fetch error:', err));

  useEffect(() => {
    fetchOrders();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws: WebSocket;
    let reconnectTimer: any;

    const connect = () => {
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      
      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_ORDER' || data.type === 'ORDER_UPDATED') {
            fetchOrders();
            
            if (data.type === 'NEW_ORDER') {
              setShowNotification(true);
              if (audioEnabledRef.current && audioRef.current) {
                audioRef.current.play().catch(e => console.log('Audio play blocked:', e));
              }
              setTimeout(() => setShowNotification(false), 8000); // Increased notification time
            }
          }
        } catch (e) {
          console.error('WS message error:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        console.log('WS connection closed, reconnecting...');
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    };

    connect();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimer);
    };
  }, []);

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    fetchOrders();
  };

  const handlePrint = (order: Order) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head><title>Pedido #${order.id}</title></head>
        <body style="font-family: monospace; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h2 style="margin: 0;">PEDIDO #${order.id}</h2>
            <span>${new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p style="font-weight: bold; font-size: 1.2em;">${order.table_number ? `MESA: ${order.table_number}` : 'RETIRADA NO BALCÃO'}</p>
          <hr/>
          ${order.items.map(item => `
            <div style="margin-bottom: 10px;">
              <p style="margin: 0; font-weight: bold;">${item.quantity}x ${item.name}</p>
              ${item.observation ? `<p style="margin: 0; font-size: 0.8em; color: #666;">Obs: ${item.observation}</p>` : ''}
              ${item.addons && item.addons.length > 0 ? `<p style="margin: 0; font-size: 0.8em; color: #22c55e;">+ ${item.addons.map(a => a.name).join(', ')}</p>` : ''}
            </div>
          `).join('')}
          <hr/>
          <p>TOTAL: R$ ${order.total_price.toFixed(2)}</p>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const activeOrders = orders.filter(o => o.status !== 'paid' && o.status !== 'delivered');

  return (
    <div className="min-h-screen bg-stone-900 text-white p-8 relative overflow-hidden">
      <audio 
        ref={audioRef} 
        src="https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" 
        preload="auto"
      />

      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-400"
          >
            <div className="bg-white/20 p-2 rounded-full animate-pulse">
              <Bell size={24} />
            </div>
            <div>
              <p className="font-bold text-lg">Novo Pedido Recebido!</p>
              <p className="text-xs text-emerald-100">Verifique a lista de pedidos ativos.</p>
            </div>
            <button onClick={() => setShowNotification(false)} className="ml-4 hover:bg-white/10 p-1 rounded-lg">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-6">
          <button 
            onClick={() => onViewChange('admin')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-700 text-stone-400 hover:text-white hover:border-stone-500 transition-all"
          >
            <LayoutDashboard size={18} />
            <span className="text-sm font-bold">Painel Admin</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="bg-emerald-500 p-3 rounded-2xl">
              <ChefHat size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Painel da Cozinha</h1>
              <div className="flex items-center gap-2">
                <p className="text-stone-400">Gerenciamento de pedidos em tempo real</p>
                <div className="flex items-center gap-1.5 ml-2">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse", isConnected ? "bg-emerald-500" : "bg-red-500")} />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-stone-500">
                    {isConnected ? 'Live' : 'Desconectado'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all",
              audioEnabled 
                ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                : "bg-stone-800 border-stone-700 text-stone-500"
            )}
          >
            <Bell size={18} className={audioEnabled ? "animate-bounce" : ""} />
            <span className="text-xs font-bold uppercase tracking-wider">
              Som: {audioEnabled ? 'Ligado' : 'Desligado'}
            </span>
          </button>
          <div className="text-center border-l border-stone-800 pl-6">
            <p className="text-2xl font-bold">{activeOrders.length}</p>
            <p className="text-[10px] uppercase tracking-widest text-stone-500">Ativos</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence>
          {activeOrders.map(order => (
            <motion.div 
              key={order.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-stone-800 rounded-3xl p-6 border border-stone-700 flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
                    {order.table_number ? 'Mesa' : 'Local'}
                  </span>
                  <p className={cn(
                    "text-3xl font-bold",
                    !order.table_number && "text-emerald-400"
                  )}>
                    {order.table_number || 'Balcão'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Pedido</span>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs text-stone-400 font-mono">
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <p className="text-lg font-mono">#{order.id}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-3 mb-8">
                {order.items.map((item, idx) => (
                  <div key={idx} className="border-b border-stone-700/50 pb-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{item.name}</span>
                      <span className="bg-stone-700 px-2 py-1 rounded text-xs font-bold">x{item.quantity}</span>
                    </div>
                    {item.observation && (
                      <p className="text-xs text-yellow-500 italic mt-1">Obs: {item.observation}</p>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-[10px] text-emerald-400 mt-1">
                        + {item.addons.map(a => a.name).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'preparing')}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Clock size={18} /> Aceitar
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button 
                      onClick={() => updateStatus(order.id, 'ready')}
                      className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} /> Pronto
                    </button>
                  )}
                  <button 
                    onClick={() => handlePrint(order)}
                    className="bg-stone-700 hover:bg-stone-600 p-3 rounded-xl transition-colors"
                  >
                    <Printer size={20} />
                  </button>
                </div>
                {order.status === 'ready' && (
                  <button 
                    onClick={() => updateStatus(order.id, 'delivered')}
                    className="w-full bg-stone-700 hover:bg-stone-600 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    Entregue
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const CustomerMenu = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [cart, setCart] = useState<{
    item: Item, 
    quantity: number, 
    observation?: string, 
    selectedAddons?: Addon[]
  }[]>([]);
  const [category, setCategory] = useState<'all' | 'dish' | 'drink'>('all');
  const [orderSent, setOrderSent] = useState(false);
  const [showCartDetails, setShowCartDetails] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [customizingItem, setCustomizingItem] = useState<Item | null>(null);
  const [itemObservation, setItemObservation] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [tableSearch, setTableSearch] = useState('');

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(setItems)
      .catch(err => console.error('Menu items fetch error:', err));
    fetch('/api/tables')
      .then(res => res.json())
      .then(setTables)
      .catch(err => console.error('Menu tables fetch error:', err));
    fetch('/api/addons')
      .then(res => res.json())
      .then(setAddons)
      .catch(err => console.error('Menu addons fetch error:', err));
  }, []);

  const handleAddToCartClick = (item: Item) => {
    setCustomizingItem(item);
    setItemObservation('');
    setSelectedAddons([]);
  };

  const confirmAddToCart = () => {
    if (!customizingItem) return;

    setCart(prev => {
      // We treat items with different observations or addons as different entries in the cart
      // to keep it simple, or we can just add a new entry every time.
      // Let's just add a new entry to avoid complex matching.
      return [...prev, { 
        item: customizingItem, 
        quantity: 1, 
        observation: itemObservation,
        selectedAddons: [...selectedAddons]
      }];
    });

    setCustomizingItem(null);
  };

  const updateQuantity = (cartIndex: number, delta: number) => {
    setCart(prev => {
      return prev.map((i, idx) => {
        if (idx === cartIndex) {
          const newQty = Math.max(0, i.quantity + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      }).filter(i => i.quantity > 0);
    });
  };

  const total = cart.reduce((sum, i) => {
    const itemTotal = i.item.price;
    const addonsTotal = i.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0;
    return sum + ((itemTotal + addonsTotal) * i.quantity);
  }, 0);

  const sendOrder = async () => {
    if (selectedTable === null) return alert('Por favor, selecione sua mesa ou retirada no balcão.');
    
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table_id: selectedTable === -1 ? null : selectedTable,
        items: cart.map(i => ({ 
          id: i.item.id, 
          quantity: i.quantity, 
          price: i.item.price,
          observation: i.observation,
          selectedAddons: i.selectedAddons
        })),
        total_price: total
      })
    });
    setCart([]);
    setOrderSent(true);
    setTimeout(() => setOrderSent(false), 5000);
  };

  const filteredItems = category === 'all' ? items : items.filter(i => i.category === category);

  return (
    <div className="min-h-screen bg-stone-50 font-serif relative overflow-x-hidden">
      {/* Background Image with Overlay */}
      <div className="fixed inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop" 
          className="w-full h-full object-cover opacity-15"
          alt="Background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50/90 via-stone-50/40 to-stone-50/90" />
      </div>

      <header className="relative z-10 bg-white/80 backdrop-blur-md px-6 py-12 text-center border-b border-stone-200 shadow-sm">
        <div className="max-w-xl mx-auto">
          <div className="w-24 h-24 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg border-4 border-white">
            <ChefHat size={48} className="text-stone-900" />
          </div>
          <h1 className="text-5xl font-bold italic mb-2 text-stone-900">Ponto Certo</h1>
          <p className="text-stone-600 font-sans uppercase tracking-[0.3em] text-sm font-bold mb-1">Comida Caseira</p>
          <p className="text-stone-400 font-sans text-xs font-medium">(65) 98465-6023</p>
        </div>
      </header>

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-12 pb-32">
        <section className="bg-white/80 backdrop-blur-md p-10 rounded-[40px] shadow-xl border border-white/40">
          <div className="flex flex-col items-center mb-8">
            <h2 className="text-3xl font-bold italic text-stone-800 mb-2">Onde você está?</h2>
            <p className="text-stone-500 font-sans text-sm">Selecione sua mesa ou escolha retirada no balcão</p>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <button 
              onClick={() => setSelectedTable(-1)}
              className={cn(
                "w-full md:w-auto px-10 py-6 rounded-3xl font-sans font-bold transition-all shadow-lg flex flex-col items-center gap-3 border-2",
                selectedTable === -1 
                  ? "bg-stone-900 border-stone-900 text-white scale-105 shadow-stone-200" 
                  : "bg-white border-stone-100 text-stone-400 hover:border-stone-200"
              )}
            >
              <Beer size={32} />
              <div className="text-center">
                <span className="block text-lg">Balcão</span>
                <span className="text-[10px] uppercase tracking-widest opacity-60">Retirada Direta</span>
              </div>
            </button>

            <div className="hidden md:block w-px h-24 bg-stone-200" />
            <div className="md:hidden w-full h-px bg-stone-200" />

            <div className="flex-1 w-full">
              <div className="mb-6">
                <div className="relative">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input 
                    type="number"
                    placeholder="Digite o número da mesa..."
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-stone-100 focus:border-stone-900 focus:ring-0 outline-none font-sans text-lg transition-all"
                    value={tableSearch}
                    onChange={e => {
                      setTableSearch(e.target.value);
                      const table = tables.find(t => t.number.toString() === e.target.value);
                      if (table) setSelectedTable(table.id);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[200px] overflow-y-auto p-1">
                {tables
                  .filter(t => !tableSearch || t.number.toString().includes(tableSearch))
                  .map(t => (
                  <button 
                    key={t.id}
                    onClick={() => {
                      setSelectedTable(t.id);
                      setTableSearch(t.number.toString());
                    }}
                    className={cn(
                      "aspect-square rounded-2xl font-sans font-bold transition-all shadow-sm flex items-center justify-center text-lg border-2",
                      selectedTable === t.id 
                        ? "bg-stone-900 border-stone-900 text-white scale-110 shadow-stone-300 z-10" 
                        : "bg-white border-stone-50 text-stone-400 hover:bg-stone-50 hover:border-stone-200"
                    )}
                  >
                    {t.number}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-0 z-30 -mx-6 px-6 py-4 bg-stone-50/80 backdrop-blur-md border-b border-stone-200/50">
          <nav className="flex justify-center gap-6 font-sans text-[10px] font-bold uppercase tracking-widest bg-white/80 backdrop-blur-lg py-3 px-6 rounded-full border border-stone-200 shadow-sm max-w-fit mx-auto">
            <button onClick={() => setCategory('all')} className={cn("pb-0.5 border-b-2 transition-all", category === 'all' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400")}>Tudo</button>
            <button onClick={() => setCategory('dish')} className={cn("pb-0.5 border-b-2 transition-all", category === 'dish' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400")}>Pratos</button>
            <button onClick={() => setCategory('drink')} className={cn("pb-0.5 border-b-2 transition-all", category === 'drink' ? "border-stone-900 text-stone-900" : "border-transparent text-stone-400")}>Bebidas</button>
          </nav>
        </div>

        <div className="space-y-12">
          {filteredItems.map(item => (
            <div key={item.id} className="flex flex-col md:flex-row gap-8 items-center group bg-white/40 backdrop-blur-sm p-6 rounded-[40px] border border-white/40 hover:bg-white/60 transition-all duration-500">
              <div 
                className="w-full md:w-48 aspect-square rounded-[32px] overflow-hidden bg-stone-200 shadow-md cursor-pointer group"
                onClick={() => handleAddToCartClick(item)}
              >
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                    {item.category === 'dish' ? <UtensilsCrossed size={40} /> : <Beer size={40} />}
                  </div>
                )}
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 mb-2">
                  <h3 className="text-2xl font-bold italic text-stone-900">{item.name}</h3>
                  <div className="flex-1 border-b border-dotted border-stone-300 mx-4 hidden md:block" />
                  <span className="text-xl font-bold text-stone-900">R$ {item.price.toFixed(2)}</span>
                </div>
                <p className="text-stone-600 font-sans text-sm mb-6 leading-relaxed">{item.description}</p>
                <button 
                  onClick={() => handleAddToCartClick(item)}
                  className="font-sans text-[10px] font-bold uppercase tracking-widest bg-stone-900 text-white px-8 py-3 rounded-full hover:bg-stone-800 transition-all shadow-lg shadow-stone-200"
                >
                  Adicionar ao Pedido
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg px-6 z-50"
          >
            <div className="bg-stone-900 text-white p-6 rounded-[32px] shadow-2xl">
              <AnimatePresence>
                {showCartDetails && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mb-6 space-y-4"
                  >
                    <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                      <h4 className="font-bold italic">Itens no Pedido</h4>
                      <button onClick={() => setShowCartDetails(false)} className="text-stone-500 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>

                    <div className="bg-stone-800/50 p-4 rounded-2xl border border-stone-700/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-widest text-stone-500 font-bold">Local de Entrega</span>
                        <button 
                          onClick={() => {
                            setShowCartDetails(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold hover:underline"
                        >
                          Alterar
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          selectedTable === -1 ? "bg-emerald-500/20 text-emerald-500" : 
                          selectedTable ? "bg-stone-700 text-white" : "bg-red-500/20 text-red-500"
                        )}>
                          {selectedTable === -1 ? <Beer size={20} /> : <TableIcon size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {selectedTable === -1 ? 'Retirada no Balcão' : 
                             selectedTable ? `Mesa ${tables.find(t => t.id === selectedTable)?.number}` : 
                             'Mesa não selecionada'}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            {selectedTable ? 'Pedido será entregue no local' : 'Por favor, selecione onde entregar'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {cart.map((i, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{i.item.name}</p>
                          {i.observation && <p className="text-[10px] text-stone-400 italic">Obs: {i.observation}</p>}
                          {i.selectedAddons && i.selectedAddons.length > 0 && (
                            <p className="text-[10px] text-emerald-500">
                              + {i.selectedAddons.map(a => a.name).join(', ')}
                            </p>
                          )}
                          <p className="text-[10px] text-stone-500">
                            R$ {((i.item.price + (i.selectedAddons?.reduce((s, a) => s + a.price, 0) || 0)) * i.quantity).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 bg-stone-800 px-3 py-1 rounded-full">
                          <button 
                            onClick={() => updateQuantity(idx, -1)}
                            className="text-stone-400 hover:text-white transition-colors"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{i.quantity}</span>
                          <button 
                            onClick={() => updateQuantity(idx, 1)}
                            className="text-stone-400 hover:text-white transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setShowCartDetails(!showCartDetails)}
                  className="font-sans text-left flex items-center gap-4"
                >
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-widest text-stone-400 flex items-center gap-1">
                      {selectedTable === -1 ? 'Balcão' : selectedTable ? `Mesa ${tables.find(t => t.id === selectedTable)?.number}` : 'Sem Mesa'} {showCartDetails ? '↑' : '↓'}
                    </p>
                    <p className="text-xl font-bold">R$ {total.toFixed(2)}</p>
                  </div>
                </button>
                <button 
                  onClick={sendOrder}
                  className="bg-white text-stone-900 px-8 py-3 rounded-full font-sans font-bold uppercase text-xs tracking-widest hover:bg-stone-100 transition-colors"
                >
                  Finalizar Pedido
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {customizingItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 50, scale: 0.95 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 50, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-bold italic">{customizingItem.name}</h3>
                <button onClick={() => setCustomizingItem(null)} className="text-stone-400 hover:text-stone-900"><X /></button>
              </div>
              
              {customizingItem.image_url && (
                <div className="w-full aspect-video rounded-3xl overflow-hidden mb-6 shadow-lg">
                  <img src={customizingItem.image_url} alt={customizingItem.name} className="w-full h-full object-cover" />
                </div>
              )}

              {customizingItem.description && (
                <p className="text-stone-500 text-sm mb-6 font-sans leading-relaxed">{customizingItem.description}</p>
              )}

              <div className="space-y-8">
                {/* Addons Section */}
                {addons.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">Adicionais</h4>
                    <div className="space-y-2">
                      {addons.map(addon => (
                        <label key={addon.id} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 hover:bg-stone-50 cursor-pointer transition-colors">
                          <div className="flex items-center gap-3">
                            <input 
                              type="checkbox"
                              className="w-5 h-5 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                              checked={selectedAddons.some(a => a.id === addon.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAddons([...selectedAddons, addon]);
                                } else {
                                  setSelectedAddons(selectedAddons.filter(a => a.id !== addon.id));
                                }
                              }}
                            />
                            <span className="font-medium text-stone-700">{addon.name}</span>
                          </div>
                          <span className="text-sm font-bold text-stone-400">+ R$ {addon.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Observation Section */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400">
                    {customizingItem.observation_info || 'Observações'}
                  </h4>
                  <textarea 
                    placeholder="Ex: Sem cebola, ponto da carne, etc..."
                    className="w-full px-6 py-4 rounded-3xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 resize-none font-sans text-sm"
                    rows={3}
                    value={itemObservation}
                    onChange={e => setItemObservation(e.target.value)}
                  />
                </div>

                <button 
                  onClick={confirmAddToCart}
                  className="w-full bg-stone-900 text-white py-5 rounded-full font-bold text-lg hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Confirmar e Adicionar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orderSent && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[60] bg-stone-900/20 backdrop-blur-sm"
          >
            <div className="bg-white p-12 rounded-[40px] text-center shadow-2xl border border-stone-100 max-w-sm">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} />
              </div>
              <h3 className="text-3xl font-bold italic mb-2">Pedido Enviado!</h3>
              <p className="text-stone-500 font-sans">Sua refeição já está sendo preparada com carinho.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'customer' | 'admin' | 'kitchen'>('customer');

  return (
    <div className="min-h-screen">
      {/* View Selector for Demo Convenience */}
      <div className="fixed top-4 right-4 z-[100] flex gap-2 bg-white/50 backdrop-blur p-1 rounded-full border border-white/20 shadow-sm">
        <button onClick={() => setView('customer')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'customer' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Menu</button>
        <button onClick={() => setView('admin')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'admin' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Admin</button>
        <button onClick={() => setView('kitchen')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'kitchen' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Cozinha</button>
      </div>

      {view === 'customer' && <CustomerMenu />}
      {view === 'admin' && <AdminPanel onViewChange={setView} />}
      {view === 'kitchen' && <KitchenPanel onViewChange={setView} />}
    </div>
  );
}
