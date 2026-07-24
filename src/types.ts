export interface Item {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'dish' | 'drink';
  is_dish_of_day: boolean;
  image_url: string;
  icon?: string;
  observation_info?: string;
}

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
}

export interface Table {
  id: string;
  number: number;
  status: string;
}

export interface OrderItem {
  id?: string;
  item_id: string;
  quantity: number;
  price_at_time: number;
  name?: string;
  observation?: string;
  addons?: { id: string; name: string; price_at_time: number }[];
}

export interface Order {
  id: string;
  table_id?: string | number;
  table_number?: number;
  total_price: number;
  payment_method?: 'dinheiro' | 'cartao' | 'pix' | string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid' | 'canceled';
  type: 'table' | 'counter' | 'delivery';
  created_at: string;
  delivery_info?: {
    name: string;
    phone: string;
    address: string;
  } | null;
  items: OrderItem[];
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  cnpj?: string;
  observations?: string;
  active: boolean;
  created_at: string;
  current_balance?: number;
}

export interface CustomerOrderItem {
  item_id: string;
  name: string;
  quantity: number;
  original_price: number;
  custom_price: number;
  observation?: string;
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  customer_name?: string;
  total_price: number;
  created_at: string;
  observations?: string;
  created_by?: string;
  items: CustomerOrderItem[];
}

export interface CustomerPayment {
  id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  date: string;
  observation?: string;
  created_by?: string;
}

export interface DailyClosure {
  id?: string;
  date: string;
  issued_at: string;
  responsible: string;
  total_cash: number;
  total_card: number;
  total_pix: number;
  total_overall: number;
  total_orders: number;
  average_ticket: number;
}

export interface SalesStats {
  daily: number;
  weekly: number;
  monthly: number;
  salesOverTime: { date: string; total: number }[];
}
