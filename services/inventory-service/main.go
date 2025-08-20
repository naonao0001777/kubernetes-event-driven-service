package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/segmentio/kafka-go"
)

type OrderCreatedEvent struct {
	OrderID   string `json:"order_id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	EventType string `json:"event_type"`
}

type InventoryEvent struct {
	OrderID   string `json:"order_id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	EventType string `json:"event_type"`
	Reason    string `json:"reason,omitempty"`
}

type Product struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Stock       int    `json:"stock"`
	AlertLevel  int    `json:"alert_level"`
	Category    string `json:"category"`
	Price       float64 `json:"price"`
}

type InventoryHistory struct {
	ID        string `json:"id"`
	ProductID string `json:"product_id"`
	Action    string `json:"action"`
	Quantity  int    `json:"quantity"`
	Reason    string `json:"reason"`
	Timestamp string `json:"timestamp"`
}

type Inventory struct {
	mu       sync.RWMutex
	products map[string]*Product
	history  []InventoryHistory
}

func NewInventory() *Inventory {
	return &Inventory{
		products: map[string]*Product{
			"product-1": {
				ID:         "product-1",
				Name:       "iPhone 15 Pro",
				Stock:      100,
				AlertLevel: 20,
				Category:   "Electronics",
				Price:      149800.0,
			},
			"product-2": {
				ID:         "product-2",
				Name:       "MacBook Air M3",
				Stock:      50,
				AlertLevel: 10,
				Category:   "Electronics",
				Price:      164800.0,
			},
			"product-3": {
				ID:         "product-3",
				Name:       "AirPods Pro",
				Stock:      25,
				AlertLevel: 15,
				Category:   "Electronics",
				Price:      39800.0,
			},
		},
		history: make([]InventoryHistory, 0),
	}
}

func (inv *Inventory) CheckStock(productID string, quantity int) bool {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	product, exists := inv.products[productID]
	return exists && product.Stock >= quantity
}

func (inv *Inventory) ReserveStock(productID string, quantity int) bool {
	inv.mu.Lock()
	defer inv.mu.Unlock()
	
	if product, exists := inv.products[productID]; exists && product.Stock >= quantity {
		product.Stock -= quantity
		inv.addHistory(productID, "reserved", quantity, "Order reservation")
		return true
	}
	return false
}

func (inv *Inventory) GetStock() map[string]int {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	result := make(map[string]int)
	for k, v := range inv.products {
		result[k] = v.Stock
	}
	return result
}

func (inv *Inventory) GetProducts() []*Product {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	result := make([]*Product, 0, len(inv.products))
	for _, product := range inv.products {
		result = append(result, product)
	}
	return result
}

func (inv *Inventory) GetProduct(productID string) (*Product, bool) {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	product, exists := inv.products[productID]
	return product, exists
}

func (inv *Inventory) AddProduct(product *Product) error {
	inv.mu.Lock()
	defer inv.mu.Unlock()
	
	if _, exists := inv.products[product.ID]; exists {
		return fmt.Errorf("product %s already exists", product.ID)
	}
	
	inv.products[product.ID] = product
	inv.addHistory(product.ID, "added", product.Stock, "Product added")
	return nil
}

func (inv *Inventory) UpdateStock(productID string, quantity int, reason string) error {
	inv.mu.Lock()
	defer inv.mu.Unlock()
	
	product, exists := inv.products[productID]
	if !exists {
		return fmt.Errorf("product %s not found", productID)
	}
	
	oldStock := product.Stock
	product.Stock += quantity
	
	if product.Stock < 0 {
		product.Stock = oldStock
		return fmt.Errorf("insufficient stock")
	}
	
	action := "increased"
	if quantity < 0 {
		action = "decreased"
		quantity = -quantity
	}
	
	inv.addHistory(productID, action, quantity, reason)
	return nil
}

func (inv *Inventory) SetAlertLevel(productID string, level int) error {
	inv.mu.Lock()
	defer inv.mu.Unlock()
	
	product, exists := inv.products[productID]
	if !exists {
		return fmt.Errorf("product %s not found", productID)
	}
	
	product.AlertLevel = level
	inv.addHistory(productID, "alert_updated", level, "Alert level updated")
	return nil
}

func (inv *Inventory) GetLowStockProducts() []*Product {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	result := make([]*Product, 0)
	for _, product := range inv.products {
		if product.Stock <= product.AlertLevel {
			result = append(result, product)
		}
	}
	return result
}

func (inv *Inventory) GetHistory() []InventoryHistory {
	inv.mu.RLock()
	defer inv.mu.RUnlock()
	
	return append([]InventoryHistory(nil), inv.history...)
}

