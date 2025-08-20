'use client';

import { useState, useEffect } from 'react';
import { ProductList } from '@/components/ProductList';
import { OrderForm } from '@/components/OrderForm';
import { OrderHistory } from '@/components/OrderHistory';
import { OrderTracking } from '@/components/OrderTracking';
import { Card } from '@/components/common';
import { Product, Order } from '@/types';

type ActiveTab = 'products' | 'order' | 'history' | 'tracking';

export default function CustomerHome() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string>('');

  const tabs = [
    { id: 'products' as ActiveTab, label: '🛍️ 商品一覧', description: '商品カタログを閲覧' },
    { id: 'order' as ActiveTab, label: '📦 注文する', description: '新しい注文を作成' },
    { id: 'history' as ActiveTab, label: '📋 注文履歴', description: '過去の注文を確認' },
    { id: 'tracking' as ActiveTab, label: '🔍 注文追跡', description: 'リアルタイム注文状況' }
  ];

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setActiveTab('order');
  };

  const handleOrderCreated = (orderId: string) => {
    setTrackingOrderId(orderId);
    setActiveTab('tracking');
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          お客様のオンラインショッピングへようこそ！
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          素晴らしい商品を発見し、注文し、リアルタイムで配送状況を追跡してください。
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {activeTab === 'products' && (
          <Card title="商品カタログ" subtitle="注文する商品を選択してください">
            <ProductList onProductSelect={handleProductSelect} />
          </Card>
        )}

        {activeTab === 'order' && (
          <Card title="新しいご注文" subtitle="以下の詳細を入力してご注文ください">
            <OrderForm 
              selectedProduct={selectedProduct}
              onOrderCreated={handleOrderCreated}
            />
          </Card>
        )}

        {activeTab === 'history' && (
          <Card title="ご注文履歴" subtitle="過去のご注文を確認・管理">
            <OrderHistory onTrackOrder={(orderId) => {
              setTrackingOrderId(orderId);
              setActiveTab('tracking');
            }} />
          </Card>
        )}

        {activeTab === 'tracking' && (
          <Card title="リアルタイム注文追跡" subtitle="ご注文の進行状況をリアルタイムで確認">
            <OrderTracking 
              orderId={trackingOrderId}
              onOrderIdChange={setTrackingOrderId}
            />
          </Card>
        )}
      </div>

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
        <Card className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">リアルタイム更新</h3>
          <p className="text-gray-600">
            注文がシステム内で進行する際に、即座に通知を受け取れます
          </p>
        </Card>

        <Card className="text-center">
          <div className="text-4xl mb-4">🔄</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">イベント駆動</h3>
          <p className="text-gray-600">
            Apache Kafkaを使用した信頼性の高いスケーラブルな注文処理
          </p>
        </Card>

        <Card className="text-center">
          <div className="text-4xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">モバイル対応</h3>
          <p className="text-gray-600">
            レスポンシブデザインであらゆるデバイスに最適化
          </p>
        </Card>
      </div>
    </div>
  );
}