'use client';

import { AdminDashboard } from '@/components/AdminDashboard';

export default function AdminPortal() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード概要</h1>
        <p className="mt-1 text-sm text-gray-600">ECプラットフォームのリアルタイム概要</p>
      </div>
      
      <AdminDashboard />
    </div>
  );
}