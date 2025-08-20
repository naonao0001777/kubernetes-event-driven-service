import { Order, WebSocketMessage } from '../types';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private orderId: string;
  private onMessage: (order: Order) => void;
  private onError: (error: Event) => void;
  private onConnect?: () => void;
  private onDisconnect?: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(
    orderId: string,
    onMessage: (order: Order) => void,
    onError: (error: Event) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ) {
    this.orderId = orderId;
    this.onMessage = onMessage;
    this.onError = onError;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
  }

  connect(): void {
    try {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
      const wsUrl = `ws://${hostname}:8087/ws/${this.orderId}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log(`WebSocket connected for order: ${this.orderId}`);
        this.reconnectAttempts = 0;
        this.onConnect?.();
      };

      this.ws.onmessage = (event) => {
        try {
          const order: Order = JSON.parse(event.data);
          this.onMessage(order);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.onError(error);
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket closed for order: ${this.orderId}`, event.code, event.reason);
        this.onDisconnect?.();
        
        if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.onError(error as Event);
    }
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting to reconnect WebSocket (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'DISCONNECTED';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'CLOSED';
      default:
        return 'UNKNOWN';
    }
  }
}

// React Hook for WebSocket management
export function createWebSocketHook() {
  return function useOrderTracking(
    orderId: string,
    options: {
      onConnect?: () => void;
      onDisconnect?: () => void;
      onError?: (error: Event) => void;
    } = {}
  ) {
    const [order, setOrder] = React.useState(null as Order | null);
    const [connected, setConnected] = React.useState(false);
    const [connectionState, setConnectionState] = React.useState('DISCONNECTED');
    
    React.useEffect(() => {
      if (!orderId) return;

      const wsClient = new WebSocketClient(
        orderId,
        (updatedOrder: Order) => {
          setOrder(updatedOrder);
        },
        (error: Event) => {
          console.error('WebSocket error:', error);
          setConnected(false);
          setConnectionState('ERROR');
          options.onError?.(error);
        },
        () => {
          setConnected(true);
          setConnectionState('CONNECTED');
          options.onConnect?.();
        },
        () => {
          setConnected(false);
          setConnectionState('DISCONNECTED');
          options.onDisconnect?.();
        }
      );

      wsClient.connect();

      // Update connection state periodically
      const stateInterval = setInterval(() => {
        setConnectionState(wsClient.getConnectionState());
      }, 1000);

      return () => {
        clearInterval(stateInterval);
        wsClient.disconnect();
      };
    }, [orderId]);

    return { 
      order, 
      connected, 
      connectionState,
      isConnected: connected
    };
  };
}

// For environments where React is available
let React: any;
try {
  React = require('react');
} catch (e) {
  // React not available, hook will be created when needed
}