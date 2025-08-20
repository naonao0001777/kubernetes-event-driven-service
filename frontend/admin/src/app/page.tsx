'use client';

import { useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminDashboard } from '@/components/AdminDashboard';
import { InventoryManagement } from '@/components/InventoryManagement';
import { ProductManagement } from '@/components/ProductManagement';
import { OrderManagement } from '@/components/OrderManagement';
import { Analytics } from '@/components/Analytics';
import { SystemMonitoring } from '@/components/SystemMonitoring';

type ActiveSection = 'dashboard' | 'inventory' | 'products' | 'orders' | 'analytics' | 'system';

export default function AdminPortal() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'inventory':
        return <InventoryManagement />;
      case 'products':
        return <ProductManagement />;
      case 'orders':
        return <OrderManagement />;
      case 'analytics':
        return <Analytics />;
      case 'system':
        return <SystemMonitoring />;
      default:
        return <AdminDashboard />;
    }
  };

  const getSectionTitle = () => {
    const titles = {
      dashboard: 'ダッシュボード概要',
      inventory: '在庫管理', 
      products: '商品管理',
      orders: '注文管理',
      analytics: '分析レポート',
      system: 'システム監視'
    };
    return titles[activeSection];
  };

  const getSectionDescription = () => {
    const descriptions = {
      dashboard: 'ECプラットフォームのリアルタイム概要',
      inventory: '在庫レベル、アラート、在庫操作の管理',
      products: '商品カタログ、カテゴリ、価格の管理',
      orders: '顧客注文とフルフィルメントの閲覧・管理',
      analytics: '売上パフォーマンスとビジネスインテリジェンス',
      system: 'システムの状態とパフォーマンスメトリクスの監視'
    };
    return descriptions[activeSection];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex h-screen overflow-hidden">
        {/* Mobile sidebar overlay */}
        <div className={`fixed inset-0 z-40 lg:hidden ${sidebarCollapsed ? 'hidden' : 'block'}`}>
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarCollapsed(true)}></div>
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <AdminSidebar activeItem={activeSection} onItemChange={(item) => setActiveSection(item as ActiveSection)} />
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden lg:flex lg:flex-shrink-0">
          <div className="w-64 flex flex-col">
            <AdminSidebar activeItem={activeSection} onItemChange={(item) => setActiveSection(item as ActiveSection)} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top navigation */}
          <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex items-center justify-between">
              <button
                className="text-gray-600 hover:text-gray-900"
                onClick={() => setSidebarCollapsed(false)}
              >
                <span className="sr-only">Open sidebar</span>
                ☰
              </button>
              <h1 className="text-lg font-semibold text-gray-900">{getSectionTitle()}</h1>
              <div className="w-6"></div>
            </div>
          </div>

          {/* Page header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{getSectionTitle()}</h1>
                <p className="mt-1 text-sm text-gray-600">{getSectionDescription()}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button className="bg-admin-600 text-white px-4 py-2 rounded-md hover:bg-admin-700 transition-colors duration-200">
                  🔄 更新
                </button>
                <button className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors duration-200">
                  📊 エクスポート
                </button>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="px-6 py-6">
              {renderActiveSection()}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}