// ========================================
// Existing Types (Customer-focused)
// ========================================

export interface Order {
  order_id: string;
  product_id: string;
  quantity: number;
  status: string;
  events: OrderEvent[];
  last_updated: string;
  tracking_number?: string;
  payment_amount?: number;
  // New fields for admin functionality
  customer_id?: string;
  admin_notes?: AdminNote[];
  priority?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderEvent {
  event_type: string;
  data: string;
  timestamp: string;
}

export interface CreateOrderRequest {
  product_id: string;
  quantity: number;
  customer_info?: CustomerInfo;
}

export interface CreateOrderResponse {
  order_id: string;
  product_id: string;
  quantity: number;
  status: string;
  estimated_total?: number;
  estimated_delivery?: string;
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

// ========================================
// New Types for Frontend Separation
// ========================================

// Product Management
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  images: string[];
  is_active: boolean;
  reorder_level?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductWithStock extends Product {
  current_stock: number;
  reserved_stock: number;
  available_stock: number;
  last_restocked?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  parent_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductForm {
  id?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  initial_stock: number;
  reorder_level: number;
  images: File[];
  is_active: boolean;
}

// Customer Information
export interface CustomerInfo {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  address?: Address;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

// Stock Management
export interface StockMovement {
  id: string;
  product_id: string;
  type: 'ADD' | 'REMOVE' | 'ADJUST' | 'RESERVE' | 'RELEASE';
  quantity: number;
  previous_qty: number;
  new_qty: number;
  reason: string;
  admin_id?: string;
  timestamp: string;
}

export interface StockAlert {
  product_id: string;
  product_name: string;
  current_stock: number;
  reorder_level: number;
  alert_level: 'LOW' | 'CRITICAL' | 'OUT_OF_STOCK';
  created_at: string;
}

export interface StockOperation {
  type: 'ADD' | 'REMOVE' | 'ADJUST';
  product_id: string;
  quantity: number;
  reason: string;
  cost?: number;
  supplier?: string;
}

export interface BulkStockOperation {
  operations: StockOperation[];
}

export interface BulkOperationError {
  operation_index: number;
  error: string;
}

// Admin Management
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'super_admin';
  is_active: boolean;
  created_at: string;
}

export interface AdminNote {
  id: string;
  admin_id: string;
  content: string;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  resource: string;
  details: Record<string, any>;
  ip_address: string;
  timestamp: string;
}

// Analytics and Metrics
export interface SystemMetrics {
  timestamp: string;
  total_orders: number;
  today_orders: number;
  total_revenue: number;
  today_revenue: number;
  active_products: number;
  low_stock_count: number;
  pending_orders: number;
  completed_orders: number;
}

export interface DashboardMetrics {
  today_orders: number;
  today_revenue: number;
  low_stock_products: number;
  pending_orders: number;
}

export interface TrendData {
  period: string;
  value: number;
  change_percentage: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string[];
  }[];
}

export interface RevenueAnalytics {
  date: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
}

export interface RevenueSummary {
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
  growth_rate: number;
}

// Extended Order Types for Admin
export interface OrderWithDetails extends Order {
  customer: {
    id: string;
    name: string;
    email: string;
  };
  product: Product;
  payment_details?: PaymentDetails;
  shipping_details?: ShippingDetails;
}

export interface PaymentDetails {
  amount: number;
  currency: string;
  method: string;
  processed_at: string;
  transaction_id: string;
}

export interface ShippingDetails {
  carrier: string;
  tracking_number: string;
  shipped_at: string;
  estimated_delivery: string;
  address: Address;
}

// Filter and Pagination Types
export interface ProductFilters {
  category?: string;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  is_active?: boolean;
}

export interface OrderFilters {
  status?: OrderStatus;
  customer_id?: string;
  date_from?: string;
  date_to?: string;
  priority?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  has_next: boolean;
  has_prev: boolean;
}

// System Alerts
export interface SystemAlert {
  id: string;
  type: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

// WebSocket Types
export interface WebSocketMessage {
  type: 'ORDER_UPDATE' | 'STOCK_ALERT' | 'SYSTEM_NOTIFICATION';
  data: any;
  timestamp: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, any>;
}

// Order Summary Types (for customer)
export interface OrderSummary {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spent: number;
}

// Delivery Options
export interface DeliveryOption {
  id: string;
  name: string;
  description: string;
  price: number;
  estimated_days: number;
}

// Tracking Types
export interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location?: string;
  timestamp: string;
}

// User Session Types
export interface UserSession {
  user_id: string;
  role: 'customer' | 'admin' | 'super_admin';
  permissions: string[];
  login_time: string;
  last_activity: string;
}

// JWT Payload
export interface JWTPayload {
  sub: string;        // User ID
  role: string;       // User role
  permissions: string[]; // Specific permissions
  iss: string;        // Issuer
  exp: number;        // Expiration time
  iat: number;        // Issued at
}

// Order Status Control (for admin)
export interface OrderStatusControl {
  order_id: string;
  current_status: OrderStatus;
  available_actions: string[];
  can_cancel: boolean;
  can_refund: boolean;
}