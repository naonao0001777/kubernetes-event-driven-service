'use client';

import { useState } from 'react';
import { Product, CreateOrderRequest, CreateOrderResponse } from '@/types';
import { Button, Input, Alert, Card } from '@/components/common';
import { formatCurrency } from '@/utils/formatters';

interface OrderFormProps {
  selectedProduct: Product | null;
  onOrderCreated: (orderId: string) => void;
}

export function OrderForm({ selectedProduct, onOrderCreated }: OrderFormProps) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProduct) {
      setError('Please select a product first');
      return;
    }

    if (quantity < 1) {
      setError('Quantity must be at least 1');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const orderData: CreateOrderRequest = {
        product_id: selectedProduct.id,
        quantity: quantity
      };

      const response = await fetch('/api/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result: CreateOrderResponse = await response.json();
      
      setSuccess(`Order created successfully! Order ID: ${result.order_id}`);
      onOrderCreated(result.order_id);
      
      // Reset form
      setQuantity(1);
      
    } catch (err) {
      console.error('Order creation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!selectedProduct) return 0;
    return selectedProduct.price * quantity;
  };

  const getProductIcon = (productId: string) => {
    const icons: Record<string, string> = {
      'product-1': '📱',
      'product-2': '⌚',
      'product-3': '💻'
    };
    return icons[productId] || '📦';
  };

  if (!selectedProduct) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🛍️</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Product Selected</h3>
        <p className="text-gray-600">
          Please go to the Products tab and select a product to order.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Selected Product Display */}
      <Card title="Selected Product">
        <div className="flex items-start space-x-4">
          <div className="text-6xl">
            {getProductIcon(selectedProduct.id)}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {selectedProduct.name}
            </h3>
            <p className="text-gray-600 mb-3">
              {selectedProduct.description}
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(selectedProduct.price)}
              </span>
              <span className="text-sm text-gray-500">per unit</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Order Form */}
      <Card title="Order Details">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity
            </label>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                −
              </button>
              <Input
                type="number"
                value={quantity.toString()}
                onChange={(value) => setQuantity(Math.max(1, parseInt(value) || 1))}
                className="w-20 text-center"
              />
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Product:</span>
                <span>{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Unit Price:</span>
                <span>{formatCurrency(selectedProduct.price)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Quantity:</span>
                <span>{quantity}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span className="text-lg text-blue-600">
                    {formatCurrency(calculateTotal())}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError(null)}
            />
          )}

          {success && (
            <Alert
              type="success"
              title="Order Created!"
              message={success}
              onClose={() => setSuccess(null)}
            />
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
            className="w-full text-lg py-3"
          >
            {loading ? 'Creating Order...' : `Place Order - ${formatCurrency(calculateTotal())}`}
          </Button>
        </form>
      </Card>

      {/* Order Information */}
      <Card title="Order Information" className="bg-blue-50 border-blue-200">
        <div className="text-sm text-blue-800">
          <p className="mb-2">
            <strong>⚡ Real-time Processing:</strong> Your order will be processed immediately through our event-driven system.
          </p>
          <p className="mb-2">
            <strong>📧 Notifications:</strong> You'll receive email notifications at each stage of processing.
          </p>
          <p>
            <strong>🔍 Tracking:</strong> Use the Order Tracking tab to watch your order progress in real-time.
          </p>
        </div>
      </Card>
    </div>
  );
}