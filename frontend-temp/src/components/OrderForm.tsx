'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Package, Loader2 } from 'lucide-react';
import { orderAPI, inventoryAPI } from '@/lib/api';
import { CreateOrderRequest, Inventory } from '@/types';

interface OrderFormProps {
  onOrderCreated: (orderId: string) => void;
}

export default function OrderForm({ onOrderCreated }: OrderFormProps) {
  const [formData, setFormData] = useState<CreateOrderRequest>({
    product_id: '',
    quantity: 1,
  });
  const [inventory, setInventory] = useState<Inventory>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const data = await inventoryAPI.get();
      setInventory(data.inventory);
      if (Object.keys(data.inventory).length > 0) {
        setFormData(prev => ({ ...prev, product_id: Object.keys(data.inventory)[0] }));
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await orderAPI.create(formData);
      onOrderCreated(response.order_id);
      setFormData(prev => ({ ...prev, quantity: 1 }));
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (productId: string) => {
    const names: Record<string, string> = {
      'product-1': 'Premium Widget ($29.99)',
      'product-2': 'Deluxe Gadget ($49.99)',
      'product-3': 'Elite Device ($99.99)',
    };
    return names[productId] || productId;
  };

  const getProductPrice = (productId: string) => {
    const prices: Record<string, number> = {
      'product-1': 29.99,
      'product-2': 49.99,
      'product-3': 99.99,
    };
    return prices[productId] || 19.99;
  };

  const totalPrice = getProductPrice(formData.product_id) * formData.quantity;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShoppingCart className="w-5 h-5 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-800">Create New Order</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-2">
            Product
          </label>
          <select
            id="product"
            value={formData.product_id}
            onChange={(e) => setFormData(prev => ({ ...prev, product_id: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          >
            <option value="">Select a product</option>
            {Object.entries(inventory).map(([productId, stock]) => (
              <option key={productId} value={productId}>
                {getProductName(productId)} - Stock: {stock}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-2">
            Quantity
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            max={inventory[formData.product_id] || 1}
            value={formData.quantity}
            onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
          {formData.product_id && (
            <p className="text-sm text-gray-500 mt-1">
              Available stock: {inventory[formData.product_id]}
            </p>
          )}
        </div>

        {formData.product_id && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Price:</span>
              <span className="text-xl font-bold text-green-600">
                ${totalPrice.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !formData.product_id}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Order...
            </>
          ) : (
            <>
              <Package className="w-4 h-4" />
              Create Order
            </>
          )}
        </button>
      </form>
    </div>
  );
}