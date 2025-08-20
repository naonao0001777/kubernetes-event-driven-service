#!/bin/bash

# Script to deploy all services to Kubernetes

set -e

echo "🚀 Deploying Event-Driven Microservices to Kubernetes"

# Install Strimzi operator
echo "📦 Installing Strimzi Kafka operator..."
kubectl apply -f kafka/strimzi-operator.yaml

# Wait for operator to be ready
echo "⏳ Waiting for Strimzi operator to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/strimzi-cluster-operator -n kafka

# Deploy Kafka cluster
echo "🐘 Deploying Kafka cluster..."
kubectl apply -f kafka/kafka-cluster.yaml

# Wait for Kafka to be ready
echo "⏳ Waiting for Kafka cluster to be ready..."
kubectl wait --for=condition=ready --timeout=600s kafka/my-cluster -n kafka

# Deploy all microservices
SERVICES=("order-service" "inventory-service" "payment-service" "notification-service" "shipping-service" "status-service")

for service in "${SERVICES[@]}"; do
    echo "🚀 Deploying $service..."
    kubectl apply -f "$service/deployment.yaml"
done

# Wait for all deployments to be ready
for service in "${SERVICES[@]}"; do
    echo "⏳ Waiting for $service to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/$service
done

echo ""
echo "🎉 All services deployed successfully!"
echo ""
echo "📋 Service endpoints:"
echo "- Order Service: kubectl port-forward service/order-service 8080:8080"
echo "- Inventory Service: kubectl port-forward service/inventory-service 8081:8081"  
echo "- Payment Service: kubectl port-forward service/payment-service 8082:8082"
echo "- Notification Service: kubectl port-forward service/notification-service 8083:8083"
echo "- Shipping Service: kubectl port-forward service/shipping-service 8084:8084"
echo "- Status Service: kubectl port-forward service/status-service 8085:8085"
echo ""
echo "🔍 To test the system:"
echo "curl -X POST http://localhost:8080/order -H 'Content-Type: application/json' -d '{\"product_id\":\"product-1\",\"quantity\":2}'"