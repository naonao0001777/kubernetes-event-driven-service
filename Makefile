# Makefile for Event-Driven Microservices PoC

.PHONY: help build-local run-local stop-local build-k8s deploy-k8s clean-k8s test-order

SERVICES := order-service inventory-service payment-service notification-service shipping-service status-service

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Local Development with Docker Compose
build-local: ## Build all services locally with Docker Compose
	docker-compose build

run-local: ## Run all services locally with Docker Compose
	docker-compose up -d

run-with-frontend: ## Run all services including frontend with Docker Compose
	docker-compose up -d

stop-local: ## Stop all local services
	docker-compose down

logs-local: ## Show logs from all local services
	docker-compose logs -f

# Kubernetes Development
build-k8s: ## Build Docker images for Kubernetes
	./deploy/k8s/build-images.sh

deploy-k8s: ## Deploy all services to Kubernetes
	./deploy/k8s/deploy-all.sh

clean-k8s: ## Remove all deployments from Kubernetes
	kubectl delete -f deploy/k8s/*/deployment.yaml --ignore-not-found=true
	kubectl delete -f deploy/k8s/kafka/ --ignore-not-found=true

# Testing
test-order: ## Test order creation (requires services to be running)
	@echo "Creating test order..."
	@curl -X POST http://localhost:8080/order \
		-H "Content-Type: application/json" \
		-d '{"product_id":"product-1","quantity":2}' \
		| jq .

open-frontend: ## Open frontend in browser
	@echo "Opening frontend at http://localhost:3000"
	@open http://localhost:3000 || xdg-open http://localhost:3000 || echo "Please open http://localhost:3000 in your browser"

test-inventory: ## Check inventory status
	@echo "Checking inventory..."
	@curl -s http://localhost:8081/inventory | jq .

test-status: ## Check all order statuses
	@echo "Checking all order statuses..."
	@curl -s http://localhost:8085/orders | jq .

# Individual service builds
$(SERVICES): 
	@echo "Building $@..."
	@cd services/$@ && docker build -t $@:latest .

# Development helpers
mod-tidy: ## Run go mod tidy for all services
	@for service in $(SERVICES); do \
		echo "Running go mod tidy for $$service..."; \
		cd services/$$service && go mod tidy && cd ../..; \
	done

fmt: ## Format Go code for all services
	@for service in $(SERVICES); do \
		echo "Formatting $$service..."; \
		cd services/$$service && go fmt ./... && cd ../..; \
	done

# Port forwarding for Kubernetes
port-forward: ## Set up port forwarding for all services (run in background)
	@echo "Setting up port forwarding for all services..."
	@kubectl port-forward service/order-service 8080:8080 &
	@kubectl port-forward service/inventory-service 8081:8081 &  
	@kubectl port-forward service/payment-service 8082:8082 &
	@kubectl port-forward service/notification-service 8083:8083 &
	@kubectl port-forward service/shipping-service 8084:8084 &
	@kubectl port-forward service/status-service 8085:8085 &
	@echo "All port forwards started. Use 'make kill-port-forward' to stop."

kill-port-forward: ## Kill all kubectl port-forward processes
	@pkill -f "kubectl port-forward" || true

# Clean up
clean: stop-local clean-k8s ## Clean up everything (Docker Compose and Kubernetes)
	docker-compose down --volumes --remove-orphans
	docker system prune -f

# Frontend Development
frontend-customer: ## Start customer frontend in development mode
	cd frontend/customer && npm install && npm run dev

frontend-admin: ## Start admin frontend in development mode
	cd frontend/admin && npm install && npm run dev

frontend-build: ## Build both frontend applications
	cd frontend/customer && npm install && npm run build
	cd frontend/admin && npm install && npm run build

frontend-test: ## Run tests for both frontend applications
	cd frontend/customer && npm install && npm run type-check && npm run lint
	cd frontend/admin && npm install && npm run type-check && npm run lint

# Frontend Docker
build-frontend: ## Build frontend Docker images
	docker build -t customer-frontend:latest frontend/customer/
	docker build -t admin-frontend:latest frontend/admin/

deploy-frontend-k8s: ## Deploy frontend to Kubernetes
	kubectl apply -f deploy/k8s/frontend/