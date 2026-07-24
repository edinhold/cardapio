import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Plus, 
  Search, 
  Printer, 
  Trash2, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  UserPlus, 
  Building2, 
  Phone, 
  MapPin, 
  Calendar, 
  X, 
  ChevronRight, 
  Edit, 
  ArrowLeft,
  FileText,
  CreditCard,
  QrCode,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Customer, CustomerOrder, CustomerPayment, CustomerOrderItem, Item } from '../types';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy, 
  where 
} from 'firebase/firestore';

interface CustomersManagementProps {
  currentUser?: any;
  isAdmin?: boolean;
  printHtml: (title: string, htmlContent: string) => void;
}

export const CustomersManagement: React.FC<CustomersManagementProps> = ({
  currentUser,
  isAdmin = true,
  printHtml
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [menuItems, setMenuItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected customer for detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrder[]>([]);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);

  // Search and filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modals state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  // New Customer Form State
  const [custName, setCustName] = useState<string>('');
  const [custAddress, setCustAddress] = useState<string>('');
  const [custPhone, setCustPhone] = useState<string>('');
  const [custCnpj, setCustCnpj] = useState<string>('');
  const [custObs, setCustObs] = useState<string>('');
  const [custActive, setCustActive] = useState<boolean>(true);

  // New Customer Order Form State
  const [orderItemsList, setOrderItemsList] = useState<{
    item: Item;
    quantity: number;
    custom_price: number;
    observation: string;
  }[]>([]);
  const [orderObs, setOrderObs] = useState<string>('');
  const [itemSearch, setItemSearch] = useState<string>('');

  // Payment Form State
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<string>('Dinheiro');
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().slice(0, 16));
  const [payObs, setPayObs] = useState<string>('');

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // 1. Fetch Customers & Menu Items
  useEffect(() => {
    setLoading(true);

    const qCust = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubCust = onSnapshot(
      qCust,
      (snapshot) => {
        const custs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
        setCustomers(custs);
        setLoading(false);
        console.log('[CadastroClientes]', { totalCustomers: custs.length, timestamp: new Date().toISOString() });

        // Update selected customer reference if currently viewing one
        if (selectedCustomer) {
          const updated = custs.find(c => c.id === selectedCustomer.id);
          if (updated) setSelectedCustomer(updated);
        }
      },
      (err) => {
        console.error('[CadastroClientes] Error fetching customers:', err);
        setError('Erro ao carregar lista de clientes.');
        setLoading(false);
      }
    );

    const qItems = query(collection(db, 'items'));
    const unsubItems = onSnapshot(
      qItems,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));
        setMenuItems(items);
      },
      (err) => {
        console.error('[CadastroClientes] Error fetching menu items:', err);
      }
    );

    return () => {
      unsubCust();
      unsubItems();
    };
  }, []);

  // 2. Fetch Customer Orders & Payments when selected customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerOrders([]);
      setCustomerPayments([]);
      return;
    }

    const qOrders = query(
      collection(db, 'customer_orders'),
      where('customer_id', '==', selectedCustomer.id)
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerOrder));
      orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setCustomerOrders(orders);
    });

    const qPayments = query(
      collection(db, 'customer_payments'),
      where('customer_id', '==', selectedCustomer.id)
    );
    const unsubPayments = onSnapshot(qPayments, (snapshot) => {
      const pays = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomerPayment));
      pays.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setCustomerPayments(pays);
    });

    return () => {
      unsubOrders();
      unsubPayments();
    };
  }, [selectedCustomer?.id]);

  // Recalculate customer balance from orders total - payments total
  const calculateCustomerBalance = (custOrders: CustomerOrder[], custPays: CustomerPayment[]) => {
    const totalOrders = custOrders.reduce((acc, o) => acc + (o.total_price || 0), 0);
    const totalPayments = custPays.reduce((acc, p) => acc + (p.amount || 0), 0);
    return totalOrders - totalPayments;
  };

  // Sync balance in Firestore if mismatch detected
  useEffect(() => {
    if (!selectedCustomer) return;
    const calcBalance = calculateCustomerBalance(customerOrders, customerPayments);
    if (Math.abs((selectedCustomer.current_balance || 0) - calcBalance) > 0.01) {
      updateDoc(doc(db, 'customers', selectedCustomer.id), {
        current_balance: calcBalance
      }).catch(err => console.error('[CadastroClientes] Error updating customer balance:', err));
    }
  }, [customerOrders, customerPayments, selectedCustomer]);

  // Handle Save / Create Customer
  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Apenas Administradores podem registrar ou editar clientes.');
      return;
    }

    if (!custName.trim() || !custAddress.trim() || !custPhone.trim()) {
      setError('Preencha os campos obrigatórios: Nome, Endereço e Telefone.');
      return;
    }

    try {
      if (editingCustomer) {
        const custRef = doc(db, 'customers', editingCustomer.id);
        await updateDoc(custRef, {
          name: custName,
          address: custAddress,
          phone: custPhone,
          cnpj: custCnpj || '',
          observations: custObs || '',
          active: custActive
        });
        console.log('[CadastroClientes]', { action: 'update_customer', id: editingCustomer.id });
        triggerSuccess('Cliente atualizado com sucesso!');
      } else {
        const newCustData = {
          name: custName,
          address: custAddress,
          phone: custPhone,
          cnpj: custCnpj || '',
          observations: custObs || '',
          active: custActive,
          created_at: new Date().toISOString(),
          current_balance: 0
        };
        const ref = await addDoc(collection(db, 'customers'), newCustData);
        console.log('[CadastroClientes]', { action: 'create_customer', id: ref.id, data: newCustData });
        triggerSuccess('Cliente cadastrado com sucesso!');
      }

      resetCustomerForm();
      setShowAddCustomerModal(false);
    } catch (err) {
      console.error('[CadastroClientes] Error saving customer:', err);
      setError('Erro ao salvar dados do cliente.');
    }
  };

  const openEditCustomer = (cust: Customer) => {
    setEditingCustomer(cust);
    setCustName(cust.name);
    setCustAddress(cust.address);
    setCustPhone(cust.phone);
    setCustCnpj(cust.cnpj || '');
    setCustObs(cust.observations || '');
    setCustActive(cust.active);
    setShowAddCustomerModal(true);
  };

  const resetCustomerForm = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustAddress('');
    setCustPhone('');
    setCustCnpj('');
    setCustObs('');
    setCustActive(true);
  };

  const handleDeleteCustomer = async (cust: Customer) => {
    if (!isAdmin) {
      alert('Apenas Administradores podem excluir clientes.');
      return;
    }
    if (!window.confirm(`Tem certeza que deseja excluir o cliente "${cust.name}"? Todos os pedidos e pagamentos vinculados serão mantidos no histórico geral.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'customers', cust.id));
      console.log('[CadastroClientes]', { action: 'delete_customer', id: cust.id });
      triggerSuccess('Cliente excluído com sucesso.');
      if (selectedCustomer?.id === cust.id) {
        setSelectedCustomer(null);
      }
    } catch (err) {
      console.error('[CadastroClientes] Error deleting customer:', err);
      setError('Erro ao excluir cliente.');
    }
  };

  // Launch New Customer Order
  const handleAddProductToOrder = (item: Item) => {
    const existingIndex = orderItemsList.findIndex(i => i.item.id === item.id);
    if (existingIndex >= 0) {
      const updated = [...orderItemsList];
      updated[existingIndex].quantity += 1;
      setOrderItemsList(updated);
    } else {
      setOrderItemsList([
        ...orderItemsList,
        {
          item,
          quantity: 1,
          custom_price: item.price,
          observation: ''
        }
      ]);
    }
  };

  const handleSaveCustomerOrder = async () => {
    if (!isAdmin) {
      setError('Apenas Administradores podem lançar pedidos com preços customizados.');
      return;
    }
    if (!selectedCustomer) return;
    if (orderItemsList.length === 0) {
      setError('Selecione pelo menos um item para o pedido.');
      return;
    }

    let orderTotal = 0;
    const formattedItems: CustomerOrderItem[] = orderItemsList.map(i => {
      const itemTotal = i.custom_price * i.quantity;
      orderTotal += itemTotal;
      return {
        item_id: i.item.id,
        name: i.item.name,
        quantity: i.quantity,
        original_price: i.item.price,
        custom_price: i.custom_price,
        observation: i.observation
      };
    });

    const newOrderData = {
      customer_id: selectedCustomer.id,
      customer_name: selectedCustomer.name,
      total_price: orderTotal,
      created_at: new Date().toISOString(),
      observations: orderObs,
      created_by: currentUser?.displayName || currentUser?.email || 'Admin',
      items: formattedItems
    };

    try {
      const ref = await addDoc(collection(db, 'customer_orders'), newOrderData);
      
      // Update customer balance
      const newBal = (selectedCustomer.current_balance || 0) + orderTotal;
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        current_balance: newBal
      });

      console.log('[CadastroClientes]', { action: 'create_customer_order', orderId: ref.id, orderTotal, newBal });
      triggerSuccess('Pedido do cliente lançado com sucesso!');
      setShowNewOrderModal(false);
      setOrderItemsList([]);
      setOrderObs('');
    } catch (err) {
      console.error('[CadastroClientes] Error saving customer order:', err);
      setError('Erro ao lançar pedido do cliente.');
    }
  };

  // Register Payment
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setError('Apenas Administradores podem registrar pagamentos.');
      return;
    }
    if (!selectedCustomer) return;

    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Informe um valor de pagamento válido maior que zero.');
      return;
    }

    const newPaymentData = {
      customer_id: selectedCustomer.id,
      amount: amountNum,
      payment_method: payMethod,
      date: new Date(payDate).toISOString(),
      observation: payObs,
      created_by: currentUser?.displayName || currentUser?.email || 'Admin'
    };

    try {
      const ref = await addDoc(collection(db, 'customer_payments'), newPaymentData);

      // Update customer balance
      const newBal = (selectedCustomer.current_balance || 0) - amountNum;
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        current_balance: newBal
      });

      console.log('[CadastroClientes]', { action: 'create_customer_payment', paymentId: ref.id, amountNum, newBal });
      triggerSuccess('Pagamento registrado com sucesso!');
      setShowPaymentModal(false);
      setPayAmount('');
      setPayObs('');
    } catch (err) {
      console.error('[CadastroClientes] Error saving payment:', err);
      setError('Erro ao registrar pagamento.');
    }
  };

  // Delete Customer Order / Payment
  const handleDeleteCustomerOrder = async (orderId: string, orderTotal: number) => {
    if (!isAdmin) {
      alert('Apenas Administradores podem excluir pedidos.');
      return;
    }
    if (!selectedCustomer) return;
    if (!window.confirm('Tem certeza que deseja excluir este pedido do cliente?')) return;

    try {
      await deleteDoc(doc(db, 'customer_orders', orderId));
      const newBal = (selectedCustomer.current_balance || 0) - orderTotal;
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        current_balance: newBal
      });
      console.log('[CadastroClientes]', { action: 'delete_customer_order', orderId });
      triggerSuccess('Pedido do cliente removido.');
    } catch (err) {
      console.error('[CadastroClientes] Error deleting customer order:', err);
      setError('Erro ao excluir pedido.');
    }
  };

  const handleDeleteCustomerPayment = async (payId: string, amount: number) => {
    if (!isAdmin) {
      alert('Apenas Administradores podem excluir pagamentos.');
      return;
    }
    if (!selectedCustomer) return;
    if (!window.confirm('Tem certeza que deseja excluir este registro de pagamento?')) return;

    try {
      await deleteDoc(doc(db, 'customer_payments', payId));
      const newBal = (selectedCustomer.current_balance || 0) + amount;
      await updateDoc(doc(db, 'customers', selectedCustomer.id), {
        current_balance: newBal
      });
      console.log('[CadastroClientes]', { action: 'delete_customer_payment', payId });
      triggerSuccess('Pagamento removido.');
    } catch (err) {
      console.error('[CadastroClientes] Error deleting payment:', err);
      setError('Erro ao excluir pagamento.');
    }
  };

  // Thermal 80mm Print Extrato
  const handlePrintExtrato = () => {
    if (!selectedCustomer) return;

    const balance = calculateCustomerBalance(customerOrders, customerPayments);
    console.log('[CadastroClientes]', { action: 'print_extrato', customerId: selectedCustomer.id, balance });

    const html = `
      <html>
        <head>
          <title>Extrato - ${selectedCustomer.name}</title>
          <style>
            @page { margin: 0; }
            body { 
              font-family: 'Courier New', Courier, monospace; 
              width: 80mm; 
              max-width: 80mm; 
              margin: 0 auto; 
              padding: 10px; 
              color: #000;
              font-size: 11px;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .double-line { border-top: 2px solid #000; margin: 6px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .title { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
            .item-sub { padding-left: 8px; font-size: 10px; opacity: 0.8; }
          </style>
        </head>
        <body>
          <div class="center">
            <div class="title">PONTO CERTO COMIDA CASEIRA</div>
            <div class="bold">EXTRATO DE CLIENTE</div>
            <div>Data Emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>

          <div class="double-line"></div>

          <div class="bold">DADOS DO CLIENTE</div>
          <div><span class="bold">Nome:</span> ${selectedCustomer.name}</div>
          <div><span class="bold">Tel:</span> ${selectedCustomer.phone}</div>
          <div><span class="bold">End:</span> ${selectedCustomer.address}</div>
          ${selectedCustomer.cnpj ? `<div><span class="bold">CNPJ:</span> ${selectedCustomer.cnpj}</div>` : ''}

          <div class="double-line"></div>
          <div class="center bold">HISTÓRICO DE PEDIDOS</div>
          <div class="line"></div>

          ${customerOrders.length === 0 ? '<div>Nenhum pedido lançado.</div>' : customerOrders.map(o => `
            <div class="bold">${new Date(o.created_at).toLocaleDateString('pt-BR')} ${new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            ${o.items.map(i => `
              <div class="row">
                <span>${i.quantity}x ${i.name}</span>
                <span>R$ ${(i.custom_price * i.quantity).toFixed(2)}</span>
              </div>
              <div class="item-sub">Preço Un.: R$ ${i.custom_price.toFixed(2)} ${i.observation ? `(${i.observation})` : ''}</div>
            `).join('')}
            <div class="row bold" style="margin-top: 3px;">
              <span>Subtotal Pedido:</span>
              <span>R$ ${o.total_price.toFixed(2)}</span>
            </div>
            <div class="line"></div>
          `).join('')}

          <div class="double-line"></div>
          <div class="center bold">PAGAMENTOS REALIZADOS</div>
          <div class="line"></div>

          ${customerPayments.length === 0 ? '<div>Nenhum pagamento registrado.</div>' : customerPayments.map(p => `
            <div class="row">
              <span>${new Date(p.date).toLocaleDateString('pt-BR')} (${p.payment_method})</span>
              <span class="bold">- R$ ${p.amount.toFixed(2)}</span>
            </div>
            ${p.observation ? `<div class="item-sub">Obs: ${p.observation}</div>` : ''}
          `).join('')}

          <div class="double-line"></div>

          <div class="center" style="margin-top: 10px;">
            <div class="bold" style="font-size: 13px;">SALDO DEVEDOR ATUAL</div>
            <div class="bold" style="font-size: 18px; margin: 4px 0;">R$ ${balance.toFixed(2)}</div>
          </div>

          <div class="double-line"></div>

          <div class="center" style="margin-top: 15px;">
            <div>Obrigado pela preferência!</div>
            <div style="font-size: 9px; margin-top: 4px;">Ponto Certo Comida Caseira</div>
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

    printHtml(`Extrato-${selectedCustomer.name}`, html);
    triggerSuccess('Extrato impresso com sucesso!');
  };

  // Filtered customer list
  const filteredCustomers = customers.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.cnpj && c.cnpj.includes(searchQuery)) ||
      c.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'active') return matchesSearch && c.active;
    if (statusFilter === 'inactive') return matchesSearch && !c.active;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
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

      {/* Global Error Banner */}
      {error && (
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-red-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} />
            <p className="font-semibold text-xs">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-800">
            <X size={16} />
          </button>
        </div>
      )}

      {/* IF A CUSTOMER IS SELECTED: SHOW CUSTOMER DETAILS SCREEN */}
      {selectedCustomer ? (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          {/* Back button & Customer Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-stone-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                aria-label="Voltar para Lista de Clientes"
                onClick={() => setSelectedCustomer(null)}
                className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 hover:bg-stone-200 transition-all shrink-0"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="text-2xl font-bold text-stone-900">{selectedCustomer.name}</h3>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                    selectedCustomer.active 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedCustomer.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-1">Cliente desde {new Date(selectedCustomer.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                aria-label="Lançar Novo Pedido para Cliente"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Apenas Administradores podem lançar pedidos.');
                    return;
                  }
                  setShowNewOrderModal(true);
                }}
                className="bg-amber-500 text-stone-950 px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-amber-400 transition-all flex items-center gap-2 shadow-sm"
              >
                <Plus size={16} /> Novo Pedido
              </button>

              <button
                aria-label="Registrar Pagamento de Cliente"
                onClick={() => {
                  if (!isAdmin) {
                    alert('Apenas Administradores podem registrar pagamentos.');
                    return;
                  }
                  setShowPaymentModal(true);
                }}
                className="bg-emerald-600 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-emerald-500 transition-all flex items-center gap-2 shadow-sm"
              >
                <DollarSign size={16} /> Registrar Pagamento
              </button>

              <button
                aria-label="Imprimir Extrato de Cliente"
                onClick={handlePrintExtrato}
                className="bg-stone-900 text-white px-4 py-2.5 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all flex items-center gap-2 shadow-sm"
              >
                <Printer size={16} /> Imprimir Extrato
              </button>

              {isAdmin && (
                <button
                  aria-label="Editar Cliente"
                  onClick={() => openEditCustomer(selectedCustomer)}
                  className="bg-stone-100 text-stone-700 px-3 py-2.5 rounded-2xl hover:bg-stone-200 transition-all"
                  title="Editar dados"
                >
                  <Edit size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Customer Debt Balance Header Banner */}
          <div className="bg-stone-900 text-white p-8 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Saldo Devedor Atual</span>
              <p className={`text-4xl font-extrabold mt-1 ${
                calculateCustomerBalance(customerOrders, customerPayments) > 0 
                  ? 'text-red-400' 
                  : 'text-emerald-400'
              }`}>
                R$ {calculateCustomerBalance(customerOrders, customerPayments).toFixed(2)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-6 border-t sm:border-t-0 sm:border-l border-stone-800 pt-4 sm:pt-0 sm:pl-8 w-full sm:w-auto">
              <div>
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total de Pedidos</span>
                <p className="text-xl font-bold text-white mt-0.5">
                  R$ {customerOrders.reduce((a, b) => a + (b.total_price || 0), 0).toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Pago</span>
                <p className="text-xl font-bold text-emerald-400 mt-0.5">
                  R$ {customerPayments.reduce((a, b) => a + (b.amount || 0), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Customer Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <MapPin size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Endereço</span>
                <p className="font-bold text-stone-800 text-sm truncate">{selectedCustomer.address}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Phone size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Telefone</span>
                <p className="font-bold text-stone-800 text-sm truncate">{selectedCustomer.phone}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Building2 size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">CNPJ / Obs</span>
                <p className="font-bold text-stone-800 text-sm truncate">
                  {selectedCustomer.cnpj ? `CNPJ: ${selectedCustomer.cnpj}` : (selectedCustomer.observations || 'Nenhuma observação')}
                </p>
              </div>
            </div>
          </div>

          {/* Extrato Financeiro / Timeline */}
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-stone-100 pb-4">
              <div>
                <h4 className="text-lg font-bold text-stone-900">Extrato & Histórico de Lançamentos</h4>
                <p className="text-stone-500 text-xs mt-0.5">Registro cronológico de todos os pedidos e pagamentos realizados.</p>
              </div>
            </div>

            {customerOrders.length === 0 && customerPayments.length === 0 ? (
              <div className="text-center py-12 text-stone-400 space-y-3">
                <FileText size={48} className="mx-auto opacity-30" />
                <p className="font-bold text-stone-600">Nenhum lançamento no extrato deste cliente.</p>
                <p className="text-xs">Utilize os botões acima para lançar um novo pedido ou registrar pagamento.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Orders section */}
                <div className="space-y-3">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Histórico de Pedidos ({customerOrders.length})</h5>
                  {customerOrders.map(order => (
                    <div key={order.id} className="p-5 rounded-2xl bg-stone-50 border border-stone-100 space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <span className="text-xs text-stone-400 font-bold">
                            {new Date(order.created_at).toLocaleDateString('pt-BR')} às {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <p className="text-xs text-stone-500">Lançado por: {order.created_by || 'Admin'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-stone-900">R$ {order.total_price.toFixed(2)}</span>
                          {isAdmin && (
                            <button
                              aria-label="Excluir pedido"
                              onClick={() => handleDeleteCustomerOrder(order.id, order.total_price)}
                              className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                              title="Excluir pedido"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Items table inside order */}
                      <div className="bg-white p-3 rounded-xl border border-stone-200/60 text-xs space-y-1.5">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="flex justify-between items-center text-stone-700">
                            <span>
                              <strong className="text-stone-900">{it.quantity}x</strong> {it.name}
                              {it.observation && <span className="text-stone-400 italic ml-2">({it.observation})</span>}
                            </span>
                            <span className="font-semibold text-stone-900">
                              R$ {(it.custom_price * it.quantity).toFixed(2)}
                              <span className="text-[10px] text-stone-400 ml-1 font-normal">(un: R$ {it.custom_price.toFixed(2)})</span>
                            </span>
                          </div>
                        ))}
                      </div>
                      {order.observations && (
                        <p className="text-xs text-stone-500 italic bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                          Obs do Pedido: {order.observations}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {/* Payments section */}
                <div className="space-y-3 pt-4 border-t border-stone-100">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-stone-400 px-1">Pagamentos Registrados ({customerPayments.length})</h5>
                  {customerPayments.map(pay => (
                    <div key={pay.id} className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex justify-between items-center gap-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-950 text-sm">Pagamento via {pay.payment_method}</span>
                          <span className="text-[10px] bg-emerald-200 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full">Crédito</span>
                        </div>
                        <p className="text-xs text-emerald-800">
                          Data: {new Date(pay.date).toLocaleDateString('pt-BR')} às {new Date(pay.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {pay.created_by && ` • Por: ${pay.created_by}`}
                        </p>
                        {pay.observation && <p className="text-xs text-stone-500 italic">Obs: {pay.observation}</p>}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-emerald-600">- R$ {pay.amount.toFixed(2)}</span>
                        {isAdmin && (
                          <button
                            aria-label="Excluir pagamento"
                            onClick={() => handleDeleteCustomerPayment(pay.id, pay.amount)}
                            className="text-stone-400 hover:text-red-500 p-1 transition-colors"
                            title="Excluir pagamento"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        /* CUSTOMER LISTING VIEW */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Header & Controls */}
          <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-stone-900">Cadastro de Clientes (Fiado)</h3>
              <p className="text-stone-500 text-xs mt-1">Gestão de clientes com pagamento semanal, preços personalizados e histórico financeiro.</p>
            </div>

            <button
              aria-label="Cadastrar Novo Cliente"
              onClick={() => {
                if (!isAdmin) {
                  alert('Apenas Administradores podem cadastrar clientes.');
                  return;
                }
                resetCustomerForm();
                setShowAddCustomerModal(true);
              }}
              className="bg-stone-900 text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider hover:bg-stone-800 transition-all flex items-center gap-2 shadow-md shrink-0 w-full md:w-auto justify-center"
            >
              <UserPlus size={16} /> Novo Cliente
            </button>
          </div>

          {/* Search bar & Filter tabs */}
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar cliente por nome, telefone, endereço ou CNPJ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-white border border-stone-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-stone-200 shrink-0">
              <button
                aria-label="Filtrar Todos Clientes"
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'all' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Todos ({customers.length})
              </button>
              <button
                aria-label="Filtrar Clientes Ativos"
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'active' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Ativos ({customers.filter(c => c.active).length})
              </button>
              <button
                aria-label="Filtrar Clientes Inativos"
                onClick={() => setStatusFilter('inactive')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === 'inactive' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Inativos ({customers.filter(c => !c.active).length})
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center space-y-4">
              <div className="w-10 h-10 border-4 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-stone-500 font-medium text-sm">Carregando carteira de clientes...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filteredCustomers.length === 0 && (
            <div className="bg-white p-12 rounded-3xl border border-stone-100 text-center text-stone-400 space-y-3">
              <UserCheck size={48} className="mx-auto opacity-30" />
              <p className="font-bold text-stone-600">Nenhum cliente encontrado.</p>
              <p className="text-xs">
                {searchQuery ? 'Tente ajustar os termos de pesquisa.' : 'Clique no botão "+ Novo Cliente" para cadastrar o primeiro cliente.'}
              </p>
            </div>
          )}

          {/* Customer Cards Grid */}
          {!loading && filteredCustomers.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCustomers.map(cust => (
                <div
                  key={cust.id}
                  onClick={() => setSelectedCustomer(cust)}
                  className="bg-white p-6 rounded-3xl border border-stone-100 hover:border-amber-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-stone-900 text-lg group-hover:text-amber-600 transition-colors truncate">
                          {cust.name}
                        </h4>
                        <p className="text-xs text-stone-400">Tel: {cust.phone}</p>
                      </div>
                      <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full shrink-0 ${
                        cust.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {cust.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-stone-500">
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin size={14} className="text-stone-400 shrink-0" />
                        <span className="truncate">{cust.address}</span>
                      </p>
                      {cust.cnpj && (
                        <p className="flex items-center gap-1.5">
                          <Building2 size={14} className="text-stone-400 shrink-0" />
                          <span>CNPJ: {cust.cnpj}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-stone-100 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider">Saldo Devedor</span>
                      <p className={`font-black text-lg ${
                        (cust.current_balance || 0) > 0 ? 'text-red-500' : 'text-emerald-600'
                      }`}>
                        R$ {(cust.current_balance || 0).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <button
                          aria-label="Excluir cliente"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCustomer(cust);
                          }}
                          className="p-2 text-stone-300 hover:text-red-500 transition-colors"
                          title="Excluir cliente"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <div className="w-8 h-8 rounded-full bg-stone-50 group-hover:bg-amber-400 group-hover:text-stone-950 flex items-center justify-center transition-colors">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* MODAL 1: ADD / EDIT CUSTOMER */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 md:p-8 max-w-lg w-full space-y-6 border border-stone-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-100 pb-4">
              <h3 className="text-xl font-bold text-stone-900">
                {editingCustomer ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}
              </h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="text-stone-400 hover:text-stone-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Nome Completo / Razão Social *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João da Silva / Construtora X"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Endereço de Entrega *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Av. Central, nº 120, Bairro Centro"
                  value={custAddress}
                  onChange={e => setCustAddress(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Telefone / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="(00) 00000-0000"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">CNPJ (Opcional)</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={custCnpj}
                    onChange={e => setCustCnpj(e.target.value)}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Observações Internas</label>
                <textarea
                  rows={3}
                  placeholder="Instruções de pagamento, preferências ou horários de entrega..."
                  value={custObs}
                  onChange={e => setCustObs(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-stone-900"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={custActive}
                  onChange={e => setCustActive(e.target.checked)}
                  className="w-5 h-5 accent-stone-900 rounded cursor-pointer"
                />
                <label htmlFor="activeCheck" className="text-sm font-bold text-stone-800 cursor-pointer">
                  Cliente Ativo (Permite novos pedidos e lançamentos)
                </label>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="w-1/2 py-3.5 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-200 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3.5 bg-stone-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-800 transition-all shadow-md"
                >
                  {editingCustomer ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL 2: LAUNCH NEW ORDER WITH CUSTOM PRICES */}
      {showNewOrderModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full space-y-6 border border-stone-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900">Lançar Novo Pedido</h3>
                <p className="text-xs text-stone-500">Cliente: <strong className="text-stone-900">{selectedCustomer.name}</strong></p>
              </div>
              <button onClick={() => setShowNewOrderModal(false)} className="text-stone-400 hover:text-stone-900">
                <X size={20} />
              </button>
            </div>

            {/* Select items from menu */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">Adicionar Pratos do Cardápio</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Pesquisar item no cardápio..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="max-h-40 overflow-y-auto border border-stone-100 rounded-xl p-2 space-y-1.5 bg-stone-50/50">
                {menuItems
                  .filter(it => it.name.toLowerCase().includes(itemSearch.toLowerCase()))
                  .map(it => (
                    <div key={it.id} className="flex justify-between items-center p-2 hover:bg-white rounded-lg transition-colors text-xs">
                      <div>
                        <span className="font-bold text-stone-800">{it.name}</span>
                        <span className="text-stone-400 ml-2">Padrao: R$ {it.price.toFixed(2)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddProductToOrder(it)}
                        className="bg-stone-900 text-white px-3 py-1 rounded-lg font-bold text-[10px] uppercase hover:bg-amber-500 hover:text-stone-950 transition-all"
                      >
                        + Adicionar
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Selected Items List with Custom Price Editor */}
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600">
                Itens do Pedido (Defina os Preços Customizados)
              </label>

              {orderItemsList.length === 0 ? (
                <div className="p-6 border border-dashed border-stone-200 rounded-2xl text-center text-xs text-stone-400">
                  Nenhum produto selecionado. Clique em "+ Adicionar" acima.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderItemsList.map((entry, idx) => (
                    <div key={idx} className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
                      <div className="flex justify-between items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm">{entry.item.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = orderItemsList.filter((_, i) => i !== idx);
                            setOrderItemsList(updated);
                          }}
                          className="text-stone-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 uppercase">Quantidade</label>
                          <input
                            type="number"
                            min="1"
                            value={entry.quantity}
                            onChange={e => {
                              const qty = parseInt(e.target.value) || 1;
                              const updated = [...orderItemsList];
                              updated[idx].quantity = qty;
                              setOrderItemsList(updated);
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-amber-600 uppercase">Preço Customizado (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={entry.custom_price}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = [...orderItemsList];
                              updated[idx].custom_price = val;
                              setOrderItemsList(updated);
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-stone-900 focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-stone-500 uppercase">Subtotal</label>
                          <div className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs font-bold text-emerald-600">
                            R$ {(entry.custom_price * entry.quantity).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="Observação do item (ex: Sem sal, extra molho)..."
                        value={entry.observation}
                        onChange={e => {
                          const updated = [...orderItemsList];
                          updated[idx].observation = e.target.value;
                          setOrderItemsList(updated);
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Observações do Pedido Geral</label>
              <input
                type="text"
                placeholder="Ex: Entregar até 12:30 na portaria"
                value={orderObs}
                onChange={e => setOrderObs(e.target.value)}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
              />
            </div>

            {/* Total Order Summary & Submit */}
            <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
              <div>
                <span className="text-xs text-stone-400 uppercase font-bold tracking-wider">Total do Pedido</span>
                <p className="text-2xl font-black text-amber-500">
                  R$ {orderItemsList.reduce((acc, i) => acc + (i.custom_price * i.quantity), 0).toFixed(2)}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-3 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomerOrder}
                  disabled={orderItemsList.length === 0}
                  className="px-6 py-3 bg-stone-900 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-800 disabled:opacity-50 shadow-md"
                >
                  Confirmar e Lançar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL 3: REGISTER PAYMENT */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full space-y-6 border border-stone-100 shadow-2xl">
            <div className="flex justify-between items-center border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-xl font-bold text-stone-900">Registrar Pagamento</h3>
                <p className="text-xs text-stone-500">Cliente: <strong className="text-stone-900">{selectedCustomer.name}</strong></p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-stone-400 hover:text-stone-900">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Valor do Pagamento (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-lg font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Forma de Pagamento *</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-bold text-stone-800 focus:outline-none"
                >
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="PIX">PIX</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Transferência Bancária">Transferência Bancária</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Data e Hora *</label>
                <input
                  type="datetime-local"
                  required
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Observações</label>
                <input
                  type="text"
                  placeholder="Ex: Comprovante enviado via WhatsApp"
                  value={payObs}
                  onChange={e => setPayObs(e.target.value)}
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="w-1/2 py-3.5 bg-stone-100 text-stone-700 font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-stone-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3.5 bg-emerald-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-500 shadow-md"
                >
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
