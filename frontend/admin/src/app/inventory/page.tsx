'use client';

import { InventoryManagement } from '@/components/InventoryManagement';

export default function InventoryPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">在庫管理</h1>
        <p className="mt-1 text-sm text-gray-600">在庫レベル、アラート、在庫操作の管理</p>
      </div>
      
      <InventoryManagement />
    </div>
  );
}
