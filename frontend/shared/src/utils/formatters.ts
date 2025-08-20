import { OrderStatus } from '../types';

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatRelativeTime(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

export function formatOrderStatus(status: OrderStatus): {
  label: string;
  color: string;
  icon: string;
} {
  const statusMap: Record<OrderStatus, { label: string; color: string; icon: string }> = {
    created: {
      label: 'Order Created',
      color: 'text-blue-600 bg-blue-50',
      icon: '📝'
    },
    inventory_confirmed: {
      label: 'Inventory Confirmed',
      color: 'text-green-600 bg-green-50',
      icon: '✅'
    },
    inventory_rejected: {
      label: 'Out of Stock',
      color: 'text-red-600 bg-red-50',
      icon: '❌'
    },
    payment_completed: {
      label: 'Payment Completed',
      color: 'text-green-600 bg-green-50',
      icon: '💳'
    },
    payment_failed: {
      label: 'Payment Failed',
      color: 'text-red-600 bg-red-50',
      icon: '❌'
    },
    notification_sent: {
      label: 'Notification Sent',
      color: 'text-blue-600 bg-blue-50',
      icon: '📧'
    },
    shipped: {
      label: 'Shipped',
      color: 'text-green-600 bg-green-50',
      icon: '🚚'
    }
  };

  return statusMap[status] || {
    label: status,
    color: 'text-gray-600 bg-gray-50',
    icon: '❓'
  };
}

export function formatProductId(productId: string): string {
  const productNames: Record<string, string> = {
    'product-1': 'Premium Widget',
    'product-2': 'Deluxe Gadget',
    'product-3': 'Elite Device'
  };

  return productNames[productId] || productId;
}

export function formatInventoryStatus(stock: number, reorderLevel?: number): {
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  color: string;
  message: string;
} {
  if (stock === 0) {
    return {
      status: 'out-of-stock',
      color: 'text-red-600',
      message: 'Out of Stock'
    };
  } else if (reorderLevel && stock <= reorderLevel) {
    return {
      status: 'low-stock',
      color: 'text-yellow-600',
      message: 'Low Stock'
    };
  } else {
    return {
      status: 'in-stock',
      color: 'text-green-600',
      message: 'In Stock'
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatPercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `ORD-${timestamp}-${randomStr}`.toUpperCase();
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function formatTrackingNumber(trackingNumber: string): string {
  if (trackingNumber.length <= 8) return trackingNumber;
  
  // Format as groups of 4 characters
  return trackingNumber.replace(/(.{4})/g, '$1 ').trim();
}