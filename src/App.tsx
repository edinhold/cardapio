import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Search,
  Info,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Pizza,
  IceCream,
  Wine,
  Soup,
  Flame,
  Fish,
  Beef,
  Apple,
  Cake,
  Truck,
  XCircle,
  LogOut,
  AlertCircle,
  QrCode,
  FileText,
  UserCheck,
  Volume2,
  VolumeX,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { ReportsManagement } from './components/ReportsManagement';
import { CustomersManagement } from './components/CustomersManagement';
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
import { db, auth } from './firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy, 
  limit, 
  where,
  getDocs,
  writeBatch,
  Timestamp,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
// Logo component helper defined to use pure styled Lucide elements

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We don't throw here to avoid crashing the whole app if a background listener fails,
  // but we could if we wanted to trigger the ErrorBoundary.
  // throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || "");
        if (parsed.error && parsed.error.includes("permissions")) {
          displayMessage = "Você não tem permissão para realizar esta ação ou acessar estes dados.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
          <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-stone-100 max-w-md text-center">
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle size={40} />
            </div>
            <h2 className="text-2xl font-bold italic mb-4">Ops! Algo deu errado</h2>
            <p className="text-stone-500 mb-8 font-sans">{displayMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-4 rounded-full font-bold hover:bg-stone-800 transition-all"
            >
              Recarregar Aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Shared Utilities ---

const parseOrderDate = (val: any): Date => {
  if (!val) return new Date();
  if (typeof val.toDate === 'function') return val.toDate();
  if (typeof val.toMillis === 'function') return new Date(val.toMillis());
  if (typeof val === 'number') return new Date(val);
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
};

const printHtml = (title: string, htmlContent: string) => {
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      return;
    }
  } catch (e) {
    console.warn("Failed to open print window, falling back to iframe:", e);
  }

  // Fallback to iframe printing (perfect for iframe sandbox or blocked popups)
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.title = title;
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.write(htmlContent);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error("Iframe print error:", err);
      } finally {
        document.body.removeChild(iframe);
      }
    }, 500);
  }
};

