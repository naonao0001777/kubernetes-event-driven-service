'use client';

import { useRouter, usePathname } from 'next/navigation';

interface NavigationItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  path: string;
}

interface AdminSidebarProps {
  activeItem?: string;
  onItemChange?: (itemId: string) => void;
}

export function AdminSidebar({ activeItem, onItemChange }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      name: 'ダッシュボード',
      icon: '📊',
      description: '概要と分析',
      path: '/'
    },
    {
      id: 'inventory',
      name: '在庫管理',
      icon: '📦',
      description: '在庫レベルの管理',
      path: '/inventory'
    },
    {
      id: 'products',
      name: '商品管理',
      icon: '🏷️',
      description: '商品カタログの管理',
      path: '/products'
    },
    {
      id: 'orders',
      name: '注文管理',
      icon: '📋',
      description: '注文の閲覧と管理',
      path: '/orders'
    },
    {
      id: 'analytics',
      name: '分析レポート',
      icon: '📈',
      description: '売上とパフォーマンスデータ',
      path: '/analytics'
    },
    {
      id: 'system',
      name: 'システム監視',
      icon: '🖥️',
      description: 'システムの状態とログ',
      path: '/system'
    }
  ];

  const handleItemClick = (item: NavigationItem) => {
    router.push(item.path);
    onItemChange?.(item.id);
  };

  const getCurrentActive = () => {
    if (activeItem) return activeItem;
    
    const currentItem = navigationItems.find(item => item.path === pathname);
    return currentItem?.id || 'dashboard';
  };

  const currentActive = getCurrentActive();

  return (
    <div className="admin-sidebar h-full">
      {/* Logo/Brand */}
      <div className="flex items-center justify-center h-16 px-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="text-2xl">⚙️</div>
          <div className="hidden lg:block">
            <h2 className="text-lg font-bold text-gray-900">管理ポータル</h2>
            <p className="text-xs text-gray-600">管理コンソール</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="admin-sidebar-nav px-4">
        <div className="space-y-1">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`
                admin-sidebar-item w-full text-left
                ${currentActive === item.id ? 'active bg-admin-50 text-admin-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
              `}
            >
              <div className="flex items-center">
                <span className="text-xl mr-3 flex-shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {item.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-8 px-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            クイック統計
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">本日の注文</span>
              <span className="font-semibold text-green-600">-</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">在庫不足商品</span>
              <span className="font-semibold text-yellow-600">-</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">システム状況</span>
              <span className="font-semibold text-green-600">✓</span>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="mt-8 px-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            クイックアクション
          </h3>
          <div className="space-y-2">
            <button className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">
              🔄 データ更新
            </button>
            <button className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">
              📊 レポート出力
            </button>
            <button className="w-full text-left text-sm text-gray-600 hover:text-gray-900 py-1">
              ⚙️ システム設定
            </button>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-200 mt-auto">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span>接続中</span>
        </div>
        <div className="mt-1 text-xs text-gray-400">
          v1.0.0 • リアルタイム更新
        </div>
      </div>
    </div>
  );
}