'use client';

import { useState } from 'react';
import { ArrowLeft, Zap, BarChart3, Package2 } from 'lucide-react';
import OrderForm from '@/components/OrderForm';
import OrderStatus from '@/components/OrderStatus';
import Dashboard from '@/components/Dashboard';

type View = 'dashboard' | 'create' | 'status';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

  const handleOrderCreated = (orderId: string) => {
    setCurrentOrderId(orderId);
    setCurrentView('status');
  };

  const handleViewOrder = (orderId: string) => {
    setCurrentOrderId(orderId);
    setCurrentView('status');
  };

  const renderNavigation = () => (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Event-Driven E-Commerce</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'dashboard'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentView === 'create'
                  ? 'bg-blue-100 text-blue-800'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Package2 className="w-4 h-4" />
              Create Order
            </button>
          </div>
        </div>
      </div>
    </nav>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'create':
        return (
          <div className="max-w-2xl mx-auto">
            <OrderForm onOrderCreated={handleOrderCreated} />
          </div>
        );
      
      case 'status':
        return (
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
            </div>
            {currentOrderId && <OrderStatus orderId={currentOrderId} />}
          </div>
        );
      
      case 'dashboard':
      default:
        return (
          <div className="max-w-7xl mx-auto">
            <Dashboard onViewOrder={handleViewOrder} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {renderNavigation()}
      
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        {currentView !== 'dashboard' && (
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 bg-white px-6 py-3 rounded-lg shadow-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">
                  Real-time WebSocket Connection Active
                </span>
              </div>
            </div>
          </div>
        )}
        
        {renderContent()}
      </main>
      
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>Event-Driven Microservices Architecture with Go + Kafka + Next.js</p>
            <p className="mt-1">Real-time order processing and tracking system</p>
          </div>
        </div>
      </footer>
    </div>
  );
}