const handlePrint = (order: Order) => {
  const orderDate = parseOrderDate(order.created_at);
  const orderId = order.id || '';
  const shortId = orderId.length > 4 ? orderId.slice(-4).toUpperCase() : (orderId || '0000').toUpperCase();
  const safeItems = order.items || [];
  const safeTotal = typeof order.total_price === 'number' ? order.total_price : 0;

  printHtml(`Pedido #${order.id}`, `
    <html>
      <head>
        <title>Pedido #${order.id}</title>
        <style>
          @page { margin: 0; }
          body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; }
          .header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; }
          .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .addon { font-size: 0.8em; margin-left: 15px; }
          .obs { font-style: italic; font-size: 0.8em; margin-top: 2px; }
          .delivery-info { background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px;">
          <h1 style="margin: 0; font-size: 1.25em; font-family: sans-serif; font-weight: bold; text-transform: uppercase;">Ponto Certo Comida Caseira</h1>
          <p style="margin: 3px 0 0 0; font-size: 0.85em; font-family: sans-serif;">(65) 98465-6023</p>
        </div>
        <div class="header">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <h2 style="margin: 0;">PEDIDO #${shortId}</h2>
            <span>${orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p style="font-weight: bold; font-size: 1.2em; margin: 5px 0;">
            ${order.type === 'delivery' ? 'DELIVERY' : (order.type === 'counter' ? 'BALCÃO' : `MESA: ${order.table_number || order.table_id || 'Mesa'}`)}
          </p>
          ${order.delivery_info ? `
            <div class="delivery-info">
              <p style="margin: 0; font-weight: bold;">Cliente: ${order.delivery_info.name}</p>
              <p style="margin: 0; font-size: 0.9em;">Tel: ${order.delivery_info.phone || ''}</p>
              <p style="margin: 0; font-size: 0.9em;">End: ${order.delivery_info.address || ''}</p>
            </div>
          ` : ''}
        </div>

        <div class="content">
          ${safeItems.map(item => `
            <div style="margin-bottom: 10px;">
              <div class="item">
                <span style="font-weight: bold;">${item.quantity || 1}x ${item.name || 'Item'}</span>
                <span>R$ ${((item.price_at_time || 0) * (item.quantity || 1)).toFixed(2)}</span>
              </div>
              ${item.observation ? `<div class="obs">Obs: ${item.observation}</div>` : ''}
              ${item.addons && item.addons.length > 0 ? `
                <div style="color: #444;">
                  ${item.addons.map(a => `<div class="addon">+ ${a.name}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="footer">
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em;">
            <span>TOTAL</span>
            <span>R$ ${safeTotal.toFixed(2)}</span>
          </div>
          <p style="text-align: center; font-size: 0.7em; margin-top: 20px; opacity: 0.5;">
            ${orderDate.toLocaleString()}
          </p>
        </div>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `);
};

const consolidateItems = (orders: Order[]) => {
  const consolidated: { [key: string]: { name: string; quantity: number; price_at_time: number; addons: any[] } } = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      const addonNames = item.addons ? item.addons.map(a => a.name).sort().join(',') : '';
      const key = `${item.item_id || item.name || 'item'}_${addonNames}`;
      if (consolidated[key]) {
        consolidated[key].quantity += (item.quantity || 1);
      } else {
        consolidated[key] = {
          name: item.name || 'Item',
          quantity: item.quantity || 1,
          price_at_time: item.price_at_time || 0,
          addons: item.addons || []
        };
      }
    });
  });
  return Object.values(consolidated);
};

const handlePrintReceipt = (title: string, orders: Order[], total: number) => {
  const consolidated = consolidateItems(orders);
  
  printHtml(`Comprovante - ${title}`, `
    <html>
      <head>
        <title>Comprovante - ${title}</title>
        <style>
          @page { margin: 0; }
          body { 
            font-family: 'Courier New', Courier, monospace; 
            padding: 20px; 
            color: #000; 
            background: #fff;
            max-width: 380px;
            margin: 0 auto;
          }
          .center { text-align: center; }
          .header { border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px; }
          .footer { border-top: 2px dashed #000; padding-top: 10px; margin-top: 15px; text-align: center; font-size: 0.8em; }
          .item { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; }
          .addon { font-size: 0.8em; margin-left: 15px; font-style: italic; opacity: 0.8; }
          .total { 
            border-top: 1px dashed #000; 
            margin-top: 10px; 
            padding-top: 10px; 
            display: flex; 
            justify-content: space-between; 
            font-weight: bold; 
            font-size: 1.15em; 
          }
          .title { font-size: 1.4em; font-weight: bold; margin: 5px 0; letter-spacing: 1px; }
          .subtitle { font-size: 0.95em; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; }
        </style>
      </head>
      <body>
        <div class="header center">
          <div class="title" style="font-size: 1.25em; text-transform: uppercase;">Ponto Certo Comida Caseira</div>
          <p style="margin: 3px 0 10px 0; font-size: 0.85em;">(65) 98465-6023</p>
          <div class="subtitle">Comprovante de Fechamento</div>
          <div style="font-size: 0.8em; margin-top: 5px; line-height: 1.4;">
            <strong>${title}</strong><br/>
            Data: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>

        <div style="font-size: 0.85em; margin-bottom: 12px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 4px;">
          ITENS CONSUMIDOS:
        </div>

        <div>
          ${consolidated.map(item => `
            <div style="margin-bottom: 8px;">
              <div class="item">
                <span>${item.quantity}x ${item.name}</span>
                <span>R$ ${(item.price_at_time * item.quantity).toFixed(2)}</span>
              </div>
              ${item.addons && item.addons.length > 0 ? `
                <div class="addon">
                  + ${item.addons.map(a => `${a.name} (R$ ${a.price.toFixed(2)})`).join(', ')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>

        <div class="total">
          <span>VALOR TOTAL</span>
          <span>R$ ${total.toFixed(2)}</span>
        </div>

        <div class="footer">
          <p style="margin: 3px 0; font-weight: bold;">Obrigado pela preferência!</p>
          <p style="margin: 3px 0; font-size: 0.8em; opacity: 0.7;">Volte sempre!</p>
          <p style="margin-top: 15px; font-size: 0.7em; opacity: 0.4;">Ponto Certo Comida Caseira</p>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `);
};

// --- Auth Component ---

const LoginScreen = ({ onLogin }: { onLogin: (user?: any) => void }) => {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('123456789');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // 1. Bypass local para as credenciais padrão de admin exigidas pelo usuário
    if (email === 'admin@admin.com' && password === '123456789') {
      const localUser = {
        uid: 'admin-local',
        email: 'admin@admin.com',
        displayName: 'Administrador Local',
        emailVerified: true,
        isAnonymous: false,
        providerId: 'local'
      };
      localStorage.setItem('local_admin_user', JSON.stringify(localUser));
      onLogin(localUser);
      setLoading(false);
      return;
    }

    try {
      // Attempt sign in with the email and password
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err: any) {
      console.error("Login error:", err);
      // If user does not exist yet (or has been wiped), try registering it automatically
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
          onLogin();
          return;
        } catch (createErr: any) {
          console.error("Registration error:", createErr);
          if (createErr.code === 'auth/operation-not-allowed') {
            setError("O login por E-mail/Senha não está ativado no Firebase Console. Para entrar agora, utilize as credenciais administrativas padrão: admin@admin.com com a senha 123456789.");
          } else {
            setError(createErr.message || "Erro de credenciais.");
          }
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setError("O login por E-mail/Senha não está ativado no Firebase Console. Para entrar agora, utilize as credenciais administrativas padrão: admin@admin.com com a senha 123456789.");
      } else {
        setError(err.message || "Ocorreu um erro ao realizar o login. Por favor, tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-stone-100 max-w-md w-full">
        <div className="w-20 h-20 bg-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border-4 border-white">
          <ChefHat size={40} className="text-stone-900" />
        </div>
        <h2 className="text-3xl font-bold italic mb-2 text-center">Bem-vindo</h2>
        <p className="text-stone-500 mb-8 font-sans text-center">Acesse o painel administrativo ou de cozinha.</p>

        <form onSubmit={handleLoginSubmit} className="space-y-5 text-left">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 font-sans">
              E-mail de Acesso
            </label>
            <input
              type="email"
              required
              placeholder="admin@admin.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 font-sans text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-500 mb-2 font-sans">
              Senha
            </label>
            <input
              type="password"
              required
              placeholder="•••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-3.5 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-stone-900 font-sans text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white py-4 rounded-full font-bold hover:bg-stone-800 transition-all shadow-md mt-2 flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Entrar no Painel"
            )}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-5 bg-amber-50/60 border border-amber-200 rounded-3xl text-left space-y-4 font-sans">
            <div className="flex items-start gap-3 text-amber-800">
              <AlertCircle size={22} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-semibold text-sm">Problema ao Autenticar</p>
                <p className="text-xs text-stone-600 leading-relaxed mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick, 
  collapsed,
  badge
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void, 
  collapsed?: boolean,
  badge?: number
}) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={cn(
      "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 relative",
      collapsed ? "justify-center px-2" : "px-4",
      active 
        ? "bg-stone-900 text-white shadow-lg shadow-stone-200" 
        : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
    )}
  >
    <div className="flex items-center gap-3 overflow-hidden">
      <Icon size={20} className="shrink-0" />
      {!collapsed && <span className="font-medium whitespace-nowrap overflow-hidden">{label}</span>}
    </div>
    {badge != null && badge > 0 && (
      collapsed ? (
        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
      ) : (
        <span className={cn(
          "px-2 py-0.5 text-xs font-bold rounded-full",
          active ? "bg-red-500 text-white" : "bg-red-100 text-red-600"
        )}>
          {badge}
        </span>
      )
    )}
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

const AdminDashboard = ({ orders = [] }: { orders?: Order[] }) => {
  const [orderFilter, setOrderFilter] = useState<'all' | 'counter' | 'table' | 'delivery'>('all');

  const recentOrders = useMemo(() => orders.slice(0, 50), [orders]);

  const stats = useMemo<SalesStats>(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const thisWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let daily = 0;
    let weekly = 0;
    let monthly = 0;
    const salesMap: Record<string, number> = {};

    orders.forEach(o => {
      if (o.status === 'canceled') return;
      const date = new Date(o.created_at);
      const time = date.getTime();
      const dateStr = date.toLocaleDateString();

      if (time >= today) daily += o.total_price;
      if (time >= thisWeek) weekly += o.total_price;
      if (time >= thisMonth) monthly += o.total_price;

      salesMap[dateStr] = (salesMap[dateStr] || 0) + o.total_price;
    });

    const salesOverTime = Object.entries(salesMap)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-7);

    return { daily, weekly, monthly, salesOverTime };
  }, [orders]);

  const handleSystemReset = async () => {
    if (!window.confirm('ATENÇÃO: Isso apagará TODOS os pedidos e resetará o status das mesas. Esta ação não pode ser desfeita. Deseja continuar?')) return;
    
    try {
      const batch = writeBatch(db);
      const ordersSnap = await getDocs(collection(db, 'orders'));
      ordersSnap.forEach(doc => batch.delete(doc.ref));
      const tablesSnap = await getDocs(collection(db, 'tables'));
      tablesSnap.forEach(doc => batch.update(doc.ref, { status: 'available' }));
      await batch.commit();
      alert('Sistema limpo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system-reset');
    }
  };

  const handlePrintReport = async (period: 'day' | 'week' | 'month') => {
    try {
      const now = new Date();
      let startTime = 0;
      if (period === 'day') startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      else if (period === 'week') startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
      else startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();

      const filteredOrders = recentOrders.filter(o => new Date(o.created_at).getTime() >= startTime && o.status !== 'canceled');
      
      const itemsMap: Record<string, { name: string, quantity: number, total: number }> = {};
      let totalRevenue = 0;

      filteredOrders.forEach(o => {
        totalRevenue += o.total_price;
        o.items.forEach(i => {
          const key = i.item_id;
          if (!itemsMap[key]) itemsMap[key] = { name: i.name || 'Item', quantity: 0, total: 0 };
          itemsMap[key].quantity += i.quantity;
          itemsMap[key].total += i.price_at_time * i.quantity;
        });
      });

      const itemsSold = Object.values(itemsMap);
      
      const periodLabel = period === 'day' ? 'HOJE' : period === 'week' ? 'ÚLTIMA SEMANA' : 'ÚLTIMOS 30 DIAS';
      
      printHtml(`Relatório de Vendas - ${periodLabel}`, `
        <html>
          <head>
            <title>Relatório de Vendas - ${periodLabel}</title>
            <style>
              body { font-family: monospace; padding: 20px; max-width: 400px; margin: 0 auto; color: #000; }
              h2 { text-align: center; margin-bottom: 5px; font-size: 1.5em; }
              p { text-align: center; margin: 2px 0; font-size: 0.8em; }
              hr { border: none; border-top: 1px dashed #000; margin: 15px 0; }
              table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
              th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
              td { padding: 5px 0; }
              .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 1.2em; margin-top: 10px; }
              @media print { button { display: none; } }
            </style>
          </head>
          <body>
            <h2>PONTO CERTO COMIDA CASEIRA</h2>
            <p>RELATÓRIO DE VENDAS: ${periodLabel}</p>
            <p>Gerado em: ${new Date().toLocaleString()}</p>
            <hr/>
            <table>
              <thead>
                <tr>
                  <th style="text-align: left;">ITEM</th>
                  <th style="text-align: center;">QTD</th>
                  <th style="text-align: right;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${itemsSold.map((item: any) => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">R$ ${item.total.toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <hr/>
            <div class="total-row">
              <span>TOTAL GERAL:</span>
              <span>R$ ${totalRevenue.toFixed(2)}</span>
            </div>
            <p style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 10px;">Assinatura Responsável</p>
            <p style="margin-top: 30px; font-size: 0.7em;">Fim do Relatório</p>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `);
    } catch (err) {
      console.error('Report print error:', err);
      alert('Erro ao gerar relatório.');
    }
  };

  const cancelOrder = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar este pedido?')) return;
    try {
      await updateDoc(doc(db, 'orders', id), { status: 'canceled' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const cancelOrderItem = async (orderId: string, itemIndexToRemove: number) => {
    const order = recentOrders.find(o => o.id === orderId);
    if (!order) return;

    if (!window.confirm(`Deseja cancelar o item "${order.items[itemIndexToRemove]?.name || 'produto'}" deste pedido?`)) return;

    const updatedItems = [...order.items];
    updatedItems.splice(itemIndexToRemove, 1);

    try {
      if (updatedItems.length === 0) {
        await updateDoc(doc(db, 'orders', orderId), {
          items: [],
          total_price: 0,
          status: 'canceled'
        });
      } else {
        const newTotal = updatedItems.reduce((sum, item) => {
          const itemTotal = item.price_at_time;
          const addonsTotal = item.addons?.reduce((s, a) => s + a.price_at_time, 0) || 0;
          return sum + ((itemTotal + addonsTotal) * item.quantity);
        }, 0);

        await updateDoc(doc(db, 'orders', orderId), {
          items: updatedItems,
          total_price: newTotal
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  if (!stats) return <div>Carregando...</div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Vendas Hoje" value={`R$ ${stats.daily.toFixed(2)}`} />
        <StatCard label="Vendas Semana" value={`R$ ${stats.weekly.toFixed(2)}`} />
        <StatCard label="Vendas Mês" value={`R$ ${stats.monthly.toFixed(2)}`} />
      </div>

      <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm">
        <h3 className="text-xl font-bold mb-6 font-serif italic flex items-center gap-2">
          <Printer size={20} /> Imprimir Relatórios de Vendas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button 
            onClick={() => handlePrintReport('day')}
            className="flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 p-4 rounded-2xl border border-stone-100 transition-all font-bold text-stone-700"
          >
            Relatório do Dia
          </button>
          <button 
            onClick={() => handlePrintReport('week')}
            className="flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 p-4 rounded-2xl border border-stone-100 transition-all font-bold text-stone-700"
          >
            Relatório da Semana
          </button>
          <button 
            onClick={() => handlePrintReport('month')}
            className="flex items-center justify-center gap-2 bg-stone-50 hover:bg-stone-100 p-4 rounded-2xl border border-stone-100 transition-all font-bold text-stone-700"
          >
            Relatório do Mês
          </button>
          <button 
            onClick={handleSystemReset}
            className="flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 p-4 rounded-2xl border border-red-100 transition-all font-bold text-red-600"
          >
            Limpar Sistema
          </button>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl border border-stone-100 shadow-sm overflow-y-auto flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h3 className="text-xl font-bold font-serif italic">Pedidos</h3>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'Todos' },
                { id: 'counter', label: 'Balcão' },
                { id: 'table', label: 'Mesas' },
                { id: 'delivery', label: 'Delivery' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setOrderFilter(f.id as any)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all",
                    orderFilter === f.id 
                      ? "bg-stone-900 text-white" 
                      : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4 flex-1">
            {recentOrders
              .filter(o => orderFilter === 'all' || o.type === orderFilter)
              .map(order => (
              <div key={order.id} className="flex flex-col gap-3 p-5 rounded-2xl bg-stone-50 border border-stone-100">
                {/* Header Row */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-stone-900">
                      #{order.id.slice(-6).toUpperCase()} - {
                        order.type === 'delivery' ? 'Delivery' : 
                        order.type === 'counter' ? 'Balcão' : 
                        `Mesa ${order.table_number}`
                      }
                    </p>
                    <p className="text-xs text-stone-400">
                      {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="font-bold text-stone-900">R$ {order.total_price.toFixed(2)}</p>
                    <div className="flex items-center gap-2">
                      {order.status !== 'paid' && order.status !== 'canceled' && (
                        <button 
                          onClick={() => cancelOrder(order.id)}
                          className="text-[10px] text-red-500 hover:underline font-bold"
                        >
                          Cancelar Pedido
                        </button>
                      )}
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                        order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                        order.status === 'preparing' ? "bg-blue-100 text-blue-700" :
                        order.status === 'canceled' ? "bg-red-100 text-red-700" :
                        "bg-emerald-100 text-emerald-700"
                      )}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Delivery details if any */}
                {order.delivery_info && (
                  <div className="bg-stone-100/50 p-2.5 rounded-xl border border-stone-200/50 text-xs">
                    <span className="font-bold text-stone-700">Entrega para:</span> {order.delivery_info.name} - {order.delivery_info.phone}<br/>
                    <span className="font-bold text-stone-700">Endereço:</span> {order.delivery_info.address}
                  </div>
                )}

                {/* Divider */}
                <div className="border-t border-stone-200/60 my-1"></div>

                {/* Items List */}
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Itens do Pedido:</p>
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-sm py-1 border-b border-stone-200/40 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-stone-700 bg-stone-200/75 px-1.5 py-0.5 rounded text-xs">
                              {item.quantity}x
                            </span>
                            <span className="font-semibold text-stone-800 truncate">{item.name}</span>
                            <span className="text-xs text-stone-500 font-mono">
                              (R$ {((item.price_at_time + (item.addons?.reduce((sum, a) => sum + a.price_at_time, 0) || 0)) * item.quantity).toFixed(2)})
                            </span>
                          </div>
                          {item.observation && (
                            <p className="text-xs text-amber-600 font-medium italic mt-0.5 ml-8">
                              Obs: {item.observation}
                            </p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 ml-8">
                              {item.addons.map((a, aidx) => (
                                <span key={aidx} className="text-[9px] bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded border border-stone-200">
                                  + {a.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {order.status !== 'paid' && order.status !== 'canceled' && (
                          <button
                            onClick={() => cancelOrderItem(order.id, idx)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0 ml-4"
                            title="Cancelar este item"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-stone-400 italic">Nenhum item cadastrado neste pedido.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
};

const IconMap: Record<string, any> = {
  Coffee, Pizza, IceCream, Wine, Soup, Flame, Fish, Beef, Apple, Cake, UtensilsCrossed, Beer
};

const MenuManagement = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 'dish',
    is_dish_of_day: false,
    image_url: '',
    icon: '',
    observation_info: ''
  });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'items'), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });
    return () => unsubscribe();
  }, []);

  const handleOpenForm = (item?: Item) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        description: item.description || '',
        price: item.price.toString(),
        category: item.category,
        is_dish_of_day: !!item.is_dish_of_day,
        image_url: item.image_url || '',
        icon: item.icon || '',
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
        icon: '',
        observation_info: ''
      });
    }
    setShowForm(true);
  };

  const resizeImage = (file: File, maxWidth: number = 800, maxHeight: number = 600): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to JPEG with 70% quality
        };
        img.onerror = reject;
      };
      reader.onerror = reject;
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const resizedImage = await resizeImage(file);
        setFormData({ ...formData, image_url: resizedImage });
      } catch (err) {
        console.error('Error resizing image:', err);
        alert('Erro ao processar imagem.');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingItem && !window.confirm('Deseja salvar as alterações neste item?')) {
      return;
    }

    setIsSaving(true);
    try {
      const data = { ...formData, price: parseFloat(formData.price) };
      if (editingItem) {
        await updateDoc(doc(db, 'items', editingItem.id), data);
      } else {
        await addDoc(collection(db, 'items'), data);
      }
      
      setFormData({ name: '', description: '', price: '', category: 'dish', is_dish_of_day: false, image_url: '', icon: '', observation_info: '' });
      setEditingItem(null);
      setShowForm(false);
    } catch (err) {
      handleFirestoreError(err, editingItem ? OperationType.UPDATE : OperationType.CREATE, editingItem ? `items/${editingItem.id}` : 'items');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja remover este item?')) {
      try {
        await deleteDoc(doc(db, 'items', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `items/${id}`);
      }
    }
  };

  const handleClearMenu = async () => {
    if (!window.confirm('ATENÇÃO: Isso apagará TODOS os produtos e adicionais cadastrados, além de todos os pedidos existentes. Esta ação não pode ser desfeita. Deseja continuar?')) return;
    
    try {
      const batch = writeBatch(db);
      const itemsSnap = await getDocs(collection(db, 'items'));
      itemsSnap.forEach(doc => batch.delete(doc.ref));
      const addonsSnap = await getDocs(collection(db, 'addons'));
      addonsSnap.forEach(doc => batch.delete(doc.ref));
      const ordersSnap = await getDocs(collection(db, 'orders'));
      ordersSnap.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      alert('Cardápio limpo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clear-menu');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-serif italic">Gestão de Cardápio</h2>
        <div className="flex gap-3">
          <button 
            onClick={handleClearMenu}
            className="bg-red-50 text-red-600 px-6 py-2 rounded-full flex items-center gap-2 hover:bg-red-100 transition-colors text-sm font-bold border border-red-100"
          >
            <Trash2 size={18} /> Apagar Tudo
          </button>
          <button 
            onClick={() => handleOpenForm()}
            className="bg-stone-900 text-white px-6 py-2 rounded-full flex items-center gap-2 hover:bg-stone-800 transition-colors"
          >
            <Plus size={18} /> Novo Item
          </button>
        </div>
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
                  {item.icon && IconMap[item.icon] ? (
                    React.createElement(IconMap[item.icon], { size: 32 })
                  ) : (
                    item.category === 'dish' ? <UtensilsCrossed size={32} /> : <Beer size={32} />
                  )}
                </div>
              )}
              {item.is_dish_of_day && (
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
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-stone-400">Ícone do Item</label>
                  <div className="grid grid-cols-6 gap-2">
                    {Object.keys(IconMap).map(iconName => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setFormData({...formData, icon: iconName})}
                        className={cn(
                          "p-2 rounded-lg border transition-all flex items-center justify-center",
                          formData.icon === iconName ? "bg-stone-900 text-white border-stone-900" : "bg-white border-stone-100 text-stone-400 hover:border-stone-300"
                        )}
                      >
                        {React.createElement(IconMap[iconName], { size: 18 })}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-stone-400">Imagem do Item</label>
                  <div className="flex items-center gap-4">
                    {formData.image_url && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border border-stone-200">
                        <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-stone-200 hover:border-stone-900 transition-colors flex items-center justify-center gap-2 text-stone-500 hover:text-stone-900">
                        <Plus size={18} />
                        <span className="text-sm font-bold uppercase tracking-wider">Carregar Foto</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  {formData.image_url && (
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, image_url: ''})}
                      className="text-[10px] text-red-500 font-bold uppercase tracking-widest hover:underline"
                    >
                      Remover Imagem
                    </button>
                  )}
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
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className={cn(
                    "w-full bg-stone-900 text-white py-4 rounded-xl font-bold transition-all",
                    isSaving ? "opacity-50 cursor-not-allowed" : "hover:bg-stone-800"
                  )}
                >
                  {isSaving ? 'Salvando...' : (editingItem ? 'Salvar Alterações' : 'Salvar Item')}
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

  useEffect(() => {
    const q = query(collection(db, 'employees'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'employees');
    });
    return () => unsubscribe();
  }, []);

  const deleteEmployee = async (id: string) => {
    if (!confirm('Remover este funcionário?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'employees'), { name, role });
      setName(''); setRole('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
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
          <div key={emp.id} className="bg-white p-6 rounded-2xl border border-stone-100 flex items-center justify-between group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center text-stone-400">
                <Users size={24} />
              </div>
              <div>
                <h4 className="font-bold">{emp.name}</h4>
                <p className="text-stone-500 text-sm">{emp.role}</p>
              </div>
            </div>
            <button 
              onClick={() => deleteEmployee(emp.id)}
              className="p-2 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const TableManagement = ({ 
  tables: initialTables = [], 
  allOrders = [],
  initialSelectedTable = null,
  onSelectTable
}: { 
  tables?: Table[]; 
  allOrders?: Order[]; 
  initialSelectedTable?: Table | 'counter' | null;
  onSelectTable?: (t: Table | 'counter' | null) => void;
}) => {
  const [localTables, setLocalTables] = useState<Table[]>(initialTables);
  const [number, setNumber] = useState('');
  const [selectedTable, setSelectedTable] = useState<Table | 'counter' | null>(initialSelectedTable);
  const [showReceipt, setShowReceipt] = useState<{
    tableNumber: string | number;
    orders: Order[];
    total: number;
  } | null>(null);
  const [showMenuModal, setShowMenuModal] = useState<string | 'counter' | null>(null);
  const [qrModalTable, setQrModalTable] = useState<Table | null>(null);

  useEffect(() => {
    if (initialTables.length > 0) {
      setLocalTables(initialTables);
      return;
    }
    const q = query(collection(db, 'tables'), orderBy('number'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
      setLocalTables(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tables');
    });
    return () => unsubscribe();
  }, [initialTables]);

  useEffect(() => {
    if (initialSelectedTable !== undefined) {
      setSelectedTable(initialSelectedTable);
    }
  }, [initialSelectedTable]);

  const tables = initialTables.length > 0 ? initialTables : localTables;

  const getOrdersForTable = (t: Table | 'counter') => {
    if (t === 'counter') {
      return allOrders.filter(o => {
        const st = (o.status || '').toLowerCase();
        const isNotClosed = st !== 'paid' && st !== 'pago' && st !== 'canceled' && st !== 'cancelado';
        const isCounterOrder = o.type === 'counter' || o.table_id === 'counter' || String(o.table_id) === 'counter';
        return isCounterOrder && isNotClosed;
      });
    }
    return allOrders.filter(o => {
      const st = (o.status || '').toLowerCase();
      const isNotClosed = st !== 'paid' && st !== 'pago' && st !== 'canceled' && st !== 'cancelado';
      const isMatch = (o.table_id === t.id || 
       o.table_id === t.number || 
       String(o.table_id) === String(t.number) || 
       o.table_number === t.number);
      return isMatch && isNotClosed;
    });
  };

  const tableOrders = useMemo(() => {
    if (!selectedTable) return [];
    const list = getOrdersForTable(selectedTable);
    return [...list].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status.localeCompare(b.status);
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [selectedTable, allOrders]);

  const handleTableClick = (table: Table | 'counter') => {
    setSelectedTable(table);
    if (onSelectTable) onSelectTable(table);
  };

  const closeBill = async () => {
    if (!selectedTable) return;
    
    const isCounter = selectedTable === 'counter';
    const label = isCounter ? 'Balcão' : `Mesa ${selectedTable.number}`;

    const confirmClose = confirm(
      tableOrders.length > 0 
        ? `Deseja fechar a conta do ${label}?` 
        : `Deseja liberar o ${label}?`
    );
    if (!confirmClose) return;

    try {
      const batch = writeBatch(db);
      
      // Mark all orders as paid
      tableOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { status: 'paid' });
      });

      // Update table status
      if (!isCounter) {
        const tableRef = doc(db, 'tables', selectedTable.id);
        batch.update(tableRef, { status: 'available' });
      }

      await batch.commit();

      if (tableOrders.length > 0) {
        setShowReceipt({
          tableNumber: isCounter ? 'Balcão' : selectedTable.number,
          orders: [...tableOrders],
          total: tableTotal
        });
      }

      setSelectedTable(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'close-bill');
    }
  };

  const cancelOrder = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;
    try {
      await updateDoc(doc(db, 'orders', id), { status: 'canceled' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const closeOrder = async (order: Order) => {
    if (!confirm(`Fechar pedido #${order.id}?`)) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'paid' });
      
      setShowReceipt({
        tableNumber: selectedTable === 'counter' ? 'Balcão' : (selectedTable as Table).number,
        orders: [order],
        total: order.total_price
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'tables'), { 
        number: parseInt(number),
        status: 'available'
      });
      setNumber('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tables');
    }
  };

  const deleteTable = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja remover esta mesa permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'tables', id));
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `tables/${id}`);
    }
  };

  const tableTotal = tableOrders.reduce((sum, order) => sum + order.total_price, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold italic">Roteiro do Salão</h2>
          <p className="text-stone-500 text-sm">Gerencie o layout físico das mesas, acompanhe pedidos ativos e extratos em tempo real.</p>
        </div>
        <button
          onClick={() => {
            const tableNum = prompt("Aponte o leitor de QR Code ou digite o número da mesa para abrir:");
            if (tableNum) {
              const matched = tables.find(t => t.number.toString() === tableNum.trim());
              if (matched) {
                handleTableClick(matched);
              } else {
                alert(`Mesa ${tableNum} não cadastrada no sistema.`);
              }
            }
          }}
          className="bg-emerald-600 text-white px-5 py-3 rounded-full font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-md shadow-emerald-50"
        >
          <QrCode size={18} /> Escanear Mesa (QR)
        </button>
      </div>

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
          {(() => {
            const counterOrders = getOrdersForTable('counter');
            const counterTotal = counterOrders.reduce((sum, o) => sum + o.total_price, 0);
            const hasPendingCounter = counterOrders.some(o => o.status === 'pending');

            return (
              <button 
                onClick={() => handleTableClick('counter')}
                className={cn(
                  "bg-white p-5 rounded-2xl border flex flex-col items-center gap-2 hover:border-stone-300 transition-all text-center relative group shadow-sm",
                  selectedTable === 'counter' ? "border-stone-900 ring-2 ring-stone-900" : "border-stone-100",
                  hasPendingCounter && "ring-2 ring-amber-400 bg-amber-50/20"
                )}
              >
                <div className="relative">
                  <div className="bg-stone-900 p-3 rounded-full text-white mb-1">
                    <Coffee size={24} />
                  </div>
                  {hasPendingCounter && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                  )}
                </div>
                <span className="font-bold text-xl">Balcão</span>
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                  counterOrders.length > 0 ? "bg-amber-100 text-amber-800" : "bg-stone-100 text-stone-600"
                )}>
                  {counterOrders.length > 0 ? `${counterOrders.length} ${counterOrders.length === 1 ? 'pedido' : 'pedidos'}` : 'Pedidos Diretos'}
                </span>
                {counterTotal > 0 && (
                  <span className="text-xs font-bold text-stone-900 font-mono">
                    R$ {counterTotal.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })()}

          {tables.map(table => {
            const activeTableOrders = getOrdersForTable(table);
            const totalBill = activeTableOrders.reduce((sum, o) => sum + o.total_price, 0);
            const hasPending = activeTableOrders.some(o => o.status === 'pending');
            const isOccupied = table.status === 'occupied' || activeTableOrders.length > 0;

            return (
              <button 
                key={table.id} 
                onClick={() => handleTableClick(table)}
                className={cn(
                  "bg-white p-5 rounded-2xl border flex flex-col items-center gap-2 hover:border-stone-300 transition-all text-center relative group shadow-sm",
                  selectedTable && typeof selectedTable !== 'string' && selectedTable.id === table.id 
                    ? "border-stone-900 ring-2 ring-stone-900" 
                    : "border-stone-100",
                  hasPending && "ring-2 ring-amber-400 bg-amber-50/20"
                )}
              >
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setQrModalTable(table);
                  }}
                  className="absolute top-2 left-2 p-1.5 text-stone-400 hover:text-emerald-600 hover:bg-stone-50 rounded-lg transition-all"
                  title="QR Code da Mesa"
                >
                  <QrCode size={16} />
                </button>
                <button 
                  onClick={(e) => deleteTable(e, table.id)}
                  className="absolute top-2 right-2 p-1.5 text-stone-300 hover:text-red-500 hover:bg-stone-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>

                <div className="relative mt-1">
                  <TableIcon size={32} className={cn(isOccupied ? "text-amber-500" : "text-stone-300")} />
                  {hasPending && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                  )}
                </div>

                <span className="font-bold text-xl">Mesa {table.number}</span>
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                  !isOccupied ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                )}>
                  {!isOccupied ? 'Disponível' : `${activeTableOrders.length} ${activeTableOrders.length === 1 ? 'pedido' : 'pedidos'}`}
                </span>

                {isOccupied && totalBill > 0 && (
                  <span className="text-xs font-bold text-stone-900 font-mono">
                    R$ {totalBill.toFixed(2)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedTable && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold italic">
                  {selectedTable === 'counter' ? 'Balcão' : `Mesa ${selectedTable.number}`} - Extrato
                </h3>
                <button onClick={() => setSelectedTable(null)} className="text-stone-400 hover:text-stone-900"><X /></button>
              </div>

              <div className="space-y-6">
                  {tableOrders.length === 0 ? (
                    <div className="py-10 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                      {selectedTable === 'counter' ? 'Nenhum pedido em aberto no balcão.' : 'Nenhum pedido em aberto para esta mesa.'}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tableOrders.map(order => {
                        const st = (order.status as string || '').toLowerCase();
                        const isPending = st === 'pending' || st === 'pendente';
                        const isPreparing = st === 'preparing' || st === 'preparando';
                        const isReady = st === 'ready' || st === 'pronto';
                        const isDelivered = st === 'delivered' || st === 'entregue';

                        return (
                          <div key={order.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-stone-900 text-sm">
                                    {order.delivery_info?.name 
                                      ? `${order.delivery_info.name} • #${(order.id || '').slice(-4).toUpperCase()}` 
                                      : `Pedido #${(order.id || '').slice(-6).toUpperCase()}`}
                                  </span>
                                  <span className={cn(
                                    "text-[9px] uppercase font-black px-2 py-0.5 rounded-full",
                                    isPending && "bg-amber-100 text-amber-800",
                                    isPreparing && "bg-blue-100 text-blue-800",
                                    isReady && "bg-emerald-100 text-emerald-800",
                                    isDelivered && "bg-purple-100 text-purple-800"
                                  )}>
                                    {isPending ? 'Pendente' : 
                                     isPreparing ? 'Em Preparo' : 
                                     isReady ? 'Pronto' : 
                                     isDelivered ? 'Entregue' : order.status}
                                  </span>
                                </div>
                                <span className="text-stone-400 text-xs font-mono">
                                  {parseOrderDate(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-base font-black text-stone-900">
                                  R$ {(order.total_price || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                            
                            {/* Items */}
                            <div className="space-y-1 bg-white p-3 rounded-xl border border-stone-100">
                              {(order.items || []).map((item, idx) => (
                                <div key={idx} className="space-y-0.5">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-stone-700 font-medium">{item.quantity || 1}x {item.name}</span>
                                    <span className="text-stone-500 font-mono">R$ {((item.price_at_time || 0) * (item.quantity || 1)).toFixed(2)}</span>
                                  </div>
                                  {item.observation && (
                                    <p className="text-[10px] text-amber-600 italic">Obs: {item.observation}</p>
                                  )}
                                  {item.addons && item.addons.length > 0 && (
                                    <div className="text-[10px] text-emerald-600">
                                      {item.addons.map(a => `+ ${a.name}`).join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* Order Actions */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button 
                                onClick={() => handlePrint(order)}
                                className="p-2 text-stone-400 hover:text-stone-900 hover:bg-stone-200 rounded-xl transition-all"
                                title="Imprimir Comanda"
                              >
                                <Printer size={15} />
                              </button>
                              <button 
                                onClick={() => cancelOrder(order.id)}
                                className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={() => closeOrder(order)}
                                className="px-4 py-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
                              >
                                <CheckCircle2 size={14} /> Receber Pedido
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="pt-4 border-t-2 border-stone-900 flex justify-between items-center">
                    <span className="text-xl font-bold uppercase tracking-widest">Total Aberto</span>
                    <span className="text-2xl font-bold text-stone-900">R$ {tableTotal.toFixed(2)}</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button 
                        onClick={() => setShowMenuModal(selectedTable === 'counter' ? 'counter' : selectedTable!.id)}
                        className="flex-1 bg-stone-900 text-white py-4 rounded-full font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <PlusCircle size={18} /> {selectedTable === 'counter' ? 'Novo Pedido Balcão' : 'Novo Pedido'}
                      </button>
                      
                      {tableOrders.length > 0 && (
                        <button 
                          onClick={() => handlePrintReceipt(selectedTable === 'counter' ? 'Balcão' : `Mesa ${selectedTable.number}`, tableOrders, tableTotal)}
                          className="flex-1 bg-amber-50 text-amber-700 border border-amber-200/50 py-4 rounded-full font-bold text-sm hover:bg-amber-100 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Printer size={18} /> Comprovante
                        </button>
                      )}
                    </div>
                    
                    <button 
                      onClick={closeBill}
                      className={cn(
                        "w-full py-4 rounded-full font-bold text-base transition-all shadow-xl flex items-center justify-center gap-2",
                        tableOrders.length > 0 
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100" 
                          : "bg-stone-200 text-stone-600 hover:bg-stone-300 shadow-stone-100"
                      )}
                    >
                      {tableOrders.length > 0 ? (
                        <>
                          <CheckCircle2 size={22} /> {selectedTable === 'counter' ? 'Fechar Todos os Pedidos do Balcão' : 'Fechar Conta'}
                        </>
                      ) : (
                        <>
                          <X size={22} /> {selectedTable === 'counter' ? 'Fechar Janela' : 'Liberar Mesa'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold italic">Conta Fechada!</h3>
                <p className="text-stone-500 text-sm">Resumo: {showReceipt.tableNumber === 'Balcão' ? 'Balcão' : `Mesa ${showReceipt.tableNumber}`}</p>
              </div>

              <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {showReceipt.orders.map(order => (
                  <div key={order.id} className="border-b border-stone-100 pb-4 last:border-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Pedido #{order.id}</p>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-stone-600">{item.quantity}x {item.name}</span>
                          <span className="font-bold text-stone-900">R$ {(item.price_at_time * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-6 border-t-2 border-stone-900 flex justify-between items-center mb-8">
                <span className="text-lg font-bold uppercase tracking-widest">Total Pago</span>
                <span className="text-3xl font-bold text-stone-900">R$ {showReceipt.total.toFixed(2)}</span>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => handlePrintReceipt(showReceipt.tableNumber === 'Balcão' ? 'Balcão' : `Mesa ${showReceipt.tableNumber}`, showReceipt.orders, showReceipt.total)}
                  className="flex-1 border-2 border-stone-950 text-stone-950 py-4 rounded-full font-bold text-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer size={18} /> Imprimir
                </button>
                <button 
                  onClick={() => setShowReceipt(null)}
                  className="flex-1 bg-stone-900 text-white py-4 rounded-full font-bold text-sm hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showMenuModal !== null && (
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            <CustomerMenu 
              initialTableId={showMenuModal} 
              onClose={() => {
                setShowMenuModal(null);
              }} 
            />
          </div>
        )}
      </AnimatePresence>

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrModalTable && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative text-center overflow-hidden"
            >
              <button 
                onClick={() => setQrModalTable(null)}
                className="absolute top-6 right-6 text-stone-400 hover:text-stone-900 transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-full">
                  QR Code de Mesa
                </span>
                <h3 className="text-3xl font-bold italic mt-3 text-stone-900">Mesa {qrModalTable.number}</h3>
              </div>

              <div className="bg-stone-50 p-6 rounded-[32px] border border-stone-100 shadow-inner flex items-center justify-center mx-auto w-60 h-60 mb-6">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?table=${qrModalTable.number}`)}`}
                  alt={`QR Code Mesa ${qrModalTable.number}`}
                  className="w-full h-full object-contain"
                />
              </div>

              <p className="text-stone-500 text-[11px] mb-8 leading-relaxed max-w-xs mx-auto">
                Aponte a câmera para abrir esta mesa de forma rápida e segura no seu dispositivo de atendimento.
              </p>

              <div className="space-y-3">
                <button 
                  onClick={() => {
                    handleTableClick(qrModalTable);
                    setQrModalTable(null);
                  }}
                  className="w-full bg-stone-900 text-white py-4 rounded-full font-bold text-sm hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <TableIcon size={18} /> Abrir no Painel
                </button>
                
                <button 
                  onClick={() => {
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(`${window.location.origin}${window.location.pathname}?table=${qrModalTable.number}`)}`;
                    printHtml(`QR Code - Mesa ${qrModalTable.number}`, `
                      <html>
                        <head>
                          <title>QR Code - Mesa ${qrModalTable.number}</title>
                          <style>
                            body { font-family: sans-serif; text-align: center; padding: 40px; color: #1c1917; }
                            .card { border: 3px solid #1c1917; padding: 40px; border-radius: 20px; display: inline-block; max-width: 320px; }
                            h1 { font-family: serif; font-size: 2.2em; margin: 0 0 5px 0; font-style: italic; font-weight: bold; }
                            p { font-size: 0.9em; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 20px; }
                            .table-num { font-size: 1.8em; font-weight: 900; margin-top: 15px; }
                            .instructions { font-size: 0.75em; color: #a8a29e; margin-top: 15px; text-transform: uppercase; letter-spacing: 1px; }
                          </style>
                        </head>
                        <body>
                          <div class="card">
                            <h1>Ponto Certo</h1>
                            <p>Comida Caseira</p>
                            <img src="${qrUrl}" style="width: 240px; height: 240px;" />
                            <div class="table-num">MESA ${qrModalTable.number}</div>
                            <div class="instructions">Escaneie o QR Code com<br/>a câmera do seu celular</div>
                          </div>
                          <script>
                            window.onload = () => {
                              window.print();
                              setTimeout(() => window.close(), 500);
                            };
                          </script>
                        </body>
                      </html>
                    `);
                  }}
                  className="w-full bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-200 py-4 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Printer size={18} /> Imprimir QR Code de Mesa
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App Components ---

const AddonManagement = () => {
  const [addons, setAddons] = useState<Addon[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [editingAddon, setEditingAddon] = useState<Addon | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'addons'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Addon));
      setAddons(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'addons');
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const addonData = { name, price: parseFloat(price) };
      if (editingAddon) {
        await updateDoc(doc(db, 'addons', editingAddon.id), addonData);
      } else {
        await addDoc(collection(db, 'addons'), addonData);
      }
      cancelEdit();
    } catch (err) {
      handleFirestoreError(err, editingAddon ? OperationType.UPDATE : OperationType.CREATE, editingAddon ? `addons/${editingAddon.id}` : 'addons');
    }
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

  const deleteAddon = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Remover este adicional?')) {
      try {
        await deleteDoc(doc(db, 'addons', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `addons/${id}`);
      }
    }
  };

  const handleClearMenu = async () => {
    if (!confirm('ATENÇÃO: Isso apagará TODOS os produtos e adicionais cadastrados, além de todos os pedidos existentes. Esta ação não pode ser desfeita. Deseja continuar?')) return;
    
    try {
      const batch = writeBatch(db);
      
      const itemsSnap = await getDocs(collection(db, 'items'));
      itemsSnap.forEach(d => batch.delete(d.ref));
      
      const addonsSnap = await getDocs(collection(db, 'addons'));
      addonsSnap.forEach(d => batch.delete(d.ref));
      
      const ordersSnap = await getDocs(collection(db, 'orders'));
      ordersSnap.forEach(d => batch.delete(d.ref));
      
      await batch.commit();
      alert('Cardápio limpo com sucesso!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'clear-menu-addons');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold font-serif italic">Gestão de Adicionais</h2>
        <button 
          onClick={handleClearMenu}
          className="bg-red-50 text-red-600 px-6 py-2 rounded-full flex items-center gap-2 hover:bg-red-100 transition-colors text-sm font-bold border border-red-100"
        >
          <Trash2 size={18} /> Apagar Tudo
        </button>
      </div>
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
    </div>
  );
};

const DeliveryManagement = ({ allOrders = [] }: { allOrders?: Order[] }) => {
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState<{
    orders: Order[];
    total: number;
  } | null>(null);

  useEffect(() => {
    if (allOrders.length > 0) return;
    setLoading(true);
    const q = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setLocalOrders(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [allOrders.length]);

  const sourceOrders = allOrders.length > 0 ? allOrders : localOrders;

  const orders = useMemo(() => {
    return sourceOrders
      .filter(o => 
        (o.type === 'delivery' || o.table_id === -2 || String(o.table_id) === '-2') && 
        o.status !== 'paid' && 
        o.status !== 'canceled'
      )
      .sort((a, b) => {
        if (a.status !== b.status) {
          return a.status.localeCompare(b.status);
        }
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [sourceOrders]);

  const closeAll = async () => {
    if (orders.length === 0) return;
    if (!confirm('Deseja fechar todas as contas de delivery?')) return;
    
    try {
      const total = orders.reduce((sum, o) => sum + o.total_price, 0);
      const ordersToReceipt = [...orders];

      const batch = writeBatch(db);
      orders.forEach(order => {
        batch.update(doc(db, 'orders', order.id), { status: 'paid' });
      });
      await batch.commit();
      
      setShowReceipt({ orders: ordersToReceipt, total });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'close-all-delivery');
    }
  };

  const cancelOrder = async (id: string) => {
    if (!confirm('Cancelar este pedido de delivery?')) return;
    try {
      await updateDoc(doc(db, 'orders', id), { status: 'canceled' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const closeOrder = async (order: Order) => {
    if (!confirm(`Fechar pedido #${order.id}?`)) return;
    try {
      await updateDoc(doc(db, 'orders', order.id), { status: 'paid' });
      setShowReceipt({ orders: [order], total: order.total_price });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="bg-stone-900 p-3 rounded-2xl text-white">
            <Truck size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Gestão de Delivery</h3>
            <p className="text-stone-500 text-sm">{orders.length} pedidos ativos</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowMenuModal(true)}
            className="bg-stone-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-stone-800 transition-colors"
          >
            <Plus size={20} /> Novo Pedido Delivery
          </button>
          <button 
            onClick={closeAll}
            disabled={orders.length === 0}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle2 size={20} /> Fechar Todos
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-stone-400">Carregando...</div>
        ) : orders.length === 0 ? (
          <div className="col-span-full py-20 text-center text-stone-400 bg-white rounded-3xl border border-dashed border-stone-200">
            Nenhum pedido de delivery ativo.
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Pedido #{order.id}</p>
                  <p className="text-xs text-stone-500">{new Date(order.created_at).toLocaleTimeString()}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                  order.status === 'pending' ? "bg-yellow-100 text-yellow-700" :
                  order.status === 'preparing' ? "bg-blue-100 text-blue-700" :
                  "bg-emerald-100 text-emerald-700"
                )}>
                  {order.status}
                </span>
              </div>

              {order.delivery_info && (
                <div className="bg-stone-50 p-3 rounded-2xl space-y-1 border border-stone-100">
                  <div className="flex items-center gap-2 text-stone-900">
                    <Users size={12} className="text-stone-400" />
                    <p className="text-xs font-bold">{order.delivery_info.name || 'Cliente'}</p>
                  </div>
                  <div className="flex items-center gap-2 text-stone-600">
                    <Truck size={12} className="text-stone-400" />
                    <p className="text-[10px] leading-tight">{order.delivery_info.address || 'Endereço não informado'}</p>
                  </div>
                  {order.delivery_info.phone && (
                    <p className="text-[10px] text-stone-400 ml-5">{order.delivery_info.phone}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-stone-600">{item.quantity}x {item.name}</span>
                    <span className="font-bold">R$ {(item.price_at_time * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
                <span className="font-bold text-lg">R$ {order.total_price.toFixed(2)}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePrint(order)}
                    className="bg-stone-50 text-stone-600 hover:bg-stone-100 p-2 rounded-lg transition-colors"
                    title="Imprimir Pedido"
                  >
                    <Printer size={18} />
                  </button>
                  <button 
                    onClick={() => closeOrder(order)}
                    className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 p-2 rounded-lg transition-colors"
                    title="Fechar Pedido"
                  >
                    <CheckCircle2 size={18} />
                  </button>
                  <button 
                    onClick={() => cancelOrder(order.id)}
                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Cancelar Pedido"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showMenuModal && (
          <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
            <CustomerMenu 
              initialTableId={-2} 
              onClose={() => {
                setShowMenuModal(false);
              }} 
            />
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceipt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-2xl font-bold italic">Delivery Fechado!</h3>
                <p className="text-stone-500 text-sm">Resumo de Vendas Delivery</p>
              </div>
              <div className="pt-6 border-t-2 border-stone-900 flex justify-between items-center mb-8">
                <span className="text-lg font-bold uppercase tracking-widest">Total Pago</span>
                <span className="text-3xl font-bold text-stone-900">R$ {showReceipt.total.toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => handlePrintReceipt('DELIVERY', showReceipt.orders, showReceipt.total)}
                  className="flex-1 border-2 border-stone-950 text-stone-950 py-4 rounded-full font-bold text-sm hover:bg-stone-50 transition-all flex items-center justify-center gap-1.5"
                >
                  <Printer size={18} /> Imprimir
                </button>
                <button 
                  onClick={() => setShowReceipt(null)}
                  className="flex-1 bg-stone-900 text-white py-4 rounded-full font-bold text-sm hover:bg-stone-800 transition-all shadow-xl shadow-stone-200"
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminPanel = ({ onViewChange, currentUser }: { onViewChange: (view: 'customer' | 'admin' | 'kitchen') => void; currentUser?: any }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'menu' | 'employees' | 'tables' | 'addons' | 'delivery' | 'reports' | 'customers'>('dashboard');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<{ id: string; title: string; total: number; type: string } | null>(null);
  const [selectedTableForManagement, setSelectedTableForManagement] = useState<Table | 'counter' | null>(null);

  const initialLoadRef = useRef(true);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  const playAdminChime = () => {
    if (!audioEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      osc2.frequency.setValueAtTime(659.25, now + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 0.35);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.5);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('Admin chime audio error:', e);
    }
  };

  useEffect(() => {
    // 1. High-priority listener for all active orders
    const qActive = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'preparing', 'ready', 'delivered'])
    );

    // 2. Recent orders for dashboard metrics and history
    const qRecent = query(
      collection(db, 'orders'),
      orderBy('created_at', 'desc'),
      limit(100)
    );

    let activeMap = new Map<string, Order>();
    let recentMap = new Map<string, Order>();

    const mergeAndSetOrders = () => {
      const merged = new Map<string, Order>();
      recentMap.forEach((ord, id) => merged.set(id, ord));
      activeMap.forEach((ord, id) => merged.set(id, ord));
      const list = Array.from(merged.values()).sort(
        (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
      setOrders(list);
    };

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      const currentMap = new Map<string, Order>();
      let latestPending: Order | null = null;

      snapshot.docs.forEach(d => {
        const ord = { id: d.id, ...d.data() } as Order;
        currentMap.set(d.id, ord);
      });

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        snapshot.docs.forEach(d => knownOrderIdsRef.current.add(d.id));
      } else {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const ord = { id: change.doc.id, ...change.doc.data() } as Order;
            if (!knownOrderIdsRef.current.has(ord.id) && ord.status === 'pending') {
              latestPending = ord;
            }
            knownOrderIdsRef.current.add(ord.id);
          }
        });

        if (latestPending) {
          playAdminChime();
          const p = latestPending as Order;
          const label = p.type === 'delivery' 
            ? 'Delivery' 
            : p.type === 'counter' 
              ? 'Balcão' 
              : `Mesa ${p.table_number || '?'}`;

          setNewOrderAlert({
            id: p.id,
            title: `Novo pedido recebido: ${label}`,
            total: p.total_price,
            type: p.type
          });

          setTimeout(() => setNewOrderAlert(null), 10000);
        }
      }

      activeMap = currentMap;
      mergeAndSetOrders();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    const unsubRecent = onSnapshot(qRecent, (snapshot) => {
      const currentMap = new Map<string, Order>();
      snapshot.docs.forEach(d => {
        const ord = { id: d.id, ...d.data() } as Order;
        currentMap.set(d.id, ord);
        knownOrderIdsRef.current.add(d.id);
      });
      recentMap = currentMap;
      mergeAndSetOrders();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });

    // Tables real-time listener
    const unsubTables = onSnapshot(query(collection(db, 'tables'), orderBy('number')), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tables');
    });

    return () => {
      unsubActive();
      unsubRecent();
      unsubTables();
    };
  }, [audioEnabled]);

  const pendingOrdersCount = orders.filter(o => o.status === 'pending').length;
  
  const activeTablesCount = tables.filter(t => 
    t.status === 'occupied' || 
    orders.some(o => 
      (o.table_id === t.id || o.table_number === t.number || String(o.table_id) === String(t.number)) && 
      o.status !== 'paid' && 
      o.status !== 'canceled'
    )
  ).length;

  const activeDeliveryCount = orders.filter(o => 
    (o.type === 'delivery' || o.table_id === -2 || String(o.table_id) === '-2') && 
    o.status !== 'paid' && 
    o.status !== 'canceled'
  ).length;

  return (
    <div className="flex min-h-screen bg-stone-50">
      <aside className={cn(
        "bg-white border-r border-stone-100 p-6 flex flex-col gap-8 transition-all duration-300 relative",
        isCollapsed ? "w-24" : "w-64"
      )}>
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-10 bg-white border border-stone-100 rounded-full p-1 shadow-sm hover:bg-stone-50 transition-colors z-20"
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>

        <div className={cn("flex items-center gap-3 px-1", isCollapsed && "justify-center")}>
          <div className="w-10 h-10 bg-yellow-400 rounded-full shrink-0 flex items-center justify-center shadow-sm border border-white">
            <ChefHat size={20} className="text-stone-900" />
          </div>
          {!isCollapsed && <h1 className="font-bold text-lg tracking-tight overflow-hidden whitespace-nowrap text-stone-900">Ponto Certo</h1>}
        </div>
        
        <nav className="flex flex-col gap-2">
          <SidebarItem 
            icon={LayoutDashboard} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            collapsed={isCollapsed} 
            badge={pendingOrdersCount}
          />
          <SidebarItem 
            icon={UtensilsCrossed} 
            label="Cardápio" 
            active={activeTab === 'menu'} 
            onClick={() => setActiveTab('menu')} 
            collapsed={isCollapsed} 
          />
          <SidebarItem 
            icon={PlusCircle} 
            label="Adicionais" 
            active={activeTab === 'addons'} 
            onClick={() => setActiveTab('addons')} 
            collapsed={isCollapsed} 
          />
          <SidebarItem 
            icon={Users} 
            label="Funcionários" 
            active={activeTab === 'employees'} 
            onClick={() => setActiveTab('employees')} 
            collapsed={isCollapsed} 
          />
          <SidebarItem 
            icon={TableIcon} 
            label="Mesas" 
            active={activeTab === 'tables'} 
            onClick={() => setActiveTab('tables')} 
            collapsed={isCollapsed} 
            badge={activeTablesCount}
          />
          <SidebarItem 
            icon={Truck} 
            label="Delivery" 
            active={activeTab === 'delivery'} 
            onClick={() => setActiveTab('delivery')} 
            collapsed={isCollapsed} 
            badge={activeDeliveryCount}
          />
          <SidebarItem 
            icon={FileText} 
            label="Relatórios" 
            active={activeTab === 'reports'} 
            onClick={() => setActiveTab('reports')} 
            collapsed={isCollapsed} 
          />
          <SidebarItem 
            icon={UserCheck} 
            label="Clientes (Fiado)" 
            active={activeTab === 'customers'} 
            onClick={() => setActiveTab('customers')} 
            collapsed={isCollapsed} 
          />
          
          <div className="my-4 border-t border-stone-100 pt-4">
            <SidebarItem icon={ChefHat} label="Painel Cozinha" active={false} onClick={() => onViewChange('kitchen')} collapsed={isCollapsed} />
          </div>
        </nav>
      </aside>

      <main className="flex-1 p-10 overflow-y-auto">
        {/* Floating Real-Time New Order Notification Banner */}
        <AnimatePresence>
          {newOrderAlert && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="mb-6 p-4 rounded-2xl bg-amber-500 text-stone-900 shadow-xl flex items-center justify-between gap-4 border border-amber-400"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-stone-900 text-amber-400 rounded-xl flex items-center justify-center animate-bounce">
                  <Bell size={20} />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-wide">{newOrderAlert.title}</p>
                  <p className="text-xs font-semibold text-stone-900/80">Valor Total: R$ {newOrderAlert.total.toFixed(2)} • Chegou agora</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (newOrderAlert.type === 'delivery') {
                      setActiveTab('delivery');
                    } else if (newOrderAlert.type === 'counter') {
                      setSelectedTableForManagement('counter');
                      setActiveTab('tables');
                    } else if (newOrderAlert.type === 'table') {
                      setActiveTab('tables');
                    } else {
                      setActiveTab('dashboard');
                    }
                    setNewOrderAlert(null);
                  }}
                  className="bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-stone-800 transition-all shadow-md"
                >
                  Ver Pedido
                </button>
                <button
                  onClick={() => setNewOrderAlert(null)}
                  className="p-2 text-stone-900 hover:bg-black/10 rounded-xl transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <header className="mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h2 className="text-3xl font-bold text-stone-900">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'menu' && 'Gerenciar Itens'}
              {activeTab === 'addons' && 'Adicionais'}
              {activeTab === 'employees' && 'Equipe'}
              {activeTab === 'tables' && 'Salão'}
              {activeTab === 'delivery' && 'Delivery'}
              {activeTab === 'reports' && 'Relatórios'}
              {activeTab === 'customers' && 'Cadastro de Clientes'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-stone-500 text-sm">Painel de controle em tempo real.</p>
              <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sincronizado
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const next = !audioEnabled;
                setAudioEnabled(next);
                if (next) playAdminChime();
              }}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all",
                audioEnabled 
                  ? "bg-stone-900 text-white border-stone-900" 
                  : "bg-white text-stone-500 border-stone-200 hover:text-stone-900"
              )}
              title={audioEnabled ? 'Desativar avisos sonoros de novos pedidos' : 'Ativar avisos sonoros'}
            >
              {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hidden md:inline">{audioEnabled ? 'Som Ativado' : 'Mudo'}</span>
            </button>

            <div className="text-right">
              <p className="text-sm font-bold">{currentUser?.displayName || currentUser?.email || 'Admin User'}</p>
              <p className="text-xs text-stone-400">Gerente</p>
            </div>
            <div className="w-10 h-10 bg-stone-200 rounded-full flex items-center justify-center font-bold text-stone-600 uppercase">
              {(currentUser?.email || 'A')[0]}
            </div>
          </div>
        </header>

        {activeTab === 'dashboard' && <AdminDashboard orders={orders} />}
        {activeTab === 'menu' && <MenuManagement />}
        {activeTab === 'addons' && <AddonManagement />}
        {activeTab === 'employees' && <EmployeeManagement />}
        {activeTab === 'tables' && (
          <TableManagement 
            tables={tables} 
            allOrders={orders} 
            initialSelectedTable={selectedTableForManagement} 
            onSelectTable={setSelectedTableForManagement} 
          />
        )}
        {activeTab === 'delivery' && <DeliveryManagement allOrders={orders} />}
        {activeTab === 'reports' && <ReportsManagement currentUser={currentUser} isAdmin={true} printHtml={printHtml} />}
        {activeTab === 'customers' && <CustomersManagement currentUser={currentUser} isAdmin={true} printHtml={printHtml} />}
      </main>
    </div>
  );
};

const KitchenOrderCard = ({ order, kitchenTab, updateStatus, deleteOrder }: { 
  order: Order, 
  kitchenTab: 'active' | 'history', 
  updateStatus: (id: string, status: string) => void, 
  deleteOrder: (id: string) => void
}) => {
  const orderDate = parseOrderDate(order.created_at);
  const minutesElapsed = Math.max(0, Math.floor((Date.now() - orderDate.getTime()) / 60000));
  
  const rawStatus = (order.status || 'pending').toLowerCase();
  const isPending = rawStatus === 'pending' || rawStatus === 'pendente';
  const isPreparing = rawStatus === 'preparing' || rawStatus === 'preparando' || rawStatus === 'em preparo';
  const isReady = rawStatus === 'ready' || rawStatus === 'pronto';
  const isDelivered = rawStatus === 'delivered' || rawStatus === 'entregue' || rawStatus === 'paid' || rawStatus === 'pago';

  const isDelivery = order.type === 'delivery' || !!order.delivery_info || order.table_id === -2 || String(order.table_id) === '-2';
  const isCounter = !isDelivery && (order.type === 'counter' || order.table_id === 'counter' || String(order.table_id) === 'counter');
  const orderType = isDelivery ? 'delivery' : (isCounter ? 'counter' : 'table');

  const safeShortId = (order.id || '').length > 4 ? (order.id || '').slice(-4).toUpperCase() : (order.id || '0000').toUpperCase();
  const safeItems = order.items || [];

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "bg-stone-850 bg-stone-900/90 rounded-3xl p-6 border flex flex-col h-full transition-all shadow-xl backdrop-blur-sm",
        isReady ? "border-blue-500/60 shadow-blue-500/10 shadow-xl ring-1 ring-blue-500/30" : 
        (isPreparing ? "border-amber-500/50 shadow-amber-500/10 ring-1 ring-amber-500/20" : 
        (isPending ? "border-emerald-500/40 shadow-emerald-500/5" : "border-stone-800")),
        (isDelivered || rawStatus === 'canceled' || rawStatus === 'cancelado') && "opacity-60 bg-stone-900/50"
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
              isDelivery ? "bg-emerald-500/20 text-emerald-400" :
              (isCounter ? "bg-cyan-500/20 text-cyan-400" : "bg-stone-800 text-stone-400")
            )}>
              {isDelivery ? 'Delivery' : (isCounter ? 'Balcão' : 'Mesa')}
            </span>

            {/* Elapsed Time Badge */}
            {!isDelivered && (
              minutesElapsed < 10 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-800 text-stone-300">
                  Há {minutesElapsed}m
                </span>
              ) : minutesElapsed < 25 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Há {minutesElapsed}m
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse flex items-center gap-1">
                  <Clock size={10} /> Atrasado • {minutesElapsed}m
                </span>
              )
            )}
          </div>

          <p className={cn(
            "text-2xl lg:text-3xl font-black tracking-tight",
            isDelivery ? "text-emerald-400" : (isCounter ? "text-cyan-400" : "text-white")
          )}>
            {isDelivery 
              ? (order.delivery_info?.name || 'Cliente Delivery') 
              : (isCounter 
                  ? (order.delivery_info?.name ? `Balcão • ${order.delivery_info.name}` : 'Balcão') 
                  : `Mesa ${order.table_number || order.table_id || 'Mesa'}`)}
          </p>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">#{safeShortId}</span>
            {kitchenTab === 'history' && (
              <button 
                onClick={() => deleteOrder(order.id)}
                className="text-red-400/80 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-stone-800"
                title="Excluir Pedido"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-stone-400 font-mono font-medium">
              {orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {kitchenTab === 'history' && (
              <span className="text-[10px] text-stone-500">
                {orderDate.toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Delivery details if present */}
      {isDelivery && order.delivery_info && (
        <div className="mb-4 bg-stone-950/60 p-3 rounded-2xl border border-stone-800 space-y-1">
          <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
            <Truck size={13} /> {order.delivery_info.name}
          </p>
          {order.delivery_info.address && (
            <p className="text-[11px] text-stone-300 leading-snug">{order.delivery_info.address}</p>
          )}
          {order.delivery_info.phone && (
            <p className="text-[10px] text-stone-400 font-mono">{order.delivery_info.phone}</p>
          )}
        </div>
      )}

      {/* Items list */}
      <div className="flex-1 space-y-2.5 mb-6 overflow-y-auto max-h-72 pr-1 custom-scrollbar">
        {safeItems.map((item, idx) => (
          <div key={idx} className="bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <p className="font-bold text-stone-100 text-sm leading-tight">{item.name || 'Item do Cardápio'}</p>
                {item.observation && (
                  <div className="flex items-center gap-1.5 mt-1.5 bg-amber-500/10 px-2 py-1 rounded-lg w-fit border border-amber-500/20">
                    <Info size={12} className="text-amber-400 shrink-0" />
                    <p className="text-[11px] text-amber-300 font-medium italic">{item.observation}</p>
                  </div>
                )}
                {item.addons && item.addons.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.addons.map((a, aidx) => (
                      <span key={aidx} className="text-[9px] bg-emerald-500/10 text-emerald-300 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider border border-emerald-500/20">
                        + {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="bg-emerald-500 text-stone-950 px-2 py-0.5 rounded-lg text-xs font-black shrink-0">
                {item.quantity || 1}x
              </span>
            </div>
          </div>
        ))}
        {safeItems.length === 0 && (
          <p className="text-xs text-stone-500 italic text-center py-4">Nenhum item discriminado.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="space-y-2 pt-2 border-t border-stone-800/60 mt-auto">
        <div className="flex gap-2">
          {isPending && (
            <button 
              onClick={() => updateStatus(order.id, 'preparing')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 text-sm active:scale-95"
            >
              <ChefHat size={18} /> Iniciar Preparo
            </button>
          )}

          {isPreparing && (
            <>
              <button 
                onClick={() => updateStatus(order.id, 'ready')}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-950/40 text-sm active:scale-95"
              >
                <CheckCircle2 size={18} /> Pronto
              </button>
              <button 
                onClick={() => updateStatus(order.id, 'pending')}
                className="bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white p-3 rounded-xl transition-all"
                title="Voltar para Pendente"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}

          {isReady && (
            <>
              <button 
                onClick={() => updateStatus(order.id, 'delivered')}
                className="flex-1 bg-white hover:bg-stone-100 text-stone-900 py-3 px-4 rounded-xl font-black transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider active:scale-95 shadow-xl"
              >
                <CheckCircle2 size={18} /> Entregar Pedido
              </button>
              <button 
                onClick={() => updateStatus(order.id, 'preparing')}
                className="bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white p-3 rounded-xl transition-all"
                title="Voltar para Em Preparo"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}

          {isDelivered && (
            <div className="flex-1 bg-stone-800/60 text-stone-400 py-3 rounded-xl font-bold text-center text-xs uppercase tracking-widest border border-stone-800">
              Entregue / Concluído
            </div>
          )}

          <button 
            onClick={() => handlePrint(order)}
            className="bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white p-3 rounded-xl transition-all shrink-0 active:scale-95"
            title="Imprimir Comanda"
          >
            <Printer size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const KitchenPanel = ({ onViewChange }: { onViewChange: (view: 'customer' | 'admin' | 'kitchen') => void }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [kitchenTab, setKitchenTab] = useState<'active' | 'history'>('active');
  const [historyFilter, setHistoryFilter] = useState<'day' | 'week'>('day');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'preparing' | 'ready'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'table' | 'counter' | 'delivery'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showNotification, setShowNotification] = useState(false);
  const [latestNewOrder, setLatestNewOrder] = useState<Order | null>(null);
  const [syncStatus, setSyncStatus] = useState<'connected' | 'reconnecting' | 'error'>('connected');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  const [refreshTick, setRefreshTick] = useState(0);

  const [audioEnabled, setAudioEnabled] = useState(() => {
    try {
      return localStorage.getItem('kitchen_audio_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioEnabledRef = useRef(audioEnabled);
  const audioContextRef = useRef<AudioContext | null>(null);
  const initialLoadRef = useRef(true);
  const knownOrderIdsRef = useRef<Set<string>>(new Set());

  // Timer tick every 15s to update "Há X min" elapsed badges live
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    try {
      localStorage.setItem('kitchen_audio_enabled', String(audioEnabled));
    } catch {}
  }, [audioEnabled]);

  // Audio synthesizer chime using Web Audio API (instant, works 100% offline & in PWA)
  const getOrCreateAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      return audioContextRef.current;
    } catch {
      return null;
    }
  };

  const unlockAudio = async () => {
    try {
      const ctx = getOrCreateAudioContext();
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
      setAudioUnlocked(true);
      playInstantChime();
    } catch (e) {
      console.warn('Audio unlock warning:', e);
    }
  };

  const playInstantChime = () => {
    try {
      const ctx = getOrCreateAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;

      // Note 1: 784 Hz (G5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: 1046.5 Hz (C6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.16);
      gain2.gain.setValueAtTime(0.4, now + 0.16);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.7);

      // Note 3: 1318.5 Hz (E6)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'triangle';
      osc3.frequency.setValueAtTime(1318.51, now + 0.32);
      gain3.gain.setValueAtTime(0.45, now + 0.32);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.32);
      osc3.stop(now + 1.2);
    } catch (e) {
      console.warn('Web Audio error:', e);
    }
  };

  // User gesture listener to automatically unlock audio on any touch/click
  useEffect(() => {
    const handleGesture = () => {
      unlockAudio();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
    window.addEventListener('click', handleGesture, { once: true });
    window.addEventListener('touchstart', handleGesture, { once: true });
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  const triggerOrderAlert = (order: Order) => {
    setLatestNewOrder(order);
    setShowNotification(true);

    if (audioEnabledRef.current) {
      playInstantChime();
    }

    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([250, 100, 250, 100, 400]);
      } catch {}
    }

    setTimeout(() => setShowNotification(false), 8000);
  };

  // High-performance real-time listener:
  // 1. Dedicated query for active kitchen orders (pending, pendente, preparing, preparando, ready, pronto)
  // 2. Query for recent orders (limit 80) for history view with fallback
  useEffect(() => {
    setSyncStatus('reconnecting');
    const qActive = query(
      collection(db, 'orders'),
      where('status', 'in', ['pending', 'pendente', 'preparing', 'preparando', 'ready', 'pronto'])
    );

    let activeMap = new Map<string, Order>();
    let recentMap = new Map<string, Order>();

    const mergeAndSetOrders = () => {
      const mergedMap = new Map<string, Order>();
      // First populate recent orders
      recentMap.forEach((ord, id) => mergedMap.set(id, ord));
      // Then ensure all active orders take precedence and are included
      activeMap.forEach((ord, id) => mergedMap.set(id, ord));

      const allOrders = Array.from(mergedMap.values()).sort(
        (a, b) => parseOrderDate(b.created_at).getTime() - parseOrderDate(a.created_at).getTime()
      );
      setOrders(allOrders);
      setSyncStatus('connected');
      setSyncError(null);
      setLastSync(new Date());
    };

    const unsubActive = onSnapshot(qActive, (snapshot) => {
      const currentMap = new Map<string, Order>();
      let newlyArrivedPending: Order | null = null;

      snapshot.docs.forEach(d => {
        const order = { id: d.id, ...d.data() } as Order;
        currentMap.set(d.id, order);
      });

      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        snapshot.docs.forEach(d => knownOrderIdsRef.current.add(d.id));
      } else {
        snapshot.docChanges().forEach(change => {
          if (change.type === 'added') {
            const order = { id: change.doc.id, ...change.doc.data() } as Order;
            const st = (order.status || '').toLowerCase();
            if (!knownOrderIdsRef.current.has(order.id) && (st === 'pending' || st === 'pendente')) {
              newlyArrivedPending = order;
            }
            knownOrderIdsRef.current.add(order.id);
          }
        });
      }

      activeMap = currentMap;
      mergeAndSetOrders();

      if (newlyArrivedPending) {
        triggerOrderAlert(newlyArrivedPending);
      }
    }, (error) => {
      console.error('Kitchen active orders error:', error);
      handleFirestoreError(error, OperationType.LIST, 'orders/active');
      setSyncStatus('error');
      setSyncError('Falha ao sincronizar pedidos ativos. Verifique sua conexão.');
    });

    let unsubRecent: (() => void) | null = null;
    try {
      const qRecent = query(
        collection(db, 'orders'),
        orderBy('created_at', 'desc'),
        limit(80)
      );
      unsubRecent = onSnapshot(qRecent, (snapshot) => {
        const currentMap = new Map<string, Order>();
        snapshot.docs.forEach(d => {
          const order = { id: d.id, ...d.data() } as Order;
          currentMap.set(d.id, order);
        });
        recentMap = currentMap;
        mergeAndSetOrders();
      }, (error) => {
        console.warn('Recent query fallback without orderBy:', error);
        const qFallback = query(collection(db, 'orders'), limit(80));
        unsubRecent = onSnapshot(qFallback, (snap) => {
          const currentMap = new Map<string, Order>();
          snap.docs.forEach(d => {
            currentMap.set(d.id, { id: d.id, ...d.data() } as Order);
          });
          recentMap = currentMap;
          mergeAndSetOrders();
        }, () => {});
      });
    } catch {
      // Ignored
    }

    return () => {
      unsubActive();
      if (unsubRecent) unsubRecent();
    };
  }, [refreshTick]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await updateDoc(doc(db, 'orders', id), { status });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este pedido permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${id}`);
    }
  };

  // Helper classification to ensure NO order is lost
  const getOrderType = (o: Order): 'table' | 'counter' | 'delivery' => {
    if (o.type === 'delivery' || !!o.delivery_info || o.table_id === -2 || String(o.table_id) === '-2') {
      return 'delivery';
    }
    if (o.type === 'counter' || o.table_id === 'counter' || String(o.table_id) === 'counter') {
      return 'counter';
    }
    return 'table';
  };

  // Active orders (pending, preparing, ready)
  const activeOrders = orders.filter(o => {
    const st = (o.status || 'pending').toLowerCase();
    return st !== 'paid' && st !== 'pago' && st !== 'delivered' && st !== 'entregue' && st !== 'canceled' && st !== 'cancelado';
  });
  
  // History orders (delivered, paid, canceled)
  const historyOrders = orders.filter(o => {
    const st = (o.status || 'pending').toLowerCase();
    if (st !== 'paid' && st !== 'pago' && st !== 'delivered' && st !== 'entregue' && st !== 'canceled' && st !== 'cancelado') return false;
    const orderDate = parseOrderDate(o.created_at);
    const now = new Date();
    if (historyFilter === 'day') {
      return orderDate.toDateString() === now.toDateString();
    } else {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return orderDate >= oneWeekAgo;
    }
  });

  const baseOrders = kitchenTab === 'active' ? activeOrders : historyOrders;

  // Search and status filter application
  const displayOrders = baseOrders.filter(o => {
    // Status filter (active tab only)
    if (kitchenTab === 'active' && statusFilter !== 'all') {
      const st = (o.status || 'pending').toLowerCase();
      if (statusFilter === 'pending' && !(st === 'pending' || st === 'pendente')) return false;
      if (statusFilter === 'preparing' && !(st === 'preparing' || st === 'preparando' || st === 'em preparo')) return false;
      if (statusFilter === 'ready' && !(st === 'ready' || st === 'pronto')) return false;
    }

    // Type filter
    if (typeFilter !== 'all') {
      const oType = getOrderType(o);
      if (oType !== typeFilter) return false;
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const orderId = (o.id || '').toLowerCase();
      const tableNum = String(o.table_number || o.table_id || '').toLowerCase();
      const customerName = (o.delivery_info?.name || '').toLowerCase();
      const itemsMatch = (o.items || []).some(i => (i.name || '').toLowerCase().includes(q) || (i.observation || '').toLowerCase().includes(q));

      if (!orderId.includes(q) && !tableNum.includes(q) && !customerName.includes(q) && !itemsMatch) {
        return false;
      }
    }

    return true;
  });

  const groupedOrders = {
    table: displayOrders.filter(o => getOrderType(o) === 'table'),
    counter: displayOrders.filter(o => getOrderType(o) === 'counter'),
    delivery: displayOrders.filter(o => getOrderType(o) === 'delivery'),
  };

  const pendingCount = activeOrders.filter(o => {
    const st = (o.status || 'pending').toLowerCase();
    return st === 'pending' || st === 'pendente';
  }).length;

  const preparingCount = activeOrders.filter(o => {
    const st = (o.status || 'pending').toLowerCase();
    return st === 'preparing' || st === 'preparando' || st === 'em preparo';
  }).length;

  const readyCount = activeOrders.filter(o => {
    const st = (o.status || 'pending').toLowerCase();
    return st === 'ready' || st === 'pronto';
  }).length;

  return (
    <div className="min-h-screen bg-stone-950 text-white p-4 sm:p-8 relative overflow-x-hidden font-sans">
      {/* Autoplay Unlock Notice Banner */}
      {!audioUnlocked && audioEnabled && (
        <div 
          onClick={unlockAudio}
          className="cursor-pointer bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white px-4 py-2.5 rounded-2xl mb-6 flex items-center justify-between shadow-lg shadow-emerald-950/50 border border-emerald-400/40 animate-pulse transition-transform hover:scale-[1.01]"
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <Volume2 size={20} className="animate-bounce" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold">Toque aqui para liberar o alarme sonoro da cozinha</p>
              <p className="text-[11px] text-emerald-100">Necessário para tocar quando chegarem novos pedidos</p>
            </div>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); unlockAudio(); }}
            className="bg-white text-stone-900 px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md hover:bg-stone-100 shrink-0 ml-3"
          >
            Liberar Som
          </button>
        </div>
      )}

      {/* Floating New Order Alert Banner */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-emerald-400 max-w-lg w-[90%]"
          >
            <div className="bg-white/20 p-3 rounded-full animate-bounce shrink-0">
              <Bell size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-base sm:text-lg">Novo Pedido Recebido!</p>
              <p className="text-xs text-emerald-100 font-medium truncate">
                {latestNewOrder 
                  ? (getOrderType(latestNewOrder) === 'table' 
                      ? `Mesa ${latestNewOrder.table_number || latestNewOrder.table_id || ''} • Total: R$ ${(latestNewOrder.total_price || 0).toFixed(2)}` 
                      : getOrderType(latestNewOrder) === 'counter' 
                        ? `Balcão • Total: R$ ${(latestNewOrder.total_price || 0).toFixed(2)}` 
                        : `Delivery: ${latestNewOrder.delivery_info?.name || 'Cliente'} • R$ ${(latestNewOrder.total_price || 0).toFixed(2)}`)
                  : 'Verifique a lista de pedidos ativos.'}
              </p>
            </div>
            <button onClick={() => setShowNotification(false)} className="hover:bg-white/10 p-1.5 rounded-lg shrink-0">
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => onViewChange('admin')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-800 bg-stone-900 text-stone-300 hover:text-white hover:border-stone-700 transition-all text-xs font-bold uppercase tracking-wider"
          >
            <LayoutDashboard size={16} />
            <span>Painel Admin</span>
          </button>
          
          <div className="flex items-center gap-3.5">
            <div className="bg-emerald-500 p-3 rounded-2xl shadow-lg shadow-emerald-950/40">
              <ChefHat size={30} className="text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Cozinha</h1>
                <span className="bg-stone-800 text-emerald-400 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                  KDS Live
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  syncStatus === 'connected' ? "bg-emerald-500 animate-pulse" : (syncStatus === 'reconnecting' ? "bg-amber-500 animate-spin" : "bg-red-500")
                )} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-stone-400">
                  {syncStatus === 'connected' ? 'Sincronizado em tempo real' : (syncStatus === 'reconnecting' ? 'Reconectando...' : 'Erro de conexão')}
                </span>
                <span className="text-[10px] text-stone-600 font-mono">
                  • {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls & Sound */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Refresh button */}
          <button 
            onClick={() => setRefreshTick(t => t + 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:border-stone-700 transition-all text-xs font-bold"
            title="Recarregar pedidos"
          >
            <RefreshCw size={14} className={syncStatus === 'reconnecting' ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Audio toggle & test */}
          <div className="flex items-center bg-stone-900 p-1 rounded-xl border border-stone-800">
            <button 
              onClick={() => {
                const nextState = !audioEnabled;
                setAudioEnabled(nextState);
                if (nextState) {
                  unlockAudio();
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                audioEnabled ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "text-stone-500 hover:text-stone-300"
              )}
            >
              {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              {audioEnabled ? 'Som Ativo' : 'Som Mudo'}
            </button>
            {audioEnabled && (
              <button 
                onClick={playInstantChime}
                className="px-2.5 py-1.5 text-[10px] font-bold text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors ml-1 uppercase"
                title="Tocar teste de som"
              >
                Testar
              </button>
            )}
          </div>

          {/* Active / History Switch */}
          <div className="flex bg-stone-900 p-1 rounded-xl border border-stone-800">
            <button 
              onClick={() => setKitchenTab('active')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                kitchenTab === 'active' ? "bg-stone-800 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"
              )}
            >
              <span>Ativos</span>
              <span className={cn(
                "px-1.5 py-0.2 rounded-md text-[10px] font-mono",
                activeOrders.length > 0 ? "bg-emerald-500 text-stone-950 font-black" : "bg-stone-800 text-stone-400"
              )}>
                {activeOrders.length}
              </span>
            </button>
            <button 
              onClick={() => setKitchenTab('history')}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                kitchenTab === 'history' ? "bg-stone-800 text-white shadow-sm" : "text-stone-500 hover:text-stone-300"
              )}
            >
              Histórico
            </button>
          </div>
          
          {kitchenTab === 'history' && (
            <div className="flex bg-stone-900 p-1 rounded-xl border border-stone-800">
              <button 
                onClick={() => setHistoryFilter('day')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  historyFilter === 'day' ? "bg-stone-700 text-white" : "text-stone-500 hover:text-stone-300"
                )}
              >
                Hoje
              </button>
              <button 
                onClick={() => setHistoryFilter('week')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  historyFilter === 'week' ? "bg-stone-700 text-white" : "text-stone-500 hover:text-stone-300"
                )}
              >
                7 Dias
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Connection error banner if any */}
      {syncError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{syncError}</span>
          </div>
          <button 
            onClick={() => setRefreshTick(t => t + 1)}
            className="bg-rose-500 text-white px-3 py-1 rounded-xl font-bold uppercase tracking-wider text-[10px]"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-stone-900/80 p-3 sm:p-4 rounded-2xl border border-stone-800/80 mb-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Sub-filters for active orders */}
        {kitchenTab === 'active' ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mr-1 hidden sm:inline">Filtro:</span>
            
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                statusFilter === 'all' ? "bg-white text-stone-950 font-black" : "bg-stone-800 text-stone-400 hover:text-white"
              )}
            >
              Todos <span className="text-[10px] font-mono opacity-70">({activeOrders.length})</span>
            </button>

            <button 
              onClick={() => setStatusFilter('pending')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                statusFilter === 'pending' ? "bg-emerald-500 text-stone-950 font-black" : "bg-stone-800 text-stone-400 hover:text-white"
              )}
            >
              Aguardando <span className="text-[10px] font-mono opacity-80">({pendingCount})</span>
            </button>

            <button 
              onClick={() => setStatusFilter('preparing')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                statusFilter === 'preparing' ? "bg-amber-500 text-stone-950 font-black" : "bg-stone-800 text-stone-400 hover:text-white"
              )}
            >
              Em Preparo <span className="text-[10px] font-mono opacity-80">({preparingCount})</span>
            </button>

            <button 
              onClick={() => setStatusFilter('ready')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
                statusFilter === 'ready' ? "bg-blue-500 text-stone-950 font-black" : "bg-stone-800 text-stone-400 hover:text-white"
              )}
            >
              Prontos <span className="text-[10px] font-mono opacity-80">({readyCount})</span>
            </button>

            <div className="h-5 w-[1px] bg-stone-800 mx-1 hidden sm:block" />

            {/* Type selector */}
            <div className="flex bg-stone-950 p-1 rounded-xl border border-stone-800">
              <button 
                onClick={() => setTypeFilter('all')}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all", typeFilter === 'all' ? "bg-stone-800 text-white" : "text-stone-500")}
              >
                Todas
              </button>
              <button 
                onClick={() => setTypeFilter('table')}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all", typeFilter === 'table' ? "bg-stone-800 text-white" : "text-stone-500")}
              >
                Mesas
              </button>
              <button 
                onClick={() => setTypeFilter('counter')}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all", typeFilter === 'counter' ? "bg-stone-800 text-white" : "text-stone-500")}
              >
                Balcão
              </button>
              <button 
                onClick={() => setTypeFilter('delivery')}
                className={cn("px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all", typeFilter === 'delivery' ? "bg-stone-800 text-white" : "text-stone-500")}
              >
                Delivery
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-400 font-bold uppercase tracking-wider flex items-center gap-2">
            <span>Histórico de Pedidos Finalizados</span>
            <span className="bg-stone-800 px-2 py-0.5 rounded text-[10px] font-mono text-stone-300">{displayOrders.length} pedidos</span>
          </div>
        )}

        {/* Search input */}
        <div className="relative min-w-[200px] md:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
          <input 
            type="text"
            placeholder="Buscar mesa, pedido, item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-emerald-500/60"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Orders View */}
      <div className="space-y-10">
        {kitchenTab === 'active' ? (
          <>
            {/* Mesas Section */}
            {groupedOrders.table.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-stone-800/80 pb-3">
                  <div className="p-1.5 rounded-lg bg-stone-800 text-stone-300">
                    <TableIcon size={18} />
                  </div>
                  <h2 className="text-base font-black uppercase tracking-wider text-stone-200">Pedidos de Mesa</h2>
                  <span className="bg-stone-800 px-2 py-0.5 rounded-md text-xs font-mono font-bold text-stone-400">{groupedOrders.table.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {groupedOrders.table.map(order => (
                      <KitchenOrderCard 
                        key={order.id} 
                        order={order} 
                        kitchenTab={kitchenTab} 
                        updateStatus={updateStatus} 
                        deleteOrder={deleteOrder} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Balcão Section */}
            {groupedOrders.counter.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-stone-800/80 pb-3">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Coffee size={18} />
                  </div>
                  <h2 className="text-base font-black uppercase tracking-wider text-cyan-300">Pedidos do Balcão</h2>
                  <span className="bg-stone-800 px-2 py-0.5 rounded-md text-xs font-mono font-bold text-stone-400">{groupedOrders.counter.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {groupedOrders.counter.map(order => (
                      <KitchenOrderCard 
                        key={order.id} 
                        order={order} 
                        kitchenTab={kitchenTab} 
                        updateStatus={updateStatus} 
                        deleteOrder={deleteOrder} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {/* Delivery Section */}
            {groupedOrders.delivery.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-3 border-b border-stone-800/80 pb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Truck size={18} />
                  </div>
                  <h2 className="text-base font-black uppercase tracking-wider text-emerald-400">Delivery & Entregas</h2>
                  <span className="bg-stone-800 px-2 py-0.5 rounded-md text-xs font-mono font-bold text-stone-400">{groupedOrders.delivery.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <AnimatePresence mode="popLayout">
                    {groupedOrders.delivery.map(order => (
                      <KitchenOrderCard 
                        key={order.id} 
                        order={order} 
                        kitchenTab={kitchenTab} 
                        updateStatus={updateStatus} 
                        deleteOrder={deleteOrder} 
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {displayOrders.length === 0 && (
              <div className="py-20 text-center text-stone-600 bg-stone-900/30 rounded-3xl border border-stone-800/50">
                <ChefHat size={56} className="mx-auto mb-4 opacity-25" />
                <p className="text-lg font-bold text-stone-400">Nenhum pedido ativo no momento.</p>
                <p className="text-xs text-stone-600 mt-1">
                  {searchQuery ? 'Tente ajustar os filtros ou o termo de busca.' : 'Novos pedidos enviados pelas mesas, balcão ou delivery aparecerão aqui instantaneamente.'}
                </p>
                {searchQuery && (
                  <button 
                    onClick={() => { setSearchQuery(''); setStatusFilter('all'); setTypeFilter('all'); }}
                    className="mt-4 px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:text-white text-xs font-bold"
                  >
                    Limpar Filtros
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {displayOrders.map(order => (
                  <KitchenOrderCard 
                    key={order.id} 
                    order={order} 
                    kitchenTab={kitchenTab} 
                    updateStatus={updateStatus} 
                    deleteOrder={deleteOrder} 
                  />
                ))}
              </AnimatePresence>
            </div>
            {displayOrders.length === 0 && (
              <div className="py-20 text-center text-stone-600 bg-stone-900/30 rounded-3xl border border-stone-800/50">
                <ChefHat size={56} className="mx-auto mb-4 opacity-25" />
                <p className="text-lg font-bold text-stone-400">Nenhum histórico encontrado para este período.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CustomerMenu = ({ initialTableId, onClose, user, onViewChange }: { initialTableId?: string | number | null, onClose?: () => void, user?: FirebaseUser | null, onViewChange?: (view: 'customer' | 'admin' | 'kitchen') => void }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | number | null>(initialTableId ?? null);
  const [cart, setCart] = useState<{
    item: Item, 
    quantity: number, 
    observation?: string, 
    selectedAddons?: Addon[]
  }[]>([]);
  const [category, setCategory] = useState<'all' | 'dish' | 'drink'>('all');
  const [orderSent, setOrderSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showCartDetails, setShowCartDetails] = useState(false);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [customizingItem, setCustomizingItem] = useState<Item | null>(null);
  const [itemObservation, setItemObservation] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [tableSearch, setTableSearch] = useState('');
  const [counterCustomerName, setCounterCustomerName] = useState('');
  const [deliveryName, setDeliveryName] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  useEffect(() => {
    if (initialTableId != null) {
      if (initialTableId === 'counter') {
        setSelectedTable('counter');
        setTableSearch('');
        return;
      }
      if (initialTableId === -2 || initialTableId === '-2' || initialTableId === 'delivery') {
        setSelectedTable(-2);
        setTableSearch('');
        return;
      }
      if (tables.length > 0) {
        if (typeof initialTableId === 'number' || !isNaN(Number(initialTableId))) {
          const num = Number(initialTableId);
          const matched = tables.find(t => t.number === num) || tables.find(t => t.id === String(initialTableId));
          if (matched) {
            setSelectedTable(matched.id);
            setTableSearch(matched.number.toString());
          }
        } else {
          const matched = tables.find(t => t.id === initialTableId) || tables.find(t => t.number.toString() === initialTableId);
          if (matched) {
            setSelectedTable(matched.id);
            setTableSearch(matched.number.toString());
          }
        }
      }
    }
  }, [initialTableId, tables]);

  useEffect(() => {
    const unsubItems = onSnapshot(query(collection(db, 'items'), orderBy('name')), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
    });
    const unsubTables = onSnapshot(query(collection(db, 'tables'), orderBy('number')), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tables');
    });
    const unsubAddons = onSnapshot(query(collection(db, 'addons'), orderBy('name')), (snapshot) => {
      setAddons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Addon)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'addons');
    });

    return () => {
      unsubItems();
      unsubTables();
      unsubAddons();
    };
  }, []);

  const handleAddToCartClick = (item: Item) => {
    setCustomizingItem(item);
    setItemObservation('');
    setSelectedAddons([]);
  };

  const confirmAddToCart = () => {
    if (!customizingItem) return;

    setCart(prev => {
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
      if (selectedTable === null) {
        alert('Por favor, selecione mesa, balcão ou delivery.');
        return;
      }
      
      if (cart.length === 0) {
        alert('Seu carrinho está vazio.');
        return;
      }

      const isDelivery = selectedTable === -2 || selectedTable === '-2' || selectedTable === 'delivery';
      const isCounter = selectedTable === 'counter';
      
      if (isDelivery && (!deliveryName.trim() || !deliveryAddress.trim())) {
        alert('Por favor, preencha seu nome e endereço para entrega.');
        return;
      }
      
      setIsSending(true);
      try {
        let table: Table | null = null;
        if (!isDelivery && !isCounter && selectedTable != null) {
          table = tables.find(t => t.id === String(selectedTable)) 
               || tables.find(t => t.number === Number(selectedTable))
               || null;
        }

        const targetTableNumber = isDelivery || isCounter ? null : (table ? table.number : (Number(selectedTable) || null));
        const targetTableId = isCounter ? 'counter' : (isDelivery ? -2 : (table ? table.id : (targetTableNumber != null ? String(targetTableNumber) : String(selectedTable))));
        const orderType: 'table' | 'counter' | 'delivery' = isDelivery ? 'delivery' : (isCounter ? 'counter' : 'table');

        const orderData = {
          table_id: targetTableId,
          table_number: targetTableNumber,
          type: orderType,
          delivery_info: isDelivery ? {
            name: deliveryName.trim() || 'Cliente Delivery',
            phone: deliveryPhone.trim() || '',
            address: deliveryAddress.trim() || ''
          } : (isCounter && counterCustomerName.trim() ? {
            name: counterCustomerName.trim(),
            phone: '',
            address: 'Balcão'
          } : null),
          items: cart.map(i => ({ 
            item_id: i.item.id, 
            name: i.item.name,
            quantity: i.quantity, 
            price_at_time: i.item.price,
            observation: i.observation || '',
            addons: (i.selectedAddons || []).map(a => ({
              id: a.id,
              name: a.name,
              price_at_time: a.price
            }))
          })),
          total_price: total,
          status: 'pending',
          created_at: new Date().toISOString()
        };

        const batch = writeBatch(db);
        const newOrderRef = doc(collection(db, 'orders'));
        batch.set(newOrderRef, orderData);

        // Ensure table status is set to occupied
        if (table) {
          batch.update(doc(db, 'tables', table.id), { status: 'occupied' });
        } else if (!isCounter && !isDelivery && targetTableNumber != null) {
          const matchingTable = tables.find(t => t.number === targetTableNumber);
          if (matchingTable) {
            batch.update(doc(db, 'tables', matchingTable.id), { status: 'occupied' });
          }
        }

        await batch.commit();

        setCart([]);
        setOrderSent(true);
        setShowCartDetails(false);
        setTimeout(() => {
          setOrderSent(false);
          if (onClose) onClose();
        }, 1200);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'orders');
        alert('Erro ao enviar pedido. Por favor, verifique sua conexão e tente novamente.');
      } finally {
        setIsSending(false);
      }
    };

  const filteredItems = category === 'all' ? items : items.filter(i => i.category === category);

  return (
    <div className="min-h-screen bg-stone-50 font-serif relative overflow-x-hidden">
      {user && onViewChange && (
        <div className="relative z-50 bg-emerald-600 text-white px-6 py-3.5 font-sans text-xs flex flex-col sm:flex-row gap-3 justify-between items-center shadow-md">
          <div className="flex items-center gap-2 font-sans">
            <span className="w-2 h-2 bg-white rounded-full animate-ping" />
            <span>Você está logado como <strong>Atendente/Administrador</strong>. Abrindo mesa do cliente.</span>
          </div>
          <button 
            onClick={() => onViewChange('admin')}
            className="bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-full font-bold transition-all uppercase tracking-widest text-[10px]"
          >
            Voltar ao Painel Admin
          </button>
        </div>
      )}

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
          <div className="w-24 h-24 bg-yellow-400 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg border-4 border-white animate-fade-in">
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
          
          <div className="flex flex-col md:flex-row items-stretch justify-center gap-6">
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
              <button 
                onClick={() => {
                  setSelectedTable('counter');
                  setTableSearch('');
                }}
                className={cn(
                  "px-6 py-8 rounded-[32px] font-sans font-bold transition-all shadow-xl flex flex-col items-center justify-center gap-4 border-2",
                  selectedTable === 'counter' 
                    ? "bg-stone-900 border-stone-900 text-white scale-105 shadow-stone-200" 
                    : "bg-white border-stone-100 text-stone-400 hover:border-stone-300 hover:bg-stone-50"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  selectedTable === 'counter' ? "bg-white/20" : "bg-stone-100"
                )}>
                  <Coffee size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-xl">Balcão</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Retirada</span>
                </div>
              </button>

              <button 
                onClick={() => {
                  setSelectedTable(-2);
                  setTableSearch('');
                }}
                className={cn(
                  "px-6 py-8 rounded-[32px] font-sans font-bold transition-all shadow-xl flex flex-col items-center justify-center gap-4 border-2",
                  selectedTable === -2 
                    ? "bg-emerald-600 border-emerald-600 text-white scale-105 shadow-emerald-200" 
                    : "bg-white border-stone-100 text-stone-400 hover:border-emerald-300 hover:bg-emerald-50"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  selectedTable === -2 ? "bg-white/20" : "bg-emerald-100 text-emerald-600"
                )}>
                  <Truck size={32} />
                </div>
                <div className="text-center">
                  <span className="block text-xl">Delivery</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60">Entrega</span>
                </div>
              </button>
            </div>

            <div className="hidden md:flex items-center">
              <div className="w-px h-24 bg-stone-200" />
            </div>
            <div className="md:hidden w-full h-px bg-stone-200 my-2" />

            <div className="flex-1 w-full flex flex-col justify-center">
              {selectedTable === 'counter' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 bg-stone-50/80 p-5 rounded-2xl border-2 border-stone-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-stone-900 text-amber-400 flex items-center justify-center">
                        <Coffee size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-stone-900 text-base">Atendimento no Balcão</h4>
                        <p className="text-xs text-stone-500">Retirada direta no balcão</p>
                      </div>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2.5 py-1 rounded-full">
                      Pronto p/ Retirar
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] uppercase tracking-wider font-bold text-stone-600 block">
                      Nome do Cliente / Senha / Comanda (opcional)
                    </label>
                    <input 
                      type="text"
                      placeholder="Ex: João, Senha 12, Comanda 04..."
                      className="w-full px-4 py-3 rounded-2xl border-2 border-stone-200 focus:border-stone-900 outline-none font-sans text-sm transition-all bg-white"
                      value={counterCustomerName}
                      onChange={e => setCounterCustomerName(e.target.value)}
                    />
                    <p className="text-[10px] text-stone-400">
                      Identifica seu pedido no painel da cozinha e no momento de retirar.
                    </p>
                  </div>
                </div>
              ) : selectedTable === -2 ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Nome</label>
                      <input 
                        type="text"
                        placeholder="Seu nome..."
                        className="w-full px-4 py-3 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 outline-none font-sans text-sm transition-all"
                        value={deliveryName}
                        onChange={e => setDeliveryName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Telefone</label>
                      <input 
                        type="tel"
                        placeholder="(00) 00000-0000"
                        className="w-full px-4 py-3 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 outline-none font-sans text-sm transition-all"
                        value={deliveryPhone}
                        onChange={e => setDeliveryPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-stone-400 ml-2">Endereço de Entrega</label>
                    <textarea 
                      placeholder="Rua, número, bairro, complemento..."
                      className="w-full px-4 py-3 rounded-2xl border-2 border-stone-100 focus:border-emerald-500 outline-none font-sans text-sm transition-all resize-none h-20"
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <div className="relative">
                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input 
                        type="number"
                        placeholder="Número da mesa..."
                        className="w-full pl-12 pr-4 py-5 rounded-2xl border-2 border-stone-100 focus:border-stone-900 focus:ring-0 outline-none font-sans text-xl transition-all placeholder:text-stone-300"
                        value={tableSearch}
                        onChange={e => {
                          setTableSearch(e.target.value);
                          const table = tables.find(t => t.number.toString() === e.target.value);
                          if (table) setSelectedTable(table.id);
                          else if (e.target.value === '') setSelectedTable(null);
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[160px] overflow-y-auto p-1 custom-scrollbar">
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
                          "aspect-square rounded-xl font-sans font-bold transition-all shadow-sm flex items-center justify-center text-base border-2",
                          selectedTable === t.id 
                            ? "bg-stone-900 border-stone-900 text-white scale-110 shadow-stone-300 z-10" 
                            : "bg-white border-stone-50 text-stone-400 hover:bg-stone-50 hover:border-stone-200"
                        )}
                      >
                        {t.number}
                      </button>
                    ))}
                  </div>
                </>
              )}
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
                    {item.icon && IconMap[item.icon] ? (
                      React.createElement(IconMap[item.icon], { size: 40 })
                    ) : (
                      item.category === 'dish' ? <UtensilsCrossed size={40} /> : <Beer size={40} />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold italic text-stone-900">{item.name}</h3>
                    {item.is_dish_of_day && (
                      <span className="bg-emerald-500 text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full">Prato do Dia</span>
                    )}
                  </div>
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
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => {
                            if (confirm('Deseja limpar todo o carrinho?')) {
                              setCart([]);
                              setShowCartDetails(false);
                            }
                          }}
                          className="text-[10px] uppercase tracking-widest text-red-500 font-bold hover:underline"
                        >
                          Limpar Tudo
                        </button>
                        <button onClick={() => setShowCartDetails(false)} className="text-stone-500 hover:text-white">
                          <X size={16} />
                        </button>
                      </div>
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
                          selectedTable === 'counter' ? "bg-emerald-500/20 text-emerald-500" : 
                          selectedTable === -2 ? "bg-blue-500/20 text-blue-500" :
                          selectedTable ? "bg-stone-700 text-white" : "bg-red-500/20 text-red-500"
                        )}>
                          {selectedTable === 'counter' ? <Beer size={20} /> : 
                           selectedTable === -2 ? <Truck size={20} /> :
                           <TableIcon size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-sm">
                            {selectedTable === 'counter' ? 'Retirada no Balcão' : 
                             selectedTable === -2 ? 'Entrega (Delivery)' :
                             selectedTable ? `Mesa ${tables.find(t => t.id === selectedTable)?.number}` : 
                             'Local não selecionado'}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            {selectedTable ? 'Pedido será processado' : 'Por favor, selecione onde entregar'}
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
                      {selectedTable === 'counter' ? (counterCustomerName.trim() ? `Balcão (${counterCustomerName.trim()})` : 'Balcão') : (selectedTable === -2 ? 'Delivery' : (selectedTable ? `Mesa ${tables.find(t => t.id === selectedTable)?.number}` : 'Sem Mesa'))} {showCartDetails ? '↑' : '↓'}
                    </p>
                    <p className="text-xl font-bold">R$ {total.toFixed(2)}</p>
                  </div>
                </button>
                <button 
                  onClick={sendOrder}
                  disabled={isSending}
                  className={cn(
                    "bg-white text-stone-900 px-8 py-3 rounded-full font-sans font-bold uppercase text-xs tracking-widest transition-all",
                    isSending ? "opacity-50 cursor-not-allowed" : "hover:bg-stone-100"
                  )}
                >
                  {isSending ? 'Enviando...' : 'Finalizar Pedido'}
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
            <div className="bg-white p-10 rounded-[40px] text-center shadow-2xl border border-stone-100 max-w-sm">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h3 className="text-2xl font-bold italic mb-2">Pedido Enviado!</h3>
              <p className="text-stone-500 font-sans text-xs">
                {selectedTable === 'counter' 
                  ? 'Pedido registrado no balcão e enviado à cozinha com sucesso.' 
                  : 'Sua refeição já está sendo preparada com carinho.'}
              </p>
              <button 
                onClick={() => {
                  setOrderSent(false);
                  if (onClose) onClose();
                }}
                className="mt-6 w-full bg-stone-900 text-white py-3 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all font-sans shadow-lg"
              >
                OK, Concluir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<'customer' | 'admin' | 'kitchen'>('customer');
  const [user, setUser] = useState<any>(() => {
    try {
      const local = localStorage.getItem('local_admin_user');
      return local ? JSON.parse(local) : null;
    } catch {
      return null;
    }
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [initialTableId, setInitialTableId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const table = params.get('table') || params.get('table_id');
    if (table) {
      const lower = table.toLowerCase();
      if (lower === 'balcao' || lower === 'balcão' || lower === 'counter') {
        setInitialTableId('counter');
      } else {
        setInitialTableId(table);
      }
      setView('customer');
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('local_admin_user')) {
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (localStorage.getItem('local_admin_user')) {
        setIsAuthReady(true);
        return;
      }
      setUser(u);
      setIsAuthReady(true);
      
      // If user logs in, ensure they have a document in the users collection
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        getDoc(userRef).then((docSnap) => {
          if (!docSnap.exists()) {
            setDoc(userRef, {
              name: u.displayName,
              email: u.email,
              role: 'admin',
              created_at: new Date().toISOString()
            }).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${u.uid}`));
          }
        }).catch(e => handleFirestoreError(e, OperationType.GET, `users/${u.uid}`));
      }
    });
    return () => unsubscribe();
  }, []);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-12 h-12 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    localStorage.removeItem('local_admin_user');
    await signOut(auth);
    setUser(null);
    setView('customer');
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        {/* View Selector for Demo Convenience */}
        <div className="fixed top-4 right-4 z-[100] flex gap-2 bg-white/50 backdrop-blur p-1 rounded-full border border-white/20 shadow-sm">
          <button onClick={() => setView('customer')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'customer' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Menu</button>
          <button onClick={() => setView('admin')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'admin' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Admin</button>
          <button onClick={() => setView('kitchen')} className={cn("px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all", view === 'kitchen' ? "bg-stone-900 text-white" : "text-stone-500 hover:text-stone-900")}>Cozinha</button>
          {user && (
            <button onClick={handleLogout} className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest text-red-500 hover:bg-red-50 transition-all">Sair</button>
          )}
        </div>

        {view === 'customer' && (
          <CustomerMenu 
            initialTableId={initialTableId} 
            user={user} 
            onViewChange={setView} 
          />
        )}
        
        {view === 'admin' && (
          user ? <AdminPanel onViewChange={setView} currentUser={user} /> : <LoginScreen onLogin={(localUser) => { if (localUser) setUser(localUser); setView('admin'); }} />
        )}
        
        {view === 'kitchen' && (
          user ? <KitchenPanel onViewChange={setView} /> : <LoginScreen onLogin={(localUser) => { if (localUser) setUser(localUser); setView('kitchen'); }} />
        )}
      </div>
    </ErrorBoundary>
  );
}
