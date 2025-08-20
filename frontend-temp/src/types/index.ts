export interface Order {
  order_id: string;
  product_id: string;
  quantity: number;
  status: string;
  events: OrderEvent[];
  last_updated: string;
  tracking_number?: string;
  payment_amount?: number;
}

export interface OrderEvent {
  event_type: string;
  data: string;
  timestamp: string;
}

export interface CreateOrderRequest {
  product_id: string;
  quantity: number;
}

export interface CreateOrderResponse {
  order_id: string;
  product_id: string;
  quantity: number;
  status: string;
}

export interface Inventory {
  [productId: string]: number;
}

export interface Shipment {
  order_id: string;
  product_id: string;
  quantity: number;
  event_type: string;
  tracking_number: string;
  carrier: string;
  estimated_delivery_days: number;
  shipped_at: string;
}

export type OrderStatus = 
  | 'created'
  | 'inventory_confirmed'
  | 'inventory_rejected'
  | 'payment_completed'
  | 'payment_failed'
  | 'notification_sent'
  | 'shipped';