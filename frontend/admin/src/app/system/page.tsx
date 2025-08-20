'use client';

import { SystemMonitoring } from '@/components/SystemMonitoring';

export default function SystemPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">システム監視</h1>
        <p className="mt-1 text-sm text-gray-600">システムの状態とパフォーマンスメトリクスの監視</p>
      </div>
      
      <SystemMonitoring />
    </div>
  );
}
