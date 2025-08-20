/** @type {import('next').NextConfig} */
const nextConfig = {
  // API rewrites for admin frontend
  async rewrites() {
    return [
      // Product Management
      {
        source: '/api/products',
        destination: 'http://product-service:8082/products'
      },
      {
        source: '/api/products/:path*',
        destination: 'http://product-service:8082/products/:path*'
      },
      {
        source: '/api/categories',
        destination: 'http://product-service:8082/categories'
      },
      {
        source: '/api/categories/:path*',
        destination: 'http://product-service:8082/categories/:path*'
      },

      // Inventory Management
      {
        source: '/api/admin/inventory/:path*',
        destination: 'http://inventory-service:8081/admin/inventory/:path*'
      },

      // Management & Analytics
      {
        source: '/api/admin/dashboard/:path*',
        destination: 'http://management-service:8083/dashboard/:path*'
      },
      {
        source: '/api/admin/analytics/:path*',
        destination: 'http://management-service:8083/analytics/:path*'
      },
      {
        source: '/api/admin/reports/:path*',
        destination: 'http://management-service:8083/reports/:path*'
      },
      {
        source: '/api/admin/system/:path*',
        destination: 'http://management-service:8083/system/:path*'
      },

      // Order Management (Admin view)
      {
        source: '/api/admin/orders',
        destination: 'http://status-service:8087/admin/orders'
      },
      {
        source: '/api/admin/orders/:path*',
        destination: 'http://status-service:8087/admin/orders/:path*'
      },

      // Customer Order APIs (for admin view)
      {
        source: '/api/orders',
        destination: 'http://status-service:8087/orders'
      },
      {
        source: '/api/status/:path*',
        destination: 'http://status-service:8087/status/:path*'
      }
    ];
  },

  // Enable React Strict Mode
  reactStrictMode: true,

  // Output configuration
  output: 'standalone',

  // Experimental features
  experimental: {
    // Enable app directory
    appDir: true,
  },

  // Image optimization settings
  images: {
    domains: ['localhost'],
  }
}

module.exports = nextConfig