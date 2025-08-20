'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { Button, LoadingSpinner, Alert } from '@/components/common';
import { formatCurrency } from '@/utils/formatters';

interface ProductListProps {
  onProductSelect: (product: Product) => void;
}

// Mock products for now - in production these would come from the Product Service
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'product-1',
    name: 'Premium Widget',
    description: 'A high-quality widget with advanced features for professional use. Built with durable materials and backed by our lifetime warranty.',
    price: 29.99,
    category_id: 'electronics',
    images: [],
    is_active: true,
    reorder_level: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'product-2', 
    name: 'Deluxe Gadget',
    description: 'Experience the ultimate in gadget technology. This deluxe model features enhanced performance and premium materials.',
    price: 49.99,
    category_id: 'electronics',
    images: [],
    is_active: true,
    reorder_level: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'product-3',
    name: 'Elite Device',
    description: 'The pinnacle of engineering excellence. Our elite device combines cutting-edge technology with elegant design.',
    price: 99.99,
    category_id: 'electronics',
    images: [],
    is_active: true,
    reorder_level: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export function ProductList({ onProductSelect }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProducts();
    loadInventory();
  }, []);

  const loadProducts = async () => {
    try {
      // For now, use mock data
      // In production: const response = await fetch('/api/products');
      setProducts(MOCK_PRODUCTS);
    } catch (err) {
      setError('Failed to load products');
      console.error('Error loading products:', err);
    }
  };

  const loadInventory = async () => {
    try {
      const response = await fetch('/api/inventory');
      const inventoryData = await response.json();
      setInventory(inventoryData.inventory || inventoryData);
      setLoading(false);
    } catch (err) {
      setError('Failed to load inventory data');
      setLoading(false);
      console.error('Error loading inventory:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Loading products...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert 
        type="error" 
        title="Error Loading Products"
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

  const getStockInfo = (productId: string) => {
    const stock = inventory[productId] || 0;
    return {
      quantity: stock,
      inStock: stock > 0,
      lowStock: stock <= 10 && stock > 0
    };
  };

  return (
    <div className="space-y-6">
      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => {
          const stockInfo = getStockInfo(product.id);
          
          return (
            <div
              key={product.id}
              className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              {/* Product Image Placeholder */}
              <div className="h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-t-lg flex items-center justify-center">
                <div className="text-6xl opacity-50">
                  {product.id === 'product-1' && '📱'}
                  {product.id === 'product-2' && '⌚'}
                  {product.id === 'product-3' && '💻'}
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {product.name}
                  </h3>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(product.price)}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {product.description}
                </p>

                {/* Stock Status */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${
                      stockInfo.inStock 
                        ? stockInfo.lowStock 
                          ? 'bg-yellow-500' 
                          : 'bg-green-500'
                        : 'bg-red-500'
                    }`}></div>
                    <span className={`text-sm font-medium ${
                      stockInfo.inStock 
                        ? stockInfo.lowStock 
                          ? 'text-yellow-600' 
                          : 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {stockInfo.inStock 
                        ? stockInfo.lowStock
                          ? `Low Stock (${stockInfo.quantity})`
                          : `In Stock (${stockInfo.quantity})`
                        : 'Out of Stock'
                      }
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <Button
                  variant="primary"
                  onClick={() => onProductSelect(product)}
                  disabled={!stockInfo.inStock}
                  className="w-full"
                >
                  {stockInfo.inStock ? 'Select Product' : 'Out of Stock'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* No Products Message */}
      {products.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛍️</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Products Available</h3>
          <p className="text-gray-600">Check back later for new products!</p>
        </div>
      )}

      {/* Product Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Product Availability</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">
              {products.filter(p => getStockInfo(p.id).inStock).length}
            </div>
            <div className="text-sm text-gray-600">In Stock</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600">
              {products.filter(p => getStockInfo(p.id).lowStock).length}
            </div>
            <div className="text-sm text-gray-600">Low Stock</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {products.filter(p => !getStockInfo(p.id).inStock).length}
            </div>
            <div className="text-sm text-gray-600">Out of Stock</div>
          </div>
        </div>
      </div>
    </div>
  );
}