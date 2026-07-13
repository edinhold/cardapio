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

export interface SalesStats {
  daily: number;
  weekly: number;
  monthly: number;
  salesOverTime: { date: string; total: number }[];
}
