'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Package, TrendingUp, Clock, Eye, RefreshCw } from 'lucide-react';
import { orderAPI, inventoryAPI } from '@/lib/api';
import { Order, Inventory } from '@/types';

interface DashboardProps {
  onViewOrder: (orderId: string) => void;
}

export default function Dashboard({ onViewOrder }: DashboardProps) {
  const [orders, setOrders] = useState<Record<string, Order>>({});
  const [inventory, setInventory] = useState<Inventory>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [ordersData, inventoryData] = await Promise.all([
        orderAPI.getAllOrders(),
        inventoryAPI.get(),
      ]);
      
      setOrders(ordersData.orders);
      setInventory(inventoryData.inventory);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
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

  const getProductName = (productId: string) => {
    const names: Record<string, string> = {
      'product-1': 'Premium Widget',
      'product-2': 'Deluxe Gadget',
      'product-3': 'Elite Device',
    };
    return names[productId] || productId;
  };

  const ordersList = Object.values(orders);
  const stats = {
    total: ordersList.length,
    completed: ordersList.filter(o => o.status === 'shipped').length,
    processing: ordersList.filter(o => ['created', 'inventory_confirmed', 'payment_completed', 'notification_sent'].includes(o.status)).length,
    failed: ordersList.filter(o => ['inventory_rejected', 'payment_failed'].includes(o.status)).length,
    totalRevenue: ordersList
      .filter(o => o.payment_amount)
      .reduce((sum, o) => sum + (o.payment_amount || 0), 0),
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white p-6 rounded-lg shadow-lg animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.processing}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Revenue</p>
              <p className="text-2xl font-bold text-green-600">${stats.totalRevenue.toFixed(2)}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Inventory Status */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Inventory Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(inventory).map(([productId, stock]) => (
            <div key={productId} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900">{getProductName(productId)}</h4>
              <p className="text-sm text-gray-600">Product ID: {productId}</p>
              <p className={`text-lg font-bold mt-2 ${stock > 10 ? 'text-green-600' : stock > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                {stock} units
              </p>
              {stock <= 10 && (
                <p className="text-xs text-orange-600 mt-1">
                  {stock === 0 ? 'Out of stock' : 'Low stock'}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ordersList
                .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
                .map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-900">
                        {order.order_id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {getProductName(order.product_id)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{order.quantity}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        {order.payment_amount ? `$${order.payment_amount.toFixed(2)}` : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(order.events[0]?.timestamp || order.last_updated).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => onViewOrder(order.order_id)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {ordersList.length === 0 && (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
            <p className="text-gray-500">Create your first order to see it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}