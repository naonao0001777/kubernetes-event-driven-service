'use client';

import { OrderManagement } from '@/components/OrderManagement';

export default function OrdersPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">注文管理</h1>
        <p className="mt-1 text-sm text-gray-600">顧客注文とフルフィルメントの閲覧・管理</p>
      </div>
      
      <OrderManagement />
    </div>
  );
}
