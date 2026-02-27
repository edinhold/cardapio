export interface Item {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'dish' | 'drink';
  is_dish_of_day: number;
  image_url: string;
  icon?: string;
  observation_info?: string;
}

export interface Addon {
  id: number;
  name: string;
  price: number;
}

export interface Employee {
  id: number;
  name: string;
  role: string;
}

export interface Table {
  id: number;
  number: number;
  status: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  quantity: number;
  price_at_time: number;
  name?: string;
  observation?: string;
  addons?: { id: number; name: string; price_at_time: number }[];
}

export interface Order {
  id: number;
  table_id: number;
  table_number?: number;
  total_price: number;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'paid';
  created_at: string;
  items: OrderItem[];
}

export interface SalesStats {
  daily: number;
  weekly: number;
  monthly: number;
  salesOverTime: { date: string; total: number }[];
}
