'use client';

import { useState, useEffect } from 'react';
import { Order } from '@/types';
import { Button, LoadingSpinner, Alert, OrderStatusBadge } from '@/components/common';
import { formatDate, formatCurrency, formatProductId } from '@/utils/formatters';

interface OrderHistoryProps {
  onTrackOrder: (orderId: string) => void;
}

export function OrderHistory({ onTrackOrder }: OrderHistoryProps) {
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrders(data.orders || data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load order history');
      setLoading(false);
    }
  };

  const getLatestEvent = (order: Order) => {
    if (!order.events || order.events.length === 0) {
      return { event_type: 'created', timestamp: order.last_updated };
    }
    return order.events[order.events.length - 1];
  };

  const getOrderTotal = (order: Order) => {
    // Calculate based on payment_amount if available, otherwise estimate
    if (order.payment_amount) {
      return order.payment_amount;
    }
    
    // Fallback to estimated calculation
    const productPrices: Record<string, number> = {
      'product-1': 29.99,
      'product-2': 49.99,
      'product-3': 99.99
    };
    
    return (productPrices[order.product_id] || 0) * order.quantity;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading your orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Error Loading Orders"
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

  const ordersList = Object.values(orders);

  if (ordersList.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Yet</h3>
        <p className="text-gray-600 mb-4">
          You haven't placed any orders yet. Start shopping to see your order history here!
        </p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Refresh Orders
        </Button>
      </div>
    );
  }

  // Sort orders by last updated (most recent first)
  const sortedOrders = ordersList.sort(
    (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );

  const orderStats = {
    total: ordersList.length,
    completed: ordersList.filter(o => o.status === 'shipped').length,
    pending: ordersList.filter(o => ['created', 'inventory_confirmed', 'payment_completed', 'notification_sent'].includes(o.status)).length,
    failed: ordersList.filter(o => ['inventory_rejected', 'payment_failed'].includes(o.status)).length
  };

  return (
    <div className="space-y-6">
      {/* Order Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{orderStats.total}</div>
          <div className="text-sm text-blue-700">Total Orders</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{orderStats.completed}</div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{orderStats.pending}</div>
          <div className="text-sm text-yellow-700">In Progress</div>
        </div>
        <div className="bg-red-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{orderStats.failed}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {sortedOrders.map((order) => {
          const latestEvent = getLatestEvent(order);
          const total = getOrderTotal(order);
          
          return (
            <div
              key={order.order_id}
              className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order.order_id.slice(-8).toUpperCase()}
                    </h3>
                    <OrderStatusBadge status={order.status as any} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Product:</span>
                      <br />
                      {formatProductId(order.product_id)}
                    </div>
                    <div>
                      <span className="font-medium">Quantity:</span>
                      <br />
                      {order.quantity} unit{order.quantity > 1 ? 's' : ''}
                    </div>
                    <div>
                      <span className="font-medium">Total:</span>
                      <br />
                      <span className="text-lg font-semibold text-blue-600">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-gray-500">
                    <span className="font-medium">Last Updated:</span> {formatDate(order.last_updated)}
                    {order.tracking_number && (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-medium">Tracking:</span> {order.tracking_number}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-2">
                  <Button
                    variant="primary"
                    onClick={() => onTrackOrder(order.order_id)}
                    size="sm"
                  >
                    🔍 Track Order
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.open(`/api/orders/${order.order_id}`, '_blank')}
                    size="sm"
                  >
                    📄 View Details
                  </Button>
                </div>
              </div>

              {/* Event Timeline Preview */}
              {order.events && order.events.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity</h4>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>{latestEvent.event_type.replace('_', ' ')}</span>
                    <span className="text-gray-400">•</span>
                    <span>{formatDate(latestEvent.timestamp)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Refresh Button */}
      <div className="text-center pt-4">
        <Button
          variant="outline"
          onClick={loadOrders}
          disabled={loading}
          loading={loading}
        >
          🔄 Refresh Orders
        </Button>
      </div>
    </div>
  );
}