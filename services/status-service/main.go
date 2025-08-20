package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/segmentio/kafka-go"
)

type OrderStatus struct {
	OrderID           string            `json:"order_id"`
	ProductID         string            `json:"product_id"`
	Quantity          int               `json:"quantity"`
	Status            string            `json:"status"`
	Events            []EventRecord     `json:"events"`
	LastUpdated       time.Time         `json:"last_updated"`
	TrackingNumber    string            `json:"tracking_number,omitempty"`
	PaymentAmount     float64           `json:"payment_amount,omitempty"`
}

type EventRecord struct {
	EventType string    `json:"event_type"`
	Data      string    `json:"data"`
	Timestamp time.Time `json:"timestamp"`
}

type OrderStatistics struct {
	TotalOrders        int               `json:"total_orders"`
	OrdersByStatus     map[string]int    `json:"orders_by_status"`
	OrdersByProduct    map[string]int    `json:"orders_by_product"`
	RecentOrders       []*OrderStatus    `json:"recent_orders"`
	TotalRevenue       float64           `json:"total_revenue"`
	AverageOrderValue  float64           `json:"average_order_value"`
	CompletionRate     float64           `json:"completion_rate"`
	ProcessingTime     map[string]string `json:"processing_time"`
}

type OrderFilter struct {
	Status     string `json:"status"`
	ProductID  string `json:"product_id"`
	DateFrom   string `json:"date_from"`
	DateTo     string `json:"date_to"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

type StatusManager struct {
	mu      sync.RWMutex
	orders  map[string]*OrderStatus
	clients map[string][]*websocket.Conn
}

func NewStatusManager() *StatusManager {
	return &StatusManager{
		orders:  make(map[string]*OrderStatus),
		clients: make(map[string][]*websocket.Conn),
	}
}

func (sm *StatusManager) UpdateOrderStatus(orderID string, eventType string, data interface{}) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	order, exists := sm.orders[orderID]
	if !exists {
		order = &OrderStatus{
			OrderID: orderID,
			Status:  "created",
			Events:  make([]EventRecord, 0),
		}
		sm.orders[orderID] = order
	}

	dataBytes, _ := json.Marshal(data)
	event := EventRecord{
		EventType: eventType,
		Data:      string(dataBytes),
		Timestamp: time.Now(),
	}

	order.Events = append(order.Events, event)
	order.LastUpdated = time.Now()

	switch eventType {
	case "OrderCreated":
		var orderData map[string]interface{}
		json.Unmarshal(dataBytes, &orderData)
		if productID, ok := orderData["product_id"].(string); ok {
			order.ProductID = productID
		}
		if quantity, ok := orderData["quantity"].(float64); ok {
			order.Quantity = int(quantity)
		}
		order.Status = "created"
	case "InventoryConfirmed":
		order.Status = "inventory_confirmed"
	case "InventoryRejected":
		order.Status = "inventory_rejected"
	case "PaymentCompleted":
		order.Status = "payment_completed"
		var paymentData map[string]interface{}
		json.Unmarshal(dataBytes, &paymentData)
		if amount, ok := paymentData["amount"].(float64); ok {
			order.PaymentAmount = amount
		}
	case "PaymentFailed":
		order.Status = "payment_failed"
	case "NotificationSent":
		order.Status = "notification_sent"
	case "Shipped":
		order.Status = "shipped"
		var shippingData map[string]interface{}
		json.Unmarshal(dataBytes, &shippingData)
		if trackingNumber, ok := shippingData["tracking_number"].(string); ok {
			order.TrackingNumber = trackingNumber
		}
	}

	sm.notifyClients(orderID, order)
}

func (sm *StatusManager) notifyClients(orderID string, order *OrderStatus) {
	clients, exists := sm.clients[orderID]
	if !exists {
		return
	}

	message, _ := json.Marshal(order)
	
	activeClients := make([]*websocket.Conn, 0)
	for _, conn := range clients {
		if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
			conn.Close()
		} else {
			activeClients = append(activeClients, conn)
		}
	}
	
	sm.clients[orderID] = activeClients
}

func (sm *StatusManager) AddClient(orderID string, conn *websocket.Conn) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	if sm.clients[orderID] == nil {
		sm.clients[orderID] = make([]*websocket.Conn, 0)
	}
	sm.clients[orderID] = append(sm.clients[orderID], conn)
	
	if order, exists := sm.orders[orderID]; exists {
		message, _ := json.Marshal(order)
		conn.WriteMessage(websocket.TextMessage, message)
	}
}

func (sm *StatusManager) GetOrderStatus(orderID string) (*OrderStatus, bool) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	order, exists := sm.orders[orderID]
	if !exists {
		return nil, false
	}
	
	orderCopy := *order
	eventsCopy := make([]EventRecord, len(order.Events))
	copy(eventsCopy, order.Events)
	orderCopy.Events = eventsCopy
	
	return &orderCopy, true
}

func (sm *StatusManager) GetAllOrders() map[string]*OrderStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	result := make(map[string]*OrderStatus)
	for k, v := range sm.orders {
		orderCopy := *v
		eventsCopy := make([]EventRecord, len(v.Events))
		copy(eventsCopy, v.Events)
		orderCopy.Events = eventsCopy
		result[k] = &orderCopy
	}
	return result
}

func (sm *StatusManager) GetFilteredOrders(filter OrderFilter) []*OrderStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	var result []*OrderStatus
	
	// Parse date filters
	var dateFrom, dateTo time.Time
	var err error
	if filter.DateFrom != "" {
		dateFrom, err = time.Parse("2006-01-02", filter.DateFrom)
		if err != nil {
			log.Printf("Invalid date_from format: %v", err)
		}
	}
	if filter.DateTo != "" {
		dateTo, err = time.Parse("2006-01-02", filter.DateTo)
		if err != nil {
			log.Printf("Invalid date_to format: %v", err)
		}
		dateTo = dateTo.Add(23*time.Hour + 59*time.Minute + 59*time.Second) // End of day
	}
	
	for _, v := range sm.orders {
		// Status filter
		if filter.Status != "" && v.Status != filter.Status {
			continue
		}
		
		// Product filter
		if filter.ProductID != "" && v.ProductID != filter.ProductID {
			continue
		}
		
		// Date filter
		if !dateFrom.IsZero() && v.LastUpdated.Before(dateFrom) {
			continue
		}
		if !dateTo.IsZero() && v.LastUpdated.After(dateTo) {
			continue
		}
		
		orderCopy := *v
		eventsCopy := make([]EventRecord, len(v.Events))
		copy(eventsCopy, v.Events)
		orderCopy.Events = eventsCopy
		result = append(result, &orderCopy)
	}
	
	// Sort by last updated (newest first)
	sort.Slice(result, func(i, j int) bool {
		return result[i].LastUpdated.After(result[j].LastUpdated)
	})
	
	// Apply pagination
	if filter.Offset > 0 {
		if filter.Offset >= len(result) {
			return []*OrderStatus{}
		}
		result = result[filter.Offset:]
	}
	
	if filter.Limit > 0 && filter.Limit < len(result) {
		result = result[:filter.Limit]
	}
	
	return result
}

func (sm *StatusManager) GetStatistics() OrderStatistics {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	stats := OrderStatistics{
		OrdersByStatus:  make(map[string]int),
		OrdersByProduct: make(map[string]int),
		ProcessingTime:  make(map[string]string),
	}
	
	var totalRevenue float64
	var completedOrders int
	var recentOrders []*OrderStatus
	
	// Process all orders
	for _, order := range sm.orders {
		stats.TotalOrders++
		
		// Count by status
		stats.OrdersByStatus[order.Status]++
		
		// Count by product
		if order.ProductID != "" {
			stats.OrdersByProduct[order.ProductID]++
		}
		
		// Calculate revenue
		if order.Status == "payment_completed" || order.Status == "shipped" {
			totalRevenue += order.PaymentAmount
			completedOrders++
		}
		
		// Collect recent orders (last 10)
		if len(recentOrders) < 10 {
			orderCopy := *order
			eventsCopy := make([]EventRecord, len(order.Events))
			copy(eventsCopy, order.Events)
			orderCopy.Events = eventsCopy
			recentOrders = append(recentOrders, &orderCopy)
		}
	}
	
	// Sort recent orders by last updated
	sort.Slice(recentOrders, func(i, j int) bool {
		return recentOrders[i].LastUpdated.After(recentOrders[j].LastUpdated)
	})
	
	stats.RecentOrders = recentOrders
	stats.TotalRevenue = totalRevenue
	
	if stats.TotalOrders > 0 {
		stats.AverageOrderValue = totalRevenue / float64(completedOrders)
		stats.CompletionRate = float64(completedOrders) / float64(stats.TotalOrders) * 100
	}
	
	// Calculate average processing times
	processingTimes := make(map[string][]time.Duration)
	
	for _, order := range sm.orders {
		if len(order.Events) >= 2 {
			createdTime := order.Events[0].Timestamp
			for i, event := range order.Events[1:] {
				stage := fmt.Sprintf("stage_%d", i+1)
				duration := event.Timestamp.Sub(createdTime)
				processingTimes[stage] = append(processingTimes[stage], duration)
			}
		}
	}
	
	// Calculate averages
	for stage, durations := range processingTimes {
		if len(durations) > 0 {
			var total time.Duration
			for _, d := range durations {
				total += d
			}
			avg := total / time.Duration(len(durations))
			stats.ProcessingTime[stage] = avg.String()
		}
	}
	
	return stats
}

func (sm *StatusManager) SearchOrders(query string) []*OrderStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	var result []*OrderStatus
	queryLower := strings.ToLower(query)
	
	for _, order := range sm.orders {
		// Search in order ID, product ID, status, tracking number
		if strings.Contains(strings.ToLower(order.OrderID), queryLower) ||
		   strings.Contains(strings.ToLower(order.ProductID), queryLower) ||
		   strings.Contains(strings.ToLower(order.Status), queryLower) ||
		   strings.Contains(strings.ToLower(order.TrackingNumber), queryLower) {
			
			orderCopy := *order
			eventsCopy := make([]EventRecord, len(order.Events))
			copy(eventsCopy, order.Events)
			orderCopy.Events = eventsCopy
			result = append(result, &orderCopy)
		}
	}
	
	// Sort by relevance (exact matches first, then partial matches)
	sort.Slice(result, func(i, j int) bool {
		return result[i].LastUpdated.After(result[j].LastUpdated)
	})
	
	return result
}

func (sm *StatusManager) DeleteOrder(orderID string) bool {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	
	if _, exists := sm.orders[orderID]; exists {
		delete(sm.orders, orderID)
		// Also remove any WebSocket clients for this order
		delete(sm.clients, orderID)
		return true
	}
	return false
}

func (sm *StatusManager) GetOrdersByDateRange(from, to time.Time) []*OrderStatus {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	
	var result []*OrderStatus
	
	for _, order := range sm.orders {
		if order.LastUpdated.After(from) && order.LastUpdated.Before(to) {
			orderCopy := *order
			eventsCopy := make([]EventRecord, len(order.Events))
			copy(eventsCopy, order.Events)
			orderCopy.Events = eventsCopy
			result = append(result, &orderCopy)
		}
	}
	
	sort.Slice(result, func(i, j int) bool {
		return result[i].LastUpdated.After(result[j].LastUpdated)
	})
	
	return result
}

var statusManager = NewStatusManager()
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func consumeEvents(topic string) {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{getKafkaBroker()},
		Topic:   topic,
		GroupID: "status-service",
	})
	defer reader.Close()

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message from %s: %v", topic, err)
			continue
		}

		var eventData map[string]interface{}
		if err := json.Unmarshal(msg.Value, &eventData); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		if orderID, ok := eventData["order_id"].(string); ok {
			if eventType, ok := eventData["event_type"].(string); ok {
				statusManager.UpdateOrderStatus(orderID, eventType, eventData)
			}
		}
	}
}

func getOrderStatus(c *gin.Context) {
	orderID := c.Param("orderId")
	
	order, exists := statusManager.GetOrderStatus(orderID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	
	c.JSON(http.StatusOK, order)
}

func getAllOrders(c *gin.Context) {
	orders := statusManager.GetAllOrders()
	c.JSON(http.StatusOK, gin.H{"orders": orders})
}

func websocketHandler(c *gin.Context) {
	orderID := c.Param("orderId")
	
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	statusManager.AddClient(orderID, conn)
	log.Printf("WebSocket connection established for order: %s", orderID)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}
	}
}

func getStatistics(c *gin.Context) {
	stats := statusManager.GetStatistics()
	c.JSON(http.StatusOK, stats)
}

func getFilteredOrders(c *gin.Context) {
	var filter OrderFilter
	
	// Parse query parameters
	filter.Status = c.Query("status")
	filter.ProductID = c.Query("product_id")
	filter.DateFrom = c.Query("date_from")
	filter.DateTo = c.Query("date_to")
	
	if limitStr := c.Query("limit"); limitStr != "" {
		if limit, err := strconv.Atoi(limitStr); err == nil {
			filter.Limit = limit
		}
	}
	
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if offset, err := strconv.Atoi(offsetStr); err == nil {
			filter.Offset = offset
		}
	}
	
	orders := statusManager.GetFilteredOrders(filter)
	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
		"filter": filter,
	})
}

func searchOrders(c *gin.Context) {
	query := c.Query("q")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Search query 'q' is required"})
		return
	}
	
	orders := statusManager.SearchOrders(query)
	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
		"query":  query,
	})
}

func deleteOrder(c *gin.Context) {
	orderID := c.Param("orderId")
	
	if statusManager.DeleteOrder(orderID) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Order deleted successfully",
			"order_id": orderID,
		})
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
	}
}

func getOrdersByStatus(c *gin.Context) {
	status := c.Param("status")
	
	filter := OrderFilter{Status: status}
	orders := statusManager.GetFilteredOrders(filter)
	
	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
		"status": status,
	})
}

func getOrdersByProduct(c *gin.Context) {
	productID := c.Param("productId")
	
	filter := OrderFilter{ProductID: productID}
	orders := statusManager.GetFilteredOrders(filter)
	
	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
		"product_id": productID,
	})
}

func getDailyReport(c *gin.Context) {
	dateStr := c.Param("date")
	
	date, err := time.Parse("2006-01-02", dateStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format. Use YYYY-MM-DD"})
		return
	}
	
	from := date
	to := date.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
	
	orders := statusManager.GetOrdersByDateRange(from, to)
	
	// Generate daily statistics
	statusCounts := make(map[string]int)
	productCounts := make(map[string]int)
	var totalRevenue float64
	
	for _, order := range orders {
		statusCounts[order.Status]++
		if order.ProductID != "" {
			productCounts[order.ProductID]++
		}
		if order.Status == "payment_completed" || order.Status == "shipped" {
			totalRevenue += order.PaymentAmount
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"date":             dateStr,
		"total_orders":     len(orders),
		"orders_by_status": statusCounts,
		"orders_by_product": productCounts,
		"total_revenue":    totalRevenue,
		"orders":           orders,
	})
}

func getOrderEvents(c *gin.Context) {
	orderID := c.Param("orderId")
	
	order, exists := statusManager.GetOrderStatus(orderID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"order_id": orderID,
		"events":   order.Events,
		"count":    len(order.Events),
	})
}

func bulkDeleteOrders(c *gin.Context) {
	var request struct {
		OrderIDs []string `json:"order_ids" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	deleted := 0
	notFound := 0
	
	for _, orderID := range request.OrderIDs {
		if statusManager.DeleteOrder(orderID) {
			deleted++
		} else {
			notFound++
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"deleted":   deleted,
		"not_found": notFound,
		"total_requested": len(request.OrderIDs),
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "status-service"})
}

