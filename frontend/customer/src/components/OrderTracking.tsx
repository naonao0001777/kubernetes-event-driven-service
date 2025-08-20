'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types';
import { Input, Button, LoadingSpinner, Alert, OrderStatusBadge, ConnectionStatus } from '@/components/common';
import { formatDate, formatProductId, formatCurrency } from '@/utils/formatters';
import { WebSocketClient } from '@/utils/websocket';

interface OrderTrackingProps {
  orderId: string;
  onOrderIdChange: (orderId: string) => void;
}

export function OrderTracking({ orderId, onOrderIdChange }: OrderTrackingProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionState, setConnectionState] = useState('DISCONNECTED');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null);

  // Start tracking when orderId changes
  useEffect(() => {
    if (orderId && orderId.trim()) {
      startTracking(orderId);
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [orderId]);

  const startTracking = async (trackingOrderId: string) => {
    setLoading(true);
    setError(null);

    try {
      // First fetch current order status
      await loadOrderStatus(trackingOrderId);

      // Then setup WebSocket for real-time updates
      setupWebSocket(trackingOrderId);

    } catch (err) {
      console.error('Error starting tracking:', err);
      setError(err instanceof Error ? err.message : 'Failed to start tracking');
      setLoading(false);
    }
  };

  const loadOrderStatus = async (trackingOrderId: string) => {
    try {
      const response = await fetch(`/api/status/${trackingOrderId}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Order not found. Please check the order ID.');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const orderData: Order = await response.json();
      setOrder(orderData);
      setLoading(false);
    } catch (err) {
      throw err;
    }
  };

  const setupWebSocket = (trackingOrderId: string) => {
    // Clean up existing connection
    if (wsClient) {
      wsClient.disconnect();
    }

    const client = new WebSocketClient(
      trackingOrderId,
      (updatedOrder: Order) => {
        setOrder(updatedOrder);
        setLoading(false);
      },
      (error: Event) => {
        console.error('WebSocket error:', error);
        setError('Connection error. Trying to reconnect...');
        setConnected(false);
      },
      () => {
        setConnected(true);
        setConnectionState('CONNECTED');
        setError(null);
      },
      () => {
        setConnected(false);
        setConnectionState('DISCONNECTED');
      }
    );

    client.connect();
    setWsClient(client);

    // Monitor connection state
    const stateInterval = setInterval(() => {
      if (client) {
        setConnectionState(client.getConnectionState());
      }
    }, 1000);

    return () => {
      clearInterval(stateInterval);
      client.disconnect();
    };
  };

  const stopTracking = () => {
    if (wsClient) {
      wsClient.disconnect();
      setWsClient(null);
    }
    setConnected(false);
    setConnectionState('DISCONNECTED');
    setOrder(null);
    setError(null);
    setLoading(false);
  };

  const handleTrackOrder = () => {
    if (orderId && orderId.trim()) {
      startTracking(orderId);
    } else {
      setError('Please enter a valid order ID');
    }
  };

  const getOrderProgress = (order: Order) => {
    const stages = [
      { key: 'created', label: 'Order Created', icon: '📝' },
      { key: 'inventory_confirmed', label: 'Inventory Confirmed', icon: '✅' },
      { key: 'payment_completed', label: 'Payment Completed', icon: '💳' },
      { key: 'notification_sent', label: 'Notification Sent', icon: '📧' },
      { key: 'shipped', label: 'Shipped', icon: '🚚' }
    ];

    const currentStageIndex = stages.findIndex(stage => stage.key === order.status);
    return stages.map((stage, index) => ({
      ...stage,
      completed: index <= currentStageIndex,
      current: index === currentStageIndex,
      failed: order.status.includes('rejected') || order.status.includes('failed')
    }));
  };

  const getOrderTotal = (order: Order) => {
    if (order.payment_amount) {
      return order.payment_amount;
    }
    
    const productPrices: Record<string, number> = {
      'product-1': 29.99,
      'product-2': 49.99,
      'product-3': 99.99
    };
    
    return (productPrices[order.product_id] || 0) * order.quantity;
  };

  return (
    <div className="space-y-6">
      {/* Order ID Input */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Track Your Order</h3>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Input
            placeholder="Enter Order ID (e.g., ORD-123456)"
            value={orderId}
            onChange={onOrderIdChange}
            className="flex-1"
          />
          <Button
            variant="primary"
            onClick={handleTrackOrder}
            loading={loading}
            disabled={loading || !orderId.trim()}
          >
            🔍 Track Order
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {orderId && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <ConnectionStatus connected={connected} connectionState={connectionState} />
          {connected && order && (
            <span className="text-sm text-gray-600">
              Receiving real-time updates for Order #{order.order_id.slice(-8).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Loading State */}
      {loading && !order && (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
          <span className="ml-3 text-gray-600">Loading order details...</span>
        </div>
      )}

      {/* Order Details */}
      {order && (
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Order #{order.order_id.slice(-8).toUpperCase()}
              </h3>
              <OrderStatusBadge status={order.status as any} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Product Details</h4>
                <p className="text-gray-600">{formatProductId(order.product_id)}</p>
                <p className="text-sm text-gray-500">Quantity: {order.quantity}</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Order Total</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(getOrderTotal(order))}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Order Date</h4>
                <p className="text-gray-600">{formatDate(order.last_updated)}</p>
                {order.tracking_number && (
                  <>
                    <h4 className="font-medium text-gray-900 mb-1 mt-3">Tracking Number</h4>
                    <p className="text-sm font-mono text-blue-600">{order.tracking_number}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Order Progress */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Progress</h3>
            
            <div className="relative">
              {getOrderProgress(order).map((stage, index, array) => (
                <div key={stage.key} className="flex items-center mb-6 last:mb-0">
                  {/* Progress Line */}
                  {index < array.length - 1 && (
                    <div className={`absolute left-6 top-12 w-0.5 h-6 ${
                      stage.completed ? 'bg-green-500' : 'bg-gray-300'
                    }`} style={{ marginLeft: '1px' }}></div>
                  )}
                  
                  {/* Stage Icon */}
                  <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                    stage.current 
                      ? 'bg-blue-100 border-2 border-blue-500' 
                      : stage.completed
                        ? 'bg-green-100 border-2 border-green-500'
                        : 'bg-gray-100 border-2 border-gray-300'
                  }`}>
                    <span className="text-xl">{stage.icon}</span>
                  </div>
                  
                  {/* Stage Details */}
                  <div className="ml-4 flex-1">
                    <h4 className={`font-medium ${
                      stage.current ? 'text-blue-700' : stage.completed ? 'text-green-700' : 'text-gray-500'
                    }`}>
                      {stage.label}
                    </h4>
                    {stage.current && (
                      <p className="text-sm text-blue-600 mt-1">Currently processing...</p>
                    )}
                    {stage.completed && !stage.current && (
                      <p className="text-sm text-green-600 mt-1">✓ Completed</p>
                    )}
                  </div>
                  
                  {/* Timestamp */}
                  {order.events && order.events.find(e => e.event_type.toLowerCase().includes(stage.key)) && (
                    <div className="text-sm text-gray-500">
                      {formatDate(order.events.find(e => e.event_type.toLowerCase().includes(stage.key))!.timestamp)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Event Timeline */}
          {order.events && order.events.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Timeline</h3>
              <div className="space-y-3">
                {order.events.slice().reverse().map((event, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">
                          {event.event_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </h4>
                        <span className="text-sm text-gray-500">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                      {event.data && event.data !== '{}' && (
                        <p className="text-sm text-gray-600 mt-1">
                          {event.data}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Order State */}
      {!loading && !order && orderId && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Order Not Found</h3>
          <p className="text-gray-600">
            Please check your order ID and try again.
          </p>
        </div>
      )}

      {/* Welcome State */}
      {!orderId && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Track Your Order</h3>
          <p className="text-gray-600">
            Enter your order ID above to see real-time tracking information.
          </p>
        </div>
      )}
    </div>
  );
}