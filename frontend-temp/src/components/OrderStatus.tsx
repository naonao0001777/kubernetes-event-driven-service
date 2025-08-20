'use client';

import { useState, useEffect, useRef } from 'react';
import { Truck, CreditCard, Bell, Package, CheckCircle, XCircle, Clock, Wifi, WifiOff } from 'lucide-react';
import { Order, OrderEvent, OrderStatus as Status } from '@/types';
import { WebSocketClient, orderAPI } from '@/lib/api';

interface OrderStatusProps {
  orderId: string;
}

export default function OrderStatus({ orderId }: OrderStatusProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsClient = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    fetchOrderStatus();
    setupWebSocket();

    return () => {
      if (wsClient.current) {
        wsClient.current.disconnect();
      }
    };
  }, [orderId]);

  const fetchOrderStatus = async () => {
    try {
      const data = await orderAPI.getStatus(orderId);
      setOrder(data);
      setError(null);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Order not found');
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    wsClient.current = new WebSocketClient(
      orderId,
      (updatedOrder: Order) => {
        setOrder(updatedOrder);
        setWsConnected(true);
      },
      (error: Event) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      }
    );
    wsClient.current.connect();
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'created': return 'text-blue-600 bg-blue-100';
      case 'inventory_confirmed': return 'text-green-600 bg-green-100';
      case 'inventory_rejected': return 'text-red-600 bg-red-100';
      case 'payment_completed': return 'text-green-600 bg-green-100';
      case 'payment_failed': return 'text-red-600 bg-red-100';
      case 'notification_sent': return 'text-purple-600 bg-purple-100';
      case 'shipped': return 'text-indigo-600 bg-indigo-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'OrderCreated': return <Package className="w-4 h-4" />;
      case 'InventoryConfirmed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'InventoryRejected': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'PaymentCompleted': return <CreditCard className="w-4 h-4 text-green-600" />;
      case 'PaymentFailed': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'NotificationSent': return <Bell className="w-4 h-4 text-purple-600" />;
      case 'Shipped': return <Truck className="w-4 h-4 text-indigo-600" />;
      default: return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const parseEventData = (data: string) => {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
  };

  const getEventDescription = (event: OrderEvent) => {
    const data = parseEventData(event.data);
    
    switch (event.event_type) {
      case 'OrderCreated':
        return `Order created for ${data.quantity} × ${data.product_id}`;
      case 'InventoryConfirmed':
        return `Inventory confirmed - ${data.quantity} items reserved`;
      case 'InventoryRejected':
        return `Inventory rejected - ${data.reason || 'Insufficient stock'}`;
      case 'PaymentCompleted':
        return `Payment of $${data.amount?.toFixed(2)} completed`;
      case 'PaymentFailed':
        return `Payment failed - ${data.reason}`;
      case 'NotificationSent':
        return `Notification sent via ${data.channel}`;
      case 'Shipped':
        return `Shipped via ${data.carrier} - Tracking: ${data.tracking_number}`;
      default:
        return event.event_type;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Order Status: {order.order_id.slice(0, 8)}...
        </h2>
        <div className="flex items-center gap-2">
          {wsConnected ? (
            <div className="flex items-center gap-1 text-green-600 text-sm">
              <Wifi className="w-4 h-4" />
              Live
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-500 text-sm">
              <WifiOff className="w-4 h-4" />
              Offline
            </div>
          )}
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
            {order.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-600">Product</h3>
          <p className="text-lg font-semibold">{order.product_id}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-600">Quantity</h3>
          <p className="text-lg font-semibold">{order.quantity}</p>
        </div>
        {order.payment_amount && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-600">Total</h3>
            <p className="text-lg font-semibold text-green-600">${order.payment_amount.toFixed(2)}</p>
          </div>
        )}
      </div>

      {order.tracking_number && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Shipping Information</h3>
          </div>
          <p className="text-blue-800">
            Tracking Number: <span className="font-mono font-medium">{order.tracking_number}</span>
          </p>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Order Timeline
        </h3>
        
        <div className="space-y-3">
          {order.events.map((event, index) => (
            <div key={index} className="flex items-start gap-4 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <div className="flex-shrink-0 mt-1">
                {getEventIcon(event.event_type)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">{event.event_type}</h4>
                  <span className="text-sm text-gray-500">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-gray-600 mt-1">{getEventDescription(event)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-xs text-gray-500 text-center">
        Last updated: {new Date(order.last_updated).toLocaleString()}
      </div>
    </div>
  );
}