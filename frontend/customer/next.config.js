/** @type {import('next').NextConfig} */
const nextConfig = {
  // API rewrites for customer frontend
  async rewrites() {
    return [
      {
        source: '/api/order',
        destination: 'http://order-service:8080/order'
      },
      {
        source: '/api/products',
        destination: 'http://product-service:8082/products'  
      },
      {
        source: '/api/products/:path*',
        destination: 'http://product-service:8082/products/:path*'
      },
      {
        source: '/api/inventory',
        destination: 'http://inventory-service:8081/inventory'
      },
      {
        source: '/api/status/:path*',
        destination: 'http://status-service:8087/status/:path*'
      },
      {
        source: '/api/orders',
        destination: 'http://status-service:8087/orders'
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