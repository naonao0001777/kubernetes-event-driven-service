'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Input, Alert, LoadingSpinner } from '@/components/common';
import { formatCurrency } from '@/utils/formatters';

interface Product {
  id: string;
  name: string;
  stock: number;
  alert_level: number;
  category: string;
  price: number;
}

interface InventoryHistory {
  id: string;
  product_id: string;
  action: string;
  quantity: number;
  reason: string;
  timestamp: string;
}

export function InventoryManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<InventoryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form states
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [stockQuantity, setStockQuantity] = useState<string>('');
  const [stockReason, setStockReason] = useState<string>('');
  const [alertLevel, setAlertLevel] = useState<string>('');
  
  // New product form
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    id: '',
    name: '',
    category: '',
    price: '',
    stock: '',
    alert_level: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProducts(),
        loadLowStockProducts(),
        loadHistory()
      ]);
    } catch (err) {
      setError('データの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    const response = await fetch('http://localhost:8081/products');
    if (!response.ok) throw new Error('商品データの取得に失敗');
    const data = await response.json();
    setProducts(data.products || []);
  };

  const loadLowStockProducts = async () => {
    const response = await fetch('http://localhost:8081/alerts/low-stock');
    if (!response.ok) throw new Error('在庫不足データの取得に失敗');
    const data = await response.json();
    setLowStockProducts(data.low_stock_products || []);
  };

  const loadHistory = async () => {
    const response = await fetch('http://localhost:8081/history');
    if (!response.ok) throw new Error('履歴データの取得に失敗');
    const data = await response.json();
    setHistory(data.history?.slice(-20) || []); // 最新20件
  };

  const handleUpdateStock = async () => {
    if (!selectedProduct || !stockQuantity) return;
    
    try {
      const quantity = parseInt(stockQuantity);
      const response = await fetch(`http://localhost:8081/products/${selectedProduct}/stock`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, reason: stockReason })
      });
      
      if (!response.ok) throw new Error('在庫更新に失敗');
      
      setStockQuantity('');
      setStockReason('');
      setSelectedProduct('');
      await loadData();
      
    } catch (err) {
      setError('在庫更新に失敗しました');
    }
  };

  const handleSetAlertLevel = async () => {
    if (!selectedProduct || !alertLevel) return;
    
    try {
      const level = parseInt(alertLevel);
      const response = await fetch(`http://localhost:8081/products/${selectedProduct}/alert/${level}`, {
        method: 'PUT'
      });
      
      if (!response.ok) throw new Error('アラートレベル更新に失敗');
      
      setAlertLevel('');
      await loadData();
      
    } catch (err) {
      setError('アラートレベル更新に失敗しました');
    }
  };

  const handleAddProduct = async () => {
    try {
      const productData = {
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock),
        alert_level: parseInt(newProduct.alert_level)
      };
      
      const response = await fetch('http://localhost:8081/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      });
      
      if (!response.ok) throw new Error('商品追加に失敗');
      
      setNewProduct({
        id: '',
        name: '',
        category: '',
        price: '',
        stock: '',
        alert_level: ''
      });
      setShowAddProduct(false);
      await loadData();
      
    } catch (err) {
      setError('商品追加に失敗しました');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold text-blue-600">{products.length}</div>
          <div className="text-sm text-gray-600">総商品数</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-green-600">
            {products.reduce((total, p) => total + p.stock, 0)}
          </div>
          <div className="text-sm text-gray-600">総在庫数</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-600">{lowStockProducts.length}</div>
          <div className="text-sm text-gray-600">在庫不足商品</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold text-purple-600">
            ¥{products.reduce((total, p) => total + (p.price * p.stock), 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">総在庫価値</div>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <Card title="🚨 在庫不足アラート" className="border-red-200">
          <div className="space-y-2">
            {lowStockProducts.map(product => (
              <div key={product.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                <div>
                  <span className="font-medium">{product.name}</span>
                  <span className="text-sm text-gray-600 ml-2">({product.category})</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-red-600">
                    残り {product.stock} 個
                  </div>
                  <div className="text-xs text-gray-500">
                    アラート基準: {product.alert_level} 個
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stock Update */}
        <Card title="📦 在庫調整">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">商品選択</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">商品を選択してください</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (現在: {product.stock}個)
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                数量 (正数=増加、負数=減少)
              </label>
              <Input
                type="number"
                value={stockQuantity}
                onChange={setStockQuantity}
                placeholder="例: +10 または -5"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">理由</label>
              <Input
                value={stockReason}
                onChange={setStockReason}
                placeholder="在庫調整の理由を入力"
              />
            </div>
            
            <Button
              onClick={handleUpdateStock}
              disabled={!selectedProduct || !stockQuantity}
              className="w-full"
            >
              在庫更新
            </Button>
          </div>
        </Card>

        {/* Alert Level Setting */}
        <Card title="⚠️ アラートレベル設定">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">商品選択</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">商品を選択してください</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} (現在: {product.alert_level}個)
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">アラート閾値</label>
              <Input
                type="number"
                value={alertLevel}
                onChange={setAlertLevel}
                placeholder="アラート発生する在庫数"
              />
            </div>
            
            <Button
              onClick={handleSetAlertLevel}
              disabled={!selectedProduct || !alertLevel}
              className="w-full"
            >
              アラートレベル更新
            </Button>
          </div>
        </Card>
      </div>

      {/* Add Product */}
      <Card title="➕ 新規商品追加">
        <div className="space-y-4">
          <Button
            onClick={() => setShowAddProduct(!showAddProduct)}
            variant="outline"
          >
            {showAddProduct ? '閉じる' : '新規商品追加フォームを開く'}
          </Button>
          
          {showAddProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
              <Input
                placeholder="商品ID"
                value={newProduct.id}
                onChange={(value) => setNewProduct({...newProduct, id: value})}
              />
              <Input
                placeholder="商品名"
                value={newProduct.name}
                onChange={(value) => setNewProduct({...newProduct, name: value})}
              />
              <Input
                placeholder="カテゴリ"
                value={newProduct.category}
                onChange={(value) => setNewProduct({...newProduct, category: value})}
              />
              <Input
                placeholder="価格"
                type="number"
                value={newProduct.price}
                onChange={(value) => setNewProduct({...newProduct, price: value})}
              />
              <Input
                placeholder="初期在庫"
                type="number"
                value={newProduct.stock}
                onChange={(value) => setNewProduct({...newProduct, stock: value})}
              />
              <Input
                placeholder="アラート閾値"
                type="number"
                value={newProduct.alert_level}
                onChange={(value) => setNewProduct({...newProduct, alert_level: value})}
              />
              <div className="md:col-span-2">
                <Button onClick={handleAddProduct} className="w-full">
                  商品を追加
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Products Table */}
      <Card title="📋 商品一覧">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-2">商品ID</th>
                <th className="pb-2">商品名</th>
                <th className="pb-2">カテゴリ</th>
                <th className="pb-2">価格</th>
                <th className="pb-2">在庫</th>
                <th className="pb-2">アラート</th>
                <th className="pb-2">状態</th>
              </tr>
            </thead>
            <tbody>
              {products.map(product => (
                <tr key={product.id} className="border-b last:border-b-0">
                  <td className="py-2 font-mono text-xs">{product.id}</td>
                  <td className="py-2 font-medium">{product.name}</td>
                  <td className="py-2">{product.category}</td>
                  <td className="py-2">¥{product.price.toLocaleString()}</td>
                  <td className="py-2">
                    <span className={`font-medium ${
                      product.stock <= product.alert_level ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="py-2">{product.alert_level}</td>
                  <td className="py-2">
                    {product.stock <= product.alert_level ? (
                      <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                        在庫不足
                      </span>
                    ) : product.stock < product.alert_level * 2 ? (
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                        注意
                      </span>
                    ) : (
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                        正常
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* History */}
      <Card title="📜 最近の在庫変更履歴">
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-gray-500">履歴がありません</p>
          ) : (
            history.slice().reverse().map(item => (
              <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{item.product_id}</span>
                  <span className="mx-2">•</span>
                  <span className="text-sm">{item.action}</span>
                  <span className="mx-2">•</span>
                  <span className="text-sm font-medium">{item.quantity}</span>
                  {item.reason && (
                    <>
                      <span className="mx-2">•</span>
                      <span className="text-sm text-gray-600">{item.reason}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(item.timestamp).toLocaleString('ja-JP')}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}