func (inv *Inventory) addHistory(productID, action string, quantity int, reason string) {
	history := InventoryHistory{
		ID:        fmt.Sprintf("%d", time.Now().UnixNano()),
		ProductID: productID,
		Action:    action,
		Quantity:  quantity,
		Reason:    reason,
		Timestamp: time.Now().Format(time.RFC3339),
	}
	
	inv.history = append(inv.history, history)
	
	// Keep only last 1000 history records
	if len(inv.history) > 1000 {
		inv.history = inv.history[len(inv.history)-1000:]
	}
}

var inventory = NewInventory()

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func publishInventoryEvent(event InventoryEvent) error {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(getKafkaBroker()),
		Topic:    "inventory",
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	return writer.WriteMessages(context.Background(),
		kafka.Message{
			Key:   []byte(event.OrderID),
			Value: eventBytes,
		},
	)
}

func processOrderEvent(event OrderCreatedEvent) {
	log.Printf("Processing order: %s for product: %s, quantity: %d", 
		event.OrderID, event.ProductID, event.Quantity)

	var inventoryEvent InventoryEvent
	inventoryEvent.OrderID = event.OrderID
	inventoryEvent.ProductID = event.ProductID
	inventoryEvent.Quantity = event.Quantity

	if inventory.ReserveStock(event.ProductID, event.Quantity) {
		inventoryEvent.EventType = "InventoryConfirmed"
		log.Printf("Inventory confirmed for order: %s", event.OrderID)
	} else {
		inventoryEvent.EventType = "InventoryRejected"
		inventoryEvent.Reason = "Insufficient stock"
		log.Printf("Inventory rejected for order: %s - insufficient stock", event.OrderID)
	}

	if err := publishInventoryEvent(inventoryEvent); err != nil {
		log.Printf("Failed to publish inventory event: %v", err)
	}
}

func consumeOrders() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{getKafkaBroker()},
		Topic:   "orders",
		GroupID: "inventory-service",
	})
	defer reader.Close()

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message: %v", err)
			continue
		}

		var event OrderCreatedEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		processOrderEvent(event)
	}
}

func getInventory(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"inventory": inventory.GetStock(),
	})
}

func getProducts(c *gin.Context) {
	products := inventory.GetProducts()
	c.JSON(http.StatusOK, gin.H{
		"products": products,
	})
}

func getProduct(c *gin.Context) {
	productID := c.Param("id")
	product, exists := inventory.GetProduct(productID)
	
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"product": product,
	})
}

func addProduct(c *gin.Context) {
	var product Product
	if err := c.ShouldBindJSON(&product); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := inventory.AddProduct(&product); err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusCreated, gin.H{
		"message": "Product added successfully",
		"product": product,
	})
}

func updateStock(c *gin.Context) {
	productID := c.Param("id")
	
	var req struct {
		Quantity int    `json:"quantity" binding:"required"`
		Reason   string `json:"reason"`
	}
	
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	if err := inventory.UpdateStock(productID, req.Quantity, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Stock updated successfully",
	})
}

func setAlertLevel(c *gin.Context) {
	productID := c.Param("id")
	levelStr := c.Param("level")
	
	level, err := strconv.Atoi(levelStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid alert level"})
		return
	}
	
	if err := inventory.SetAlertLevel(productID, level); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Alert level updated successfully",
	})
}

func getLowStockProducts(c *gin.Context) {
	products := inventory.GetLowStockProducts()
	c.JSON(http.StatusOK, gin.H{
		"low_stock_products": products,
		"count": len(products),
	})
}

func getInventoryHistory(c *gin.Context) {
	history := inventory.GetHistory()
	c.JSON(http.StatusOK, gin.H{
		"history": history,
		"count": len(history),
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "inventory-service"})
}

func main() {
	go consumeOrders()

	r := gin.Default()
	
	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		
		c.Next()
	})
	
	// Existing endpoints
	r.GET("/inventory", getInventory)
	r.GET("/health", healthCheck)
	
	// New management endpoints
	r.GET("/products", getProducts)
	r.GET("/products/:id", getProduct)
	r.POST("/products", addProduct)
	r.PUT("/products/:id/stock", updateStock)
	r.PUT("/products/:id/alert/:level", setAlertLevel)
	r.GET("/alerts/low-stock", getLowStockProducts)
	r.GET("/history", getInventoryHistory)

	log.Println("Inventory Service starting on :8081")
	log.Println("Management API endpoints:")
	log.Println("  GET    /products          - Get all products")
	log.Println("  GET    /products/:id      - Get product by ID")
	log.Println("  POST   /products          - Add new product")
	log.Println("  PUT    /products/:id/stock - Update stock")
	log.Println("  PUT    /products/:id/alert/:level - Set alert level")
	log.Println("  GET    /alerts/low-stock  - Get low stock products")
	log.Println("  GET    /history           - Get inventory history")
	
	r.Run(":8081")
}