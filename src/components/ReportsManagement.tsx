import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Printer, 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  QrCode, 
  Calendar, 
  Award, 
  ShoppingBag, 
  ChevronRight,
  Filter,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  PieChart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Order, Item, DailyClosure } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  where 
} from 'firebase/firestore';

interface ReportsManagementProps {
  currentUser?: any;
  isAdmin?: boolean;
  printHtml: (title: string, htmlContent: string) => void;
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export const ReportsManagement: React.FC<ReportsManagementProps> = ({
  currentUser,
  isAdmin = true,
  printHtml
}) => {
  const [reportTab, setReportTab] = useState<'closure' | 'products' | 'marmitas'>('closure');
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters for Products Report
  const [period, setPeriod] = useState<PeriodType>('today');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Closure date selection
  const [closureDate, setClosureDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Subscribe to orders
    const qOrders = query(collection(db, 'orders'), orderBy('created_at', 'desc'));
    const unsubOrders = onSnapshot(
      qOrders,
      (snapshot) => {
        const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
        setOrders(orderData);
        setLoading(false);
        console.log('[Relatorios]', { totalOrdersFetched: orderData.length, timestamp: new Date().toISOString() });
      },
      (err) => {
        console.error('[Relatorios] Error fetching orders:', err);
        setError('Erro ao carregar dados dos pedidos.');
        setLoading(false);
      }
    );

    // Subscribe to menu items
    const qItems = query(collection(db, 'items'));
    const unsubItems = onSnapshot(
      qItems,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
        setMenuItems(items);
      },
      (err) => {
        console.error('[Relatorios] Error fetching menu items:', err);
      }
    );

    return () => {
      unsubOrders();
      unsubItems();
    };
  }, []);

  // Helper to show temporal feedback
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // --- 1.1 FECHAMENTO DO DIA ---
  const getClosureData = () => {
    const selectedDayOrders = orders.filter(o => {
      if (o.status === 'canceled') return false;
      const orderDay = new Date(o.created_at).toISOString().split('T')[0];
      return orderDay === closureDate;
    });

    let totalCash = 0;
    let totalCard = 0;
    let totalPix = 0;
    let totalOverall = 0;

    selectedDayOrders.forEach(o => {
      const price = o.total_price || 0;
      totalOverall += price;

      const method = (o.payment_method || '').toLowerCase();
      if (method.includes('dinheiro') || method.includes('cash')) {
        totalCash += price;
      } else if (method.includes('cartao') || method.includes('card') || method.includes('credito') || method.includes('debito')) {
        totalCard += price;
      } else if (method.includes('pix')) {
        totalPix += price;
      } else {
        // Distribute proportionally or default to cash if unspecified
        totalCash += price;
      }
    });

    const totalOrders = selectedDayOrders.length;
    const averageTicket = totalOrders > 0 ? totalOverall / totalOrders : 0;
    const responsibleName = currentUser?.displayName || currentUser?.email || 'Administrador';

    return {
      date: closureDate,
      issuedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      responsible: responsibleName,
      totalCash,
      totalCard,
      totalPix,
      totalOverall,
      totalOrders,
      averageTicket
    };
  };

  const handlePrintClosure = () => {
    const data = getClosureData();
    console.log('[Relatorios]', { action: 'print_closure', data });

    const dateFormatted = new Date(data.date + 'T00:00:00').toLocaleDateString('pt-BR');

    const html = `
      <html>
        <head>
          <title>Fechamento do Dia - ${dateFormatted}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              max-width: 80mm; 
              margin: 0 auto; 
              padding: 10px; 
              color: #000;
              font-size: 12px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .double-line { border-top: 2px solid #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">PONTO CERTO COMIDA CASEIRA</div>
            <div class="bold">FECHAMENTO DO DIA</div>
            <div>Data: ${dateFormatted}</div>
            <div>Hora Emissão: ${data.issuedAt}</div>
            <div>Resp.: ${data.responsible}</div>
          </div>

          <div class="double-line"></div>

          <div class="bold">FORMAS DE PAGAMENTO</div>
          <div class="line"></div>
          <div class="row"><span>DINHEIRO:</span> <span class="bold">R$ ${data.totalCash.toFixed(2)}</span></div>
          <div class="row"><span>CARTÃO:</span> <span class="bold">R$ ${data.totalCard.toFixed(2)}</span></div>
          <div class="row"><span>PIX:</span> <span class="bold">R$ ${data.totalPix.toFixed(2)}</span></div>

          <div class="double-line"></div>

          <div class="row title"><span>TOTAL GERAL:</span> <span>R$ ${data.totalOverall.toFixed(2)}</span></div>
          <div class="line"></div>
          <div class="row"><span>Qtd de Pedidos:</span> <span class="bold">${data.totalOrders}</span></div>
          <div class="row"><span>Ticket Médio:</span> <span class="bold">R$ ${data.averageTicket.toFixed(2)}</span></div>

          <div class="double-line"></div>

          <div class="center" style="margin-top: 15px;">
            <div>Obrigado!</div>
            <div style="font-size: 10px; margin-top: 5px;">Ponto Certo Comida Caseira</div>
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printHtml(`Fechamento-${data.date}`, html);
    triggerSuccess('Relatório de fechamento enviado para impressão!');
  };

  // --- 1.2 RELATÓRIO DE PRODUTOS VENDIDOS ---
  const getFilteredOrdersForProducts = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    return orders.filter(o => {
      if (o.status === 'canceled') return false;
      const orderDate = new Date(o.created_at);
      const orderDateStr = orderDate.toISOString().split('T')[0];

      if (period === 'today') {
        return orderDateStr === todayStr;
      }
      if (period === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return orderDateStr === yesterday.toISOString().split('T')[0];
      }
      if (period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      }
      if (period === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDate >= monthAgo;
      }
      if (period === 'custom') {
        if (!startDate || !endDate) return true;
        return orderDateStr >= startDate && orderDateStr <= endDate;
      }
      return true;
    });
  };

  const getProductsSoldData = () => {
    const filteredOrders = getFilteredOrdersForProducts();
    const map: { [name: string]: { name: string; quantity: number; totalSales: number } } = {};
    let grandTotalSales = 0;

    filteredOrders.forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const name = item.name || 'Produto sem nome';
          const qty = item.quantity || 1;
          const unitPrice = item.price_at_time || 0;
          const total = unitPrice * qty;

          if (!map[name]) {
            map[name] = { name, quantity: 0, totalSales: 0 };
          }
          map[name].quantity += qty;
          map[name].totalSales += total;
          grandTotalSales += total;
        });
      }
    });

    const list = Object.values(map).map(p => ({
      ...p,
      percentage: grandTotalSales > 0 ? (p.totalSales / grandTotalSales) * 100 : 0
    }));

    // Auto-sort from most sold (by quantity, then total value) to least sold
    list.sort((a, b) => b.quantity !== a.quantity ? b.quantity - a.quantity : b.totalSales - a.totalSales);

    console.log('[Relatorios]', { action: 'products_sold_report', period, count: list.length, grandTotalSales });

    return { items: list, grandTotalSales, totalOrders: filteredOrders.length };
  };

  // --- 1.3 RELATÓRIO DE MARMITAS ---
  const getMarmitasData = () => {
    let m08Qty = 0;
    let m08Total = 0;
    let m09Qty = 0;
    let m09Total = 0;

    // Filter valid orders
    orders.filter(o => o.status !== 'canceled').forEach(order => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const nameLower = (item.name || '').toLowerCase();
          const qty = item.quantity || 1;
          const price = item.price_at_time || 0;
          const total = price * qty;

          if (nameLower.includes('marmita 08') || nameLower.includes('marmita 8') || nameLower.includes('marmita nº 08') || nameLower.includes('marmita nº 8')) {
            m08Qty += qty;
            m08Total += total;
          } else if (nameLower.includes('marmita 09') || nameLower.includes('marmita 9') || nameLower.includes('marmita nº 09') || nameLower.includes('marmita nº 9')) {
            m09Qty += qty;
            m09Total += total;
          }
        });
      }
    });

    const grandQty = m08Qty + m09Qty;
    const grandTotal = m08Total + m09Total;

    return {
      m08Qty,
      m08Total,
      m09Qty,
      m09Total,
      grandQty,
      grandTotal
    };
  };

  const handlePrintMarmitas = () => {
    const mData = getMarmitasData();
    console.log('[Relatorios]', { action: 'print_marmitas', mData });

    const html = `
      <html>
        <head>
          <title>Relatório de Marmitas</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              max-width: 80mm; 
              margin: 0 auto; 
              padding: 10px; 
              color: #000;
              font-size: 12px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 8px 0; }
            .double-line { border-top: 2px solid #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .title { font-size: 15px; font-weight: bold; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">PONTO CERTO COMIDA CASEIRA</div>
            <div class="bold">RELATÓRIO DE MARMITAS</div>
            <div>Data: ${new Date().toLocaleDateString('pt-BR')}</div>
            <div>Hora: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          <div class="double-line"></div>

          <div class="bold">MARMITA 08</div>
          <div class="row"><span>Quantidade Vendida:</span> <span class="bold">${mData.m08Qty} un</span></div>
          <div class="row"><span>Valor Total:</span> <span class="bold">R$ ${mData.m08Total.toFixed(2)}</span></div>

          <div class="line"></div>

          <div class="bold">MARMITA 09</div>
          <div class="row"><span>Quantidade Vendida:</span> <span class="bold">${mData.m09Qty} un</span></div>
          <div class="row"><span>Valor Total:</span> <span class="bold">R$ ${mData.m09Total.toFixed(2)}</span></div>

          <div class="double-line"></div>

          <div class="bold" style="font-size: 13px;">TOTAL GERAL MARMITAS</div>
          <div class="row title"><span>Total Vendas:</span> <span>R$ ${mData.grandTotal.toFixed(2)}</span></div>
          <div class="row"><span>Total Unidades:</span> <span class="bold">${mData.grandQty} un</span></div>

          <div class="double-line"></div>

          <div class="center" style="margin-top: 15px;">
            <div>Obrigado!</div>
            <div style="font-size: 10px; margin-top: 5px;">Ponto Certo Comida Caseira</div>
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;

    printHtml(`Relatorio-Marmitas`, html);
    triggerSuccess('Relatório de marmitas enviado para impressão!');
  };

  const closureData = getClosureData();
  const productsData = getProductsSoldData();
  const marmitasData = getMarmitasData();

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} />
              <span className="font-bold text-sm">{successMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Sub-navigation */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-4">
        <button
          aria-label="Aba Fechamento do Dia"
          onClick={() => setReportTab('closure')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            reportTab === 'closure'
              ? 'bg-stone-900 text-white shadow-md'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <Calendar size={16} />
          Fechamento do Dia
        </button>

        <button
          aria-label="Aba Produtos Vendidos"
          onClick={() => setReportTab('products')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            reportTab === 'products'
              ? 'bg-stone-900 text-white shadow-md'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <ShoppingBag size={16} />
          Produtos Vendidos
        </button>

        <button
          aria-label="Aba Relatório de Marmitas"
          onClick={() => setReportTab('marmitas')}
          className={`px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
            reportTab === 'marmitas'
              ? 'bg-stone-900 text-white shadow-md'
              : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
          }`}
        >
          <PieChart size={16} />
          Relatório de Marmitas
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-500 font-medium text-sm">Carregando relatórios...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 p-6 rounded-3xl border border-red-100 text-red-700 flex items-center gap-3">
          <AlertCircle size={24} className="shrink-0" />
          <p className="font-semibold text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* TAB 1: FECHAMENTO DO DIA */}
          {reportTab === 'closure' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Fechamento do Dia</h3>
                  <p className="text-stone-500 text-xs mt-1">Resumo diário por forma de pagamento e totalizadores de vendas.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-2 bg-stone-50 px-3 py-2 rounded-2xl border border-stone-200 text-xs">
                    <Calendar size={14} className="text-stone-500" />
                    <span className="font-semibold text-stone-700">Data:</span>
                    <input
                      type="date"
                      value={closureDate}
                      onChange={e => setClosureDate(e.target.value)}
                      className="bg-transparent font-bold focus:outline-none"
                    />
                  </div>

                  <button
                    aria-label="Imprimir Fechamento"
                    onClick={handlePrintClosure}
                    className="bg-stone-900 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all flex items-center gap-2 shadow-md shrink-0"
                  >
                    <Printer size={16} />
                    Imprimir Fechamento
                  </button>
                </div>
              </div>

              {/* Closure Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                  <span className="text-xs text-stone-400 uppercase tracking-wider font-bold">Data do Fechamento</span>
                  <p className="text-lg font-bold text-stone-900 mt-1">{new Date(closureData.date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                  <span className="text-xs text-stone-400 uppercase tracking-wider font-bold">Horário de Emissão</span>
                  <p className="text-lg font-bold text-stone-900 mt-1">{closureData.issuedAt}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
                  <span className="text-xs text-stone-400 uppercase tracking-wider font-bold">Responsável</span>
                  <p className="text-lg font-bold text-stone-900 mt-1 truncate">{closureData.responsible}</p>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-emerald-50/60 p-6 rounded-3xl border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between text-emerald-800">
                    <span className="font-bold text-xs uppercase tracking-wider">Dinheiro</span>
                    <DollarSign size={20} />
                  </div>
                  <p className="text-3xl font-bold text-emerald-950">R$ {closureData.totalCash.toFixed(2)}</p>
                  <p className="text-xs text-emerald-700">Recebido em espécie</p>
                </div>

                <div className="bg-blue-50/60 p-6 rounded-3xl border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between text-blue-800">
                    <span className="font-bold text-xs uppercase tracking-wider">Cartão</span>
                    <CreditCard size={20} />
                  </div>
                  <p className="text-3xl font-bold text-blue-950">R$ {closureData.totalCard.toFixed(2)}</p>
                  <p className="text-xs text-blue-700">Crédito e Débito</p>
                </div>

                <div className="bg-purple-50/60 p-6 rounded-3xl border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between text-purple-800">
                    <span className="font-bold text-xs uppercase tracking-wider">PIX</span>
                    <QrCode size={20} />
                  </div>
                  <p className="text-3xl font-bold text-purple-950">R$ {closureData.totalPix.toFixed(2)}</p>
                  <p className="text-xs text-purple-700">Transferências instantâneas</p>
                </div>
              </div>

              {/* Total Highlights */}
              <div className="bg-stone-900 text-white p-8 rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Total Geral do Dia</span>
                  <p className="text-4xl font-bold mt-1 text-amber-400">R$ {closureData.totalOverall.toFixed(2)}</p>
                </div>
                <div className="flex gap-8 border-t md:border-t-0 md:border-l border-stone-800 pt-4 md:pt-0 md:pl-8 w-full md:w-auto justify-around">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Qtd. Pedidos</span>
                    <p className="text-2xl font-bold text-white mt-1">{closureData.totalOrders}</p>
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Ticket Médio</span>
                    <p className="text-2xl font-bold text-white mt-1">R$ {closureData.averageTicket.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: RELATÓRIO DE PRODUTOS VENDIDOS */}
          {reportTab === 'products' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Relatório de Produtos Vendidos</h3>
                  <p className="text-stone-500 text-xs mt-1">Classificação por quantidade vendida e ranking dos pratos mais populares.</p>
                </div>

                {/* Filter Options */}
                <div className="flex flex-wrap items-center gap-2">
                  {(['today', 'yesterday', 'week', 'month', 'custom'] as PeriodType[]).map(p => (
                    <button
                      key={p}
                      aria-label={`Filtrar por ${p}`}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        period === p
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                      }`}
                    >
                      {p === 'today' && 'Hoje'}
                      {p === 'yesterday' && 'Ontem'}
                      {p === 'week' && 'Esta Semana'}
                      {p === 'month' && 'Este Mês'}
                      {p === 'custom' && 'Personalizado'}
                    </button>
                  ))}
                </div>
              </div>

              {period === 'custom' && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 flex flex-wrap items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-600 font-bold">Início:</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="bg-white border border-stone-300 rounded-xl px-3 py-1.5 focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-stone-600 font-bold">Fim:</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-white border border-stone-300 rounded-xl px-3 py-1.5 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Products Table / Cards */}
              {productsData.items.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center text-stone-400 space-y-3">
                  <ShoppingBag size={48} className="mx-auto opacity-30" />
                  <p className="font-bold text-stone-600">Nenhum produto vendido no período selecionado.</p>
                  <p className="text-xs">Tente alterar o filtro de data acima para visualizar outros períodos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-stone-400 px-2 flex justify-between items-center">
                    <span>Lista de Pratos / Itens (Ordenado do Mais Vendido)</span>
                    <span>Total em Vendas: R$ {productsData.grandTotalSales.toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {productsData.items.map((prod, index) => {
                      const isTop5 = index < 5;
                      return (
                        <div
                          key={prod.name}
                          className={`p-5 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                            isTop5
                              ? 'bg-amber-50/50 border-amber-200 shadow-sm'
                              : 'bg-white border-stone-100'
                          }`}
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                              index === 0 ? 'bg-amber-400 text-stone-900 ring-4 ring-amber-200' :
                              index === 1 ? 'bg-stone-300 text-stone-800' :
                              index === 2 ? 'bg-amber-700 text-white' :
                              isTop5 ? 'bg-amber-200 text-amber-900' :
                              'bg-stone-100 text-stone-500'
                            }`}>
                              #{index + 1}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-stone-900 text-base truncate">{prod.name}</p>
                                {isTop5 && (
                                  <span className="bg-amber-400 text-stone-950 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                                    <Award size={12} /> Top 5
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-stone-500 mt-0.5">
                                Participação: <span className="font-bold text-stone-700">{prod.percentage.toFixed(1)}%</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 self-end sm:self-center shrink-0">
                            <div className="text-right">
                              <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Quantidade</span>
                              <p className="text-lg font-bold text-stone-900">{prod.quantity} un</p>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Valor Total</span>
                              <p className="text-lg font-bold text-emerald-600">R$ {prod.totalSales.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: RELATÓRIO DE MARMITAS */}
          {reportTab === 'marmitas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-stone-900">Relatório Específico de Marmitas</h3>
                  <p className="text-stone-500 text-xs mt-1">Acompanhamento detalhado das vendas das Marmitas 08 e 09.</p>
                </div>
                <button
                  aria-label="Imprimir Relatório de Marmitas"
                  onClick={handlePrintMarmitas}
                  className="bg-stone-900 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all flex items-center gap-2 shadow-md shrink-0"
                >
                  <Printer size={16} />
                  Imprimir Relatório de Marmitas
                </button>
              </div>

              {/* Marmita 08 and Marmita 09 Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <span className="font-extrabold text-lg text-stone-900">Marmita 08</span>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">Prato Especial</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Qtd Vendida</span>
                      <p className="text-2xl font-bold text-stone-900 mt-1">{marmitasData.m08Qty} un</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Valor Total</span>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">R$ {marmitasData.m08Total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <span className="font-extrabold text-lg text-stone-900">Marmita 09</span>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full">Prato Especial</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Qtd Vendida</span>
                      <p className="text-2xl font-bold text-stone-900 mt-1">{marmitasData.m09Qty} un</p>
                    </div>
                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                      <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Valor Total</span>
                      <p className="text-2xl font-bold text-emerald-600 mt-1">R$ {marmitasData.m09Total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marmitas Grand Total Card */}
              <div className="bg-amber-400 text-stone-950 p-8 rounded-3xl shadow-lg flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-stone-800">Total Geral de Marmitas</span>
                  <p className="text-4xl font-black mt-1">R$ {marmitasData.grandTotal.toFixed(2)}</p>
                </div>
                <div className="bg-stone-950/10 px-6 py-4 rounded-2xl border border-stone-950/10 text-right w-full md:w-auto">
                  <span className="text-xs font-bold uppercase tracking-widest text-stone-800">Unidades Vendidas</span>
                  <p className="text-3xl font-black">{marmitasData.grandQty} marmitas</p>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
};
