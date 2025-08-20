#!/bin/bash

# Script to build all Docker images for the microservices

set -e

SERVICES=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")

echo "Building Docker images for all services..."

for service in "${SERVICES[@]}"; do
    echo "Building $service..."
    cd "../../services/$service"
    docker build -t "$service:latest" .
    echo "✅ Built $service:latest"
    cd - > /dev/null
done

echo ""
echo "🎉 All images built successfully!"
echo ""
echo "For kind clusters, load images with:"
for service in "${SERVICES[@]}"; do
    echo "kind load docker-image $service:latest"
done

echo ""
echo "For minikube, make sure to run:"
echo "eval \$(minikube docker-env)"
echo "Then re-run this script."