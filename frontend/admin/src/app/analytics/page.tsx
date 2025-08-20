'use client';

import { Analytics } from '@/components/Analytics';

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">分析レポート</h1>
        <p className="mt-1 text-sm text-gray-600">売上パフォーマンスとビジネスインテリジェンス</p>
      </div>
      
      <Analytics />
    </div>
  );
}
