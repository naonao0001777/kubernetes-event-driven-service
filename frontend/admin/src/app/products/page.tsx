'use client';

import { ProductManagement } from '@/components/ProductManagement';

export default function ProductsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">商品管理</h1>
        <p className="mt-1 text-sm text-gray-600">商品カタログ、カテゴリ、価格の管理</p>
      </div>
      
      <ProductManagement />
    </div>
  );
}
