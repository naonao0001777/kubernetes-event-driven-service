'use client';

import { Card, Button } from '@/components/common';

export function ProductManagement() {
  return (
    <div className="space-y-6">
      <Card title="Product Catalog" subtitle="Manage your product inventory and catalog">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏷️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Product Management</h3>
          <p className="text-gray-600 mb-4">
            Product management features will be implemented with the Product Service.
          </p>
          <p className="text-sm text-gray-500">
            Features include: Create products, manage categories, set pricing, upload images, and more.
          </p>
        </div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Add New Product">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">➕</div>
            <p className="text-sm text-gray-600">Create new product listings</p>
          </div>
        </Card>
        
        <Card title="Categories">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📂</div>
            <p className="text-sm text-gray-600">Manage product categories</p>
          </div>
        </Card>
        
        <Card title="Bulk Import">
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-sm text-gray-600">Import products from CSV</p>
          </div>
        </Card>
      </div>
    </div>
  );
}