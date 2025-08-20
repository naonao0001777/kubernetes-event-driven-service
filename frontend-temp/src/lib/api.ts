import axios from 'axios';
import { CreateOrderRequest, CreateOrderResponse, Order, Inventory } from '@/types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

export const orderAPI = {
  create: async (orderData: CreateOrderRequest): Promise<CreateOrderResponse> => {
    const response = await api.post<CreateOrderResponse>('/order', orderData);
    return response.data;
  },

  getStatus: async (orderId: string): Promise<Order> => {
    const response = await api.get<Order>(`/status/${orderId}`);
    return response.data;
  },

  getAllOrders: async (): Promise<{ orders: Record<string, Order> }> => {
    const response = await api.get<{ orders: Record<string, Order> }>('/orders');
    return response.data;
  },
};

export const inventoryAPI = {
  get: async (): Promise<{ inventory: Inventory }> => {
    const response = await api.get<{ inventory: Inventory }>('/inventory');
    return response.data;
  },
};

export const shipmentAPI = {
  getAll: async (): Promise<{ shipments: any[] }> => {
    const response = await api.get<{ shipments: any[] }>('/shipments');
    return response.data;
  },
};

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private orderId: string;
  private onMessage: (order: Order) => void;
  private onError: (error: Event) => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(orderId: string, onMessage: (order: Order) => void, onError: (error: Event) => void) {
    this.orderId = orderId;
    this.onMessage = onMessage;
    this.onError = onError;
  }

  connect() {
    try {
      // Use window.location.hostname to get the current host for WebSocket connection
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const wsUrl = `ws://${hostname}:8085/ws/${this.orderId}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`WebSocket connected for order: ${this.orderId}`);
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const order: Order = JSON.parse(event.data);
          this.onMessage(order);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(error);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      this.onError(error as Event);
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, 2000 * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}