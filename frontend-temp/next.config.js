/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/order',
        destination: 'http://order-service:8080/order',
      },
      {
        source: '/api/inventory',
        destination: 'http://inventory-service:8081/inventory',
      },
      {
        source: '/api/status/:path*',
        destination: 'http://status-service:8085/status/:path*',
      },
      {
        source: '/api/orders',
        destination: 'http://status-service:8085/orders',
      },
      {
        source: '/api/shipments',
        destination: 'http://shipping-service:8084/shipments',
      },
    ];
  },
};

module.exports = nextConfig;