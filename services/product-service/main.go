package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

// Product represents a product in the catalog
type Product struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Price       float64   `json:"price"`
	CategoryID  string    `json:"category_id"`
	Images      []string  `json:"images"`
	IsActive    bool      `json:"is_active"`
	ReorderLevel int      `json:"reorder_level"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Category represents a product category
type Category struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ParentID    *string   `json:"parent_id,omitempty"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProductCreatedEvent represents a product creation event
type ProductCreatedEvent struct {
	ProductID   string    `json:"product_id"`
	Name        string    `json:"name"`
	Price       float64   `json:"price"`
	CategoryID  string    `json:"category_id"`
	EventType   string    `json:"event_type"`
	Timestamp   time.Time `json:"timestamp"`
}

// ProductUpdatedEvent represents a product update event
type ProductUpdatedEvent struct {
	ProductID   string    `json:"product_id"`
	Name        string    `json:"name"`
	Price       float64   `json:"price"`
	CategoryID  string    `json:"category_id"`
	EventType   string    `json:"event_type"`
	Timestamp   time.Time `json:"timestamp"`
}

// In-memory storage
var (
	products   = make(map[string]Product)
	categories = make(map[string]Category)
	mutex      = sync.RWMutex{}
)

// Kafka configuration
const kafkaBroker = "kafka:9092"

// Kafka writer
var kafkaWriter *kafka.Writer

func init() {
	// Initialize Kafka writer
	kafkaWriter = &kafka.Writer{
		Addr:                   kafka.TCP(kafkaBroker),
		Topic:                  "products",
		Balancer:               &kafka.LeastBytes{},
		AllowAutoTopicCreation: true,
	}

	// Initialize default products
	initializeDefaultData()
	
	log.Println("Product Service initialized with default data")
}

