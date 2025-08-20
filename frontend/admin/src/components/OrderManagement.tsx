'use client';

import { useState, useEffect } from 'react';
import { Card, LoadingSpinner, Alert, OrderStatusBadge } from '@/components/common';
import { Order } from '@/types';
import { formatDate, formatCurrency, formatProductId } from '@/utils/formatters';

export function OrderManagement() {
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
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setOrders(data.orders || data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Failed to load orders');
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

  const ordersList = Object.values(orders);
  const sortedOrders = ordersList.sort(
    (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
  );

  return (
    <div className="space-y-6">
      <Card title="Order Overview" subtitle="Manage and monitor all customer orders">
        {sortedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead className="admin-table-header">
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody className="admin-table-body">
                {sortedOrders.map((order) => (
                  <tr key={order.order_id} className="admin-table-row">
                    <td className="admin-table-cell">
                      <div className="font-mono text-sm">
                        #{order.order_id.slice(-8).toUpperCase()}
                      </div>
                    </td>
                    <td className="admin-table-cell">
                      <div className="font-medium">
                        {formatProductId(order.product_id)}
                      </div>
                    </td>
                    <td className="admin-table-cell">
                      <div>{order.quantity}</div>
                    </td>
                    <td className="admin-table-cell">
                      <div className="font-semibold">
                        {formatCurrency(getOrderTotal(order))}
                      </div>
                    </td>
                    <td className="admin-table-cell">
                      <OrderStatusBadge status={order.status as any} />
                    </td>
                    <td className="admin-table-cell">
                      <div className="text-sm text-gray-600">
                        {formatDate(order.last_updated)}
                      </div>
                    </td>
                    <td className="admin-table-cell">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-800 text-sm">
                          View
                        </button>
                        <button className="text-gray-600 hover:text-gray-800 text-sm">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
            <p className="text-gray-600">Orders will appear here as customers place them.</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Order Statistics">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Orders:</span>
              <span className="font-semibold">{ordersList.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Completed:</span>
              <span className="font-semibold text-green-600">
                {ordersList.filter(o => o.status === 'shipped').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>In Progress:</span>
              <span className="font-semibold text-blue-600">
                {ordersList.filter(o => !['shipped', 'inventory_rejected', 'payment_failed'].includes(o.status)).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Failed:</span>
              <span className="font-semibold text-red-600">
                {ordersList.filter(o => o.status.includes('rejected') || o.status.includes('failed')).length}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Recent Activity">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📈</div>
            <p className="text-sm text-gray-600">Order activity tracking</p>
          </div>
        </Card>

        <Card title="Order Actions">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">⚡</div>
            <p className="text-sm text-gray-600">Bulk order operations</p>
          </div>
        </Card>
      </div>
    </div>
  );
}