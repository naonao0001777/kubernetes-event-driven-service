'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Input, Alert, LoadingSpinner } from '@/components/common';

interface OrderStatus {
  order_id: string;
  product_id: string;
  quantity: number;
  status: string;
  events: EventRecord[];
  last_updated: string;
  tracking_number?: string;
  payment_amount?: number;
}

interface EventRecord {
  event_type: string;
  data: string;
  timestamp: string;
}

interface OrderStatistics {
  total_orders: number;
  orders_by_status: Record<string, number>;
  orders_by_product: Record<string, number>;
  recent_orders: OrderStatus[];
  total_revenue: number;
  average_order_value: number;
  completion_rate: number;
  processing_time: Record<string, string>;
}

export function SystemMonitoring() {
  const [statistics, setStatistics] = useState<OrderStatistics | null>(null);
  const [orders, setOrders] = useState<OrderStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Active tab
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'statistics' | 'search'>('overview');

  const services = [
    { name: 'Order Service', port: 8080, status: 'healthy', uptime: '99.9%', cpu: '15%', memory: '128MB' },
    { name: 'Inventory Service', port: 8081, status: 'healthy', uptime: '99.8%', cpu: '12%', memory: '96MB' },
    { name: 'Product Service', port: 8082, status: 'healthy', uptime: '100%', cpu: '8%', memory: '64MB' },
    { name: 'Management Service', port: 8083, status: 'healthy', uptime: '100%', cpu: '6%', memory: '48MB' },
    { name: 'Payment Service', port: 8084, status: 'healthy', uptime: '99.7%', cpu: '8%', memory: '84MB' },
    { name: 'Notification Service', port: 8085, status: 'healthy', uptime: '99.9%', cpu: '5%', memory: '72MB' },
    { name: 'Shipping Service', port: 8086, status: 'healthy', uptime: '99.6%', cpu: '7%', memory: '88MB' },
    { name: 'Status Service', port: 8087, status: 'healthy', uptime: '100%', cpu: '20%', memory: '156MB' }
  ];

  useEffect(() => {
    if (activeTab === 'statistics' || activeTab === 'overview') {
      loadStatistics();
    }
    if (activeTab === 'orders' || activeTab === 'overview') {
      loadOrders();
    }
  }, [activeTab]);

  const loadStatistics = async () => {
    try {
      const response = await fetch('http://localhost:8087/statistics');
      if (!response.ok) throw new Error('統計情報の取得に失敗');
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      setError('統計情報の読み込みに失敗しました');
    }
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:8087/orders/filtered?';
      const params = new URLSearchParams();
      
      if (statusFilter) params.append('status', statusFilter);
      if (productFilter) params.append('product_id', productFilter);
      params.append('limit', '50');
      
      const response = await fetch(url + params.toString());
      if (!response.ok) throw new Error('注文データの取得に失敗');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError('注文データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8087/orders/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('検索に失敗');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      setError('検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`注文 ${orderId} を削除しますか？`)) return;
    
    try {
      const response = await fetch(`http://localhost:8087/orders/${orderId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('削除に失敗');
      
      // Reload orders
      await loadOrders();
      if (statistics) await loadStatistics();
    } catch (err) {
      setError('注文の削除に失敗しました');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50';
      case 'warning': return 'text-yellow-600 bg-yellow-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-blue-100 text-blue-800';
      case 'inventory_confirmed': return 'bg-green-100 text-green-800';
      case 'payment_completed': return 'bg-purple-100 text-purple-800';
      case 'shipped': return 'bg-indigo-100 text-indigo-800';
      case 'inventory_rejected': 
      case 'payment_failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrderStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'created': '作成済み',
      'inventory_confirmed': '在庫確認済み',
      'inventory_rejected': '在庫不足',
      'payment_completed': '支払い完了',
      'payment_failed': '支払い失敗',
      'notification_sent': '通知送信済み',
      'shipped': '発送済み'
    };
    return statusMap[status] || status;
  };

  if (loading && activeTab === 'overview') return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: '🖥️ システム概要' },
            { id: 'orders', label: '📋 注文管理' },
            { id: 'statistics', label: '📊 統計情報' },
            { id: 'search', label: '🔍 検索' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* System Health */}
          <Card title="システム状態概要" subtitle="全マイクロサービスとインフラの監視">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {services.filter(s => s.status === 'healthy').length}
                </div>
                <div className="text-sm text-gray-600">正常稼働中</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-600 mb-1">
                  {services.filter(s => s.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">待機中</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">99.8%</div>
                <div className="text-sm text-gray-600">平均稼働率</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">12%</div>
                <div className="text-sm text-gray-600">平均CPU使用率</div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-left">
                    <th className="pb-2">サービス名</th>
                    <th className="pb-2">ポート</th>
                    <th className="pb-2">状態</th>
                    <th className="pb-2">稼働率</th>
                    <th className="pb-2">CPU</th>
                    <th className="pb-2">メモリ</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((service, index) => (
                    <tr key={index} className="border-b last:border-b-0">
                      <td className="py-2 font-medium">{service.name}</td>
                      <td className="py-2 font-mono text-xs">{service.port}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(service.status)}`}>
                          {service.status === 'healthy' ? '正常' : service.status}
                        </span>
                      </td>
                      <td className="py-2">{service.uptime}</td>
                      <td className="py-2">{service.cpu}</td>
                      <td className="py-2">{service.memory}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Order Statistics Summary */}
          {statistics && (
            <Card title="注文統計サマリー">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{statistics.total_orders}</div>
                  <div className="text-sm text-gray-600">総注文数</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    ¥{statistics.total_revenue.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">総売上</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    ¥{Math.round(statistics.average_order_value).toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">平均注文額</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {statistics.completion_rate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">完了率</div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Filters */}
          <Card title="注文フィルター">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">状態フィルター</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">全ての状態</option>
                  <option value="created">作成済み</option>
                  <option value="inventory_confirmed">在庫確認済み</option>
                  <option value="payment_completed">支払い完了</option>
                  <option value="shipped">発送済み</option>
                  <option value="inventory_rejected">在庫不足</option>
                  <option value="payment_failed">支払い失敗</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">商品フィルター</label>
                <Input
                  placeholder="商品IDで絞り込み"
                  value={productFilter}
                  onChange={setProductFilter}
                />
              </div>
              
              <div className="flex items-end">
                <Button onClick={loadOrders} className="w-full">
                  フィルター適用
                </Button>
              </div>
            </div>
          </Card>

          {/* Orders List */}
          <Card title="注文一覧">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left">
                      <th className="pb-2">注文ID</th>
                      <th className="pb-2">商品ID</th>
                      <th className="pb-2">数量</th>
                      <th className="pb-2">状態</th>
                      <th className="pb-2">金額</th>
                      <th className="pb-2">最終更新</th>
                      <th className="pb-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.order_id} className="border-b last:border-b-0">
                        <td className="py-2 font-mono text-xs">{order.order_id}</td>
                        <td className="py-2">{order.product_id}</td>
                        <td className="py-2">{order.quantity}</td>
                        <td className="py-2">
                          <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(order.status)}`}>
                            {getOrderStatusText(order.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          {order.payment_amount ? `¥${order.payment_amount.toLocaleString()}` : '-'}
                        </td>
                        <td className="py-2 text-xs">
                          {new Date(order.last_updated).toLocaleString('ja-JP')}
                        </td>
                        <td className="py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteOrder(order.order_id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            削除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {orders.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    注文データがありません
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Statistics Tab */}
      {activeTab === 'statistics' && statistics && (
        <div className="space-y-6">
          <Card title="詳細統計情報">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Status Distribution */}
              <div>
                <h4 className="font-medium mb-3">状態別注文数</h4>
                <div className="space-y-2">
                  {Object.entries(statistics.orders_by_status).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm">{getOrderStatusText(status)}</span>
                      <span className="font-medium">{count}件</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Distribution */}
              <div>
                <h4 className="font-medium mb-3">商品別注文数</h4>
                <div className="space-y-2">
                  {Object.entries(statistics.orders_by_product).map(([productId, count]) => (
                    <div key={productId} className="flex justify-between items-center">
                      <span className="text-sm">{productId}</span>
                      <span className="font-medium">{count}件</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Processing Times */}
              <div>
                <h4 className="font-medium mb-3">平均処理時間</h4>
                <div className="space-y-2">
                  {Object.entries(statistics.processing_time).map(([stage, time]) => (
                    <div key={stage} className="flex justify-between items-center">
                      <span className="text-sm">{stage}</span>
                      <span className="font-medium">{time}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Orders */}
              <div>
                <h4 className="font-medium mb-3">最近の注文</h4>
                <div className="space-y-2">
                  {statistics.recent_orders.slice(0, 5).map((order) => (
                    <div key={order.order_id} className="flex justify-between items-center text-sm">
                      <span className="font-mono text-xs">{order.order_id}</span>
                      <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(order.status)}`}>
                        {getOrderStatusText(order.status)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div className="space-y-6">
          <Card title="注文検索">
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="注文ID、商品ID、状態、追跡番号で検索"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  className="flex-1"
                />
                <Button onClick={handleSearch}>検索</Button>
              </div>

              {loading ? (
                <LoadingSpinner />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr className="text-left">
                        <th className="pb-2">注文ID</th>
                        <th className="pb-2">商品ID</th>
                        <th className="pb-2">状態</th>
                        <th className="pb-2">追跡番号</th>
                        <th className="pb-2">最終更新</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.order_id} className="border-b last:border-b-0">
                          <td className="py-2 font-mono text-xs">{order.order_id}</td>
                          <td className="py-2">{order.product_id}</td>
                          <td className="py-2">
                            <span className={`px-2 py-1 rounded text-xs ${getOrderStatusColor(order.status)}`}>
                              {getOrderStatusText(order.status)}
                            </span>
                          </td>
                          <td className="py-2 font-mono text-xs">
                            {order.tracking_number || '-'}
                          </td>
                          <td className="py-2 text-xs">
                            {new Date(order.last_updated).toLocaleString('ja-JP')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {orders.length === 0 && searchQuery && (
                    <div className="text-center py-4 text-gray-500">
                      検索結果が見つかりませんでした
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}