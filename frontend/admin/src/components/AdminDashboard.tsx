'use client';

import { useState, useEffect } from 'react';
import { Card, LoadingSpinner, Alert } from '@/components/common';
import { DashboardMetrics, SystemMetrics, Order } from '@/types';
import { formatCurrency, formatDate, formatPercentage } from '@/utils/formatters';

export function AdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load metrics and recent orders in parallel
      await Promise.all([
        loadMetrics(),
        loadRecentOrders()
      ]);
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      // For now, use mock data since Management Service isn't implemented yet
      // In production: const response = await fetch('/api/admin/dashboard/metrics');
      const mockMetrics: DashboardMetrics = {
        today_orders: 12,
        today_revenue: 1247.88,
        low_stock_products: 3,
        pending_orders: 8
      };
      setMetrics(mockMetrics);
    } catch (err) {
      throw new Error('Failed to load metrics');
    }
  };

  const loadRecentOrders = async () => {
    try {
      const response = await fetch('/api/orders');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const orders = Object.values(data.orders || data) as Order[];
      
      // Get most recent 5 orders
      const sortedOrders = orders.sort(
        (a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
      );
      setRecentOrders(sortedOrders.slice(0, 5));
    } catch (err) {
      console.error('Error loading recent orders:', err);
      // Continue without recent orders for now
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        type="error"
        title="Dashboard Error"
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

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
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="dashboard-metric">
          <div className="dashboard-metric-value text-blue-600">
            {metrics?.today_orders || 0}
          </div>
          <div className="dashboard-metric-label">Today's Orders</div>
          <div className="text-xs text-gray-500 mt-1">
            +12% from yesterday
          </div>
        </div>

        <div className="dashboard-metric">
          <div className="dashboard-metric-value text-green-600">
            {metrics ? formatCurrency(metrics.today_revenue) : '$0.00'}
          </div>
          <div className="dashboard-metric-label">Today's Revenue</div>
          <div className="text-xs text-gray-500 mt-1">
            +8% from yesterday
          </div>
        </div>

        <div className="dashboard-metric">
          <div className="dashboard-metric-value text-yellow-600">
            {metrics?.low_stock_products || 0}
          </div>
          <div className="dashboard-metric-label">Low Stock Items</div>
          <div className="text-xs text-gray-500 mt-1">
            Requires attention
          </div>
        </div>

        <div className="dashboard-metric">
          <div className="dashboard-metric-value text-purple-600">
            {metrics?.pending_orders || 0}
          </div>
          <div className="dashboard-metric-label">Pending Orders</div>
          <div className="text-xs text-gray-500 mt-1">
            Awaiting processing
          </div>
        </div>
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Overview Chart Placeholder */}
        <Card title="Sales Overview" subtitle="Revenue trends over the last 7 days">
          <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">📈</div>
              <p>Sales Chart</p>
              <p className="text-sm">Integration with Recharts coming soon</p>
            </div>
          </div>
        </Card>

        {/* Top Products */}
        <Card title="Top Products" subtitle="Best selling products today">
          <div className="space-y-4">
            {[
              { name: 'Premium Widget', sales: 8, revenue: 239.92 },
              { name: 'Deluxe Gadget', sales: 3, revenue: 149.97 },
              { name: 'Elite Device', sales: 1, revenue: 99.99 }
            ].map((product, index) => (
              <div key={product.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                    index === 0 ? 'bg-gold-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                  }`}>
                    #{index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{product.name}</div>
                    <div className="text-sm text-gray-500">{product.sales} sales</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatCurrency(product.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatPercentage(product.sales, 12)} of total
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card title="Recent Orders" subtitle="Latest customer orders">
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.order_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      Order #{order.order_id.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.quantity}x {order.product_id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatDate(order.last_updated)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(getOrderTotal(order))}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'shipped' ? 'bg-green-100 text-green-800' :
                      order.status.includes('failed') || order.status.includes('rejected') ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              <p>No recent orders</p>
            </div>
          )}
        </Card>

        {/* System Status */}
        <Card title="System Status" subtitle="Service health and performance">
          <div className="space-y-4">
            {[
              { service: 'Order Service', status: 'healthy', uptime: '99.9%' },
              { service: 'Inventory Service', status: 'healthy', uptime: '99.8%' },
              { service: 'Payment Service', status: 'healthy', uptime: '99.7%' },
              { service: 'Kafka Broker', status: 'healthy', uptime: '100%' },
              { service: 'Status Service', status: 'healthy', uptime: '99.9%' }
            ].map((service) => (
              <div key={service.service} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    service.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <div>
                    <div className="font-medium text-gray-900">{service.service}</div>
                    <div className="text-sm text-gray-500 capitalize">{service.status}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900">{service.uptime}</div>
                  <div className="text-xs text-gray-500">Uptime</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card title="Quick Actions" subtitle="Common administrative tasks">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-center transition-colors duration-200">
            <div className="text-2xl mb-2">📦</div>
            <div className="font-medium text-blue-900">Add Inventory</div>
            <div className="text-sm text-blue-600">Restock products</div>
          </button>
          
          <button className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-center transition-colors duration-200">
            <div className="text-2xl mb-2">🏷️</div>
            <div className="font-medium text-green-900">Add Product</div>
            <div className="text-sm text-green-600">New catalog item</div>
          </button>
          
          <button className="p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-center transition-colors duration-200">
            <div className="text-2xl mb-2">📊</div>
            <div className="font-medium text-yellow-900">Generate Report</div>
            <div className="text-sm text-yellow-600">Sales analytics</div>
          </button>
          
          <button className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-center transition-colors duration-200">
            <div className="text-2xl mb-2">⚙️</div>
            <div className="font-medium text-purple-900">System Settings</div>
            <div className="text-sm text-purple-600">Configuration</div>
          </button>
        </div>
      </Card>
    </div>
  );
}