func main() {
	topics := []string{"orders", "inventory", "payment", "notification", "shipping"}
	
	for _, topic := range topics {
		go consumeEvents(topic)
	}

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
	r.GET("/status/:orderId", getOrderStatus)
	r.GET("/orders", getAllOrders)
	r.GET("/ws/:orderId", websocketHandler)
	r.GET("/health", healthCheck)
	
	// New management endpoints
	r.GET("/statistics", getStatistics)
	r.GET("/orders/filtered", getFilteredOrders)
	r.GET("/orders/search", searchOrders)
	r.GET("/orders/status/:status", getOrdersByStatus)
	r.GET("/orders/product/:productId", getOrdersByProduct)
	r.GET("/orders/:orderId/events", getOrderEvents)
	r.GET("/reports/daily/:date", getDailyReport)
	r.DELETE("/orders/:orderId", deleteOrder)
	r.POST("/orders/bulk-delete", bulkDeleteOrders)

	log.Printf("Status Service starting on port :8087")
	log.Println("Management API endpoints:")
	log.Println("  GET    /statistics               - Get order statistics")
	log.Println("  GET    /orders/filtered          - Get filtered orders")
	log.Println("  GET    /orders/search?q=query    - Search orders")
	log.Println("  GET    /orders/status/:status    - Get orders by status")
	log.Println("  GET    /orders/product/:productId - Get orders by product")
	log.Println("  GET    /orders/:orderId/events   - Get order event history")
	log.Println("  GET    /reports/daily/:date      - Get daily report")
	log.Println("  DELETE /orders/:orderId          - Delete order")
	log.Println("  POST   /orders/bulk-delete       - Bulk delete orders")
	
	r.Run(":8087")
}