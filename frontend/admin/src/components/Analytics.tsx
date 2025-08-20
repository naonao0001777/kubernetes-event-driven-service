'use client';

import { Card } from '@/components/common';

export function Analytics() {
  return (
    <div className="space-y-6">
      <Card title="Analytics Dashboard" subtitle="Business intelligence and performance metrics">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📈</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics & Reports</h3>
          <p className="text-gray-600 mb-4">
            Advanced analytics features will be implemented with the Management Service.
          </p>
          <p className="text-sm text-gray-500">
            Features include: Sales trends, customer insights, product performance, and automated reports.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card title="Sales Analytics">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">💰</div>
            <p className="text-sm text-gray-600">Revenue and sales trends</p>
          </div>
        </Card>
        
        <Card title="Customer Insights">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-sm text-gray-600">Customer behavior analysis</p>
          </div>
        </Card>
        
        <Card title="Product Performance">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📊</div>
            <p className="text-sm text-gray-600">Product sales metrics</p>
          </div>
        </Card>
        
        <Card title="Inventory Analytics">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📦</div>
            <p className="text-sm text-gray-600">Stock movement analysis</p>
          </div>
        </Card>
        
        <Card title="Financial Reports">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">💼</div>
            <p className="text-sm text-gray-600">Financial performance</p>
          </div>
        </Card>
        
        <Card title="Export & Scheduling">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm text-gray-600">Automated report generation</p>
          </div>
        </Card>
      </div>
    </div>
  );
}