func initializeDefaultData() {
	mutex.Lock()
	defer mutex.Unlock()

	// Initialize default categories
	electronicsCategory := Category{
		ID:          "electronics",
		Name:        "Electronics",
		Description: "Electronic devices and gadgets",
		IsActive:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	categories["electronics"] = electronicsCategory

	// Initialize default products
	defaultProducts := []Product{
		{
			ID:           "product-1",
			Name:         "Premium Widget",
			Description:  "A high-quality widget with advanced features for professional use. Built with durable materials and backed by our lifetime warranty.",
			Price:        29.99,
			CategoryID:   "electronics",
			Images:       []string{},
			IsActive:     true,
			ReorderLevel: 10,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
		{
			ID:           "product-2",
			Name:         "Deluxe Gadget",
			Description:  "Experience the ultimate in gadget technology. This deluxe model features enhanced performance and premium materials.",
			Price:        49.99,
			CategoryID:   "electronics",
			Images:       []string{},
			IsActive:     true,
			ReorderLevel: 5,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
		{
			ID:           "product-3",
			Name:         "Elite Device",
			Description:  "The pinnacle of engineering excellence. Our elite device combines cutting-edge technology with elegant design.",
			Price:        99.99,
			CategoryID:   "electronics",
			Images:       []string{},
			IsActive:     true,
			ReorderLevel: 3,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		},
	}

	for _, product := range defaultProducts {
		products[product.ID] = product
	}
}

func publishProductEvent(event interface{}) error {
	eventBytes, err := json.Marshal(event)
	if err != nil {
		return err
	}

	message := kafka.Message{
		Key:   []byte("product-event"),
		Value: eventBytes,
		Time:  time.Now(),
	}

	return kafkaWriter.WriteMessages(context.Background(), message)
}

// Product endpoints
func getProducts(c *gin.Context) {
	mutex.RLock()
	defer mutex.RUnlock()

	// Convert map to slice
	productList := make([]Product, 0, len(products))
	for _, product := range products {
		if product.IsActive {
			productList = append(productList, product)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"products": productList,
		"total":    len(productList),
	})
}

func getProduct(c *gin.Context) {
	productID := c.Param("id")
	
	mutex.RLock()
	defer mutex.RUnlock()

	product, exists := products[productID]
	if !exists || !product.IsActive {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

func createProduct(c *gin.Context) {
	var newProduct Product
	if err := c.ShouldBindJSON(&newProduct); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate ID and timestamps
	newProduct.ID = uuid.New().String()
	newProduct.CreatedAt = time.Now()
	newProduct.UpdatedAt = time.Now()
	newProduct.IsActive = true

	mutex.Lock()
	products[newProduct.ID] = newProduct
	mutex.Unlock()

	// Publish event
	event := ProductCreatedEvent{
		ProductID:  newProduct.ID,
		Name:       newProduct.Name,
		Price:      newProduct.Price,
		CategoryID: newProduct.CategoryID,
		EventType:  "ProductCreated",
		Timestamp:  time.Now(),
	}

	if err := publishProductEvent(event); err != nil {
		log.Printf("Failed to publish product created event: %v", err)
	}

	log.Printf("Product created: %s", newProduct.ID)
	c.JSON(http.StatusCreated, newProduct)
}

func updateProduct(c *gin.Context) {
	productID := c.Param("id")

	mutex.Lock()
	defer mutex.Unlock()

	existingProduct, exists := products[productID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	var updateData Product
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Update product fields
	existingProduct.Name = updateData.Name
	existingProduct.Description = updateData.Description
	existingProduct.Price = updateData.Price
	existingProduct.CategoryID = updateData.CategoryID
	existingProduct.IsActive = updateData.IsActive
	existingProduct.ReorderLevel = updateData.ReorderLevel
	existingProduct.UpdatedAt = time.Now()

	products[productID] = existingProduct

	// Publish event
	event := ProductUpdatedEvent{
		ProductID:  existingProduct.ID,
		Name:       existingProduct.Name,
		Price:      existingProduct.Price,
		CategoryID: existingProduct.CategoryID,
		EventType:  "ProductUpdated",
		Timestamp:  time.Now(),
	}

	if err := publishProductEvent(event); err != nil {
		log.Printf("Failed to publish product updated event: %v", err)
	}

	log.Printf("Product updated: %s", productID)
	c.JSON(http.StatusOK, existingProduct)
}

func deleteProduct(c *gin.Context) {
	productID := c.Param("id")

	mutex.Lock()
	defer mutex.Unlock()

	product, exists := products[productID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Product not found"})
		return
	}

	// Soft delete by setting IsActive to false
	product.IsActive = false
	product.UpdatedAt = time.Now()
	products[productID] = product

	log.Printf("Product deactivated: %s", productID)
	c.JSON(http.StatusOK, gin.H{"message": "Product deactivated successfully"})
}

// Category endpoints
func getCategories(c *gin.Context) {
	mutex.RLock()
	defer mutex.RUnlock()

	// Convert map to slice
	categoryList := make([]Category, 0, len(categories))
	for _, category := range categories {
		if category.IsActive {
			categoryList = append(categoryList, category)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"categories": categoryList,
		"total":      len(categoryList),
	})
}

func createCategory(c *gin.Context) {
	var newCategory Category
	if err := c.ShouldBindJSON(&newCategory); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate ID and timestamps
	newCategory.ID = uuid.New().String()
	newCategory.CreatedAt = time.Now()
	newCategory.UpdatedAt = time.Now()
	newCategory.IsActive = true

	mutex.Lock()
	categories[newCategory.ID] = newCategory
	mutex.Unlock()

	log.Printf("Category created: %s", newCategory.ID)
	c.JSON(http.StatusCreated, newCategory)
}

// Search products
func searchProducts(c *gin.Context) {
	query := c.Query("q")
	category := c.Query("category")

	mutex.RLock()
	defer mutex.RUnlock()

	var results []Product
	for _, product := range products {
		if !product.IsActive {
			continue
		}

		// Simple text search in name and description
		if query != "" {
			queryLower := strings.ToLower(query)
			nameLower := strings.ToLower(product.Name)
			descLower := strings.ToLower(product.Description)
			
			if !strings.Contains(nameLower, queryLower) && !strings.Contains(descLower, queryLower) {
				continue
			}
		}

		// Category filter
		if category != "" && product.CategoryID != category {
			continue
		}

		results = append(results, product)
	}

	c.JSON(http.StatusOK, gin.H{
		"products": results,
		"total":    len(results),
		"query":    query,
		"category": category,
	})
}

// Health check endpoint
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "product-service",
		"timestamp": time.Now(),
		"version":   "1.0.0",
	})
}

func main() {
	// Create Gin router
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

	// Routes
	r.GET("/health", healthCheck)
	
	// Product routes
	r.GET("/products", getProducts)
	r.GET("/products/search", searchProducts)
	r.GET("/products/:id", getProduct)
	r.POST("/products", createProduct)
	r.PUT("/products/:id", updateProduct)
	r.DELETE("/products/:id", deleteProduct)

	// Category routes
	r.GET("/categories", getCategories)
	r.POST("/categories", createCategory)

	// Start server
	port := ":8082"
	log.Printf("Product Service starting on port %s", port)
	log.Printf("Kafka broker: %s", kafkaBroker)
	
	if err := r.Run(port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}