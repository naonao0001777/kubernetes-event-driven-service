package main

import (
	"log"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

// Dashboard metrics
type DashboardMetrics struct {
	TodayOrders      int     `json:"today_orders"`
	TodayRevenue     float64 `json:"today_revenue"`
	LowStockProducts int     `json:"low_stock_products"`
	PendingOrders    int     `json:"pending_orders"`
	Timestamp        time.Time `json:"timestamp"`
}

// System metrics
type SystemMetrics struct {
	Timestamp       time.Time `json:"timestamp"`
	TotalOrders     int       `json:"total_orders"`
	TodayOrders     int       `json:"today_orders"`
	TotalRevenue    float64   `json:"total_revenue"`
	TodayRevenue    float64   `json:"today_revenue"`
	ActiveProducts  int       `json:"active_products"`
	LowStockCount   int       `json:"low_stock_count"`
	PendingOrders   int       `json:"pending_orders"`
	CompletedOrders int       `json:"completed_orders"`
}

// Revenue analytics
type RevenueAnalytics struct {
	Date           string  `json:"date"`
	Revenue        float64 `json:"revenue"`
	Orders         int     `json:"orders"`
	AvgOrderValue  float64 `json:"avg_order_value"`
}

// Chart data structure
type ChartData struct {
	Labels   []string `json:"labels"`
	Datasets []struct {
		Label           string    `json:"label"`
		Data            []float64 `json:"data"`
		BackgroundColor []string  `json:"backgroundColor,omitempty"`
		BorderColor     []string  `json:"borderColor,omitempty"`
	} `json:"datasets"`
}

// System alert
type SystemAlert struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"` // INFO, WARNING, ERROR, SUCCESS
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
	IsRead    bool      `json:"is_read"`
}

// Admin log entry
type AdminLog struct {
	ID        string                 `json:"id"`
	AdminID   string                 `json:"admin_id"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Details   map[string]interface{} `json:"details"`
	IPAddress string                 `json:"ip_address"`
	Timestamp time.Time              `json:"timestamp"`
}

// Report generation request
type ReportRequest struct {
	Type      string    `json:"type"`      // sales, inventory, orders
	StartDate time.Time `json:"start_date"`
	EndDate   time.Time `json:"end_date"`
	Format    string    `json:"format"`    // json, csv, pdf
}

// Generated report
type Report struct {
	ID          string      `json:"id"`
	Type        string      `json:"type"`
	Status      string      `json:"status"` // generating, completed, failed
	Data        interface{} `json:"data,omitempty"`
	GeneratedAt time.Time   `json:"generated_at"`
	ExpiresAt   time.Time   `json:"expires_at"`
}

// In-memory storage
var (
	systemMetrics  = SystemMetrics{}
	systemAlerts   = []SystemAlert{}
	adminLogs      = []AdminLog{}
	reports        = make(map[string]Report)
	mutex          = sync.RWMutex{}
)

// Kafka configuration
const kafkaBroker = "kafka:9092"

// Kafka reader for consuming events
var kafkaReader *kafka.Reader

func init() {
	// Initialize Kafka reader to consume all events for analytics
	kafkaReader = kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{kafkaBroker},
		GroupID: "management-service",
		Topic:   "orders", // We'll consume from multiple topics
	})

	// Initialize mock data
	initializeMockData()

	// Start background processes
	go startEventConsumer()
	go startMetricsUpdater()
	
	log.Println("Management Service initialized")
}

func initializeMockData() {
	mutex.Lock()
	defer mutex.Unlock()

	// Initialize system metrics with mock data
	systemMetrics = SystemMetrics{
		Timestamp:       time.Now(),
		TotalOrders:     156,
		TodayOrders:     12,
		TotalRevenue:    7842.38,
		TodayRevenue:    1247.88,
		ActiveProducts:  3,
		LowStockCount:   1,
		PendingOrders:   8,
		CompletedOrders: 148,
	}

	// Initialize system alerts
	systemAlerts = []SystemAlert{
		{
			ID:        uuid.New().String(),
			Type:      "WARNING",
			Title:     "Low Stock Alert",
			Message:   "Product 'Elite Device' has low stock (3 remaining)",
			CreatedAt: time.Now().Add(-2 * time.Hour),
			IsRead:    false,
		},
		{
			ID:        uuid.New().String(),
			Type:      "INFO",
			Title:     "System Update",
			Message:   "Management service deployed successfully",
			CreatedAt: time.Now().Add(-1 * time.Hour),
			IsRead:    true,
		},
	}

	log.Println("Management Service initialized with mock data")
}

func startEventConsumer() {
	// This would consume events from all topics to build analytics
	// For now, we'll simulate this with periodic updates
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Simulate processing events and updating metrics
		updateMetricsFromEvents()
	}
}

func startMetricsUpdater() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		// Simulate real-time metrics updates
		mutex.Lock()
		systemMetrics.Timestamp = time.Now()
		// Add some randomness for demonstration
		if rand.Float32() < 0.3 {
			systemMetrics.TodayOrders++
			systemMetrics.TotalOrders++
			revenueIncrease := 29.99 + rand.Float64()*70
			systemMetrics.TodayRevenue += revenueIncrease
			systemMetrics.TotalRevenue += revenueIncrease
		}
		mutex.Unlock()
	}
}

func updateMetricsFromEvents() {
	// This would process Kafka events to update metrics
	// For now, we'll just log that we're processing
	log.Println("Processing events for metrics update")
}

// Dashboard endpoints
func getDashboardMetrics(c *gin.Context) {
	period := c.DefaultQuery("period", "today")
	
	mutex.RLock()
	defer mutex.RUnlock()

	metrics := DashboardMetrics{
		TodayOrders:      systemMetrics.TodayOrders,
		TodayRevenue:     systemMetrics.TodayRevenue,
		LowStockProducts: systemMetrics.LowStockCount,
		PendingOrders:    systemMetrics.PendingOrders,
		Timestamp:        time.Now(),
	}

	// Modify based on period
	switch period {
	case "week":
		metrics.TodayOrders = systemMetrics.TodayOrders * 7
		metrics.TodayRevenue = systemMetrics.TodayRevenue * 7
	case "month":
		metrics.TodayOrders = systemMetrics.TodayOrders * 30
		metrics.TodayRevenue = systemMetrics.TodayRevenue * 30
	}

	c.JSON(http.StatusOK, metrics)
}

func getDashboardCharts(c *gin.Context) {
	// Generate mock chart data
	chartData := ChartData{
		Labels: []string{"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"},
		Datasets: []struct {
			Label           string    `json:"label"`
			Data            []float64 `json:"data"`
			BackgroundColor []string  `json:"backgroundColor,omitempty"`
			BorderColor     []string  `json:"borderColor,omitempty"`
		}{
			{
				Label: "Revenue",
				Data:  []float64{1200, 1900, 3000, 5000, 2000, 3000, 1247.88},
				BackgroundColor: []string{"rgba(54, 162, 235, 0.2)"},
				BorderColor:     []string{"rgba(54, 162, 235, 1)"},
			},
		},
	}

	c.JSON(http.StatusOK, chartData)
}

// Analytics endpoints
func getOrdersAnalytics(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	groupBy := c.DefaultQuery("group_by", "day")

	// Generate mock analytics data
	analytics := []map[string]interface{}{
		{
			"date":            "2025-08-20",
			"total_orders":    12,
			"completed_orders": 8,
			"cancelled_orders": 1,
			"total_revenue":   1247.88,
		},
		{
			"date":            "2025-08-19", 
			"total_orders":    18,
			"completed_orders": 15,
			"cancelled_orders": 0,
			"total_revenue":   1842.67,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"analytics":  analytics,
		"start_date": startDate,
		"end_date":   endDate,
		"group_by":   groupBy,
	})
}

func getProductsAnalytics(c *gin.Context) {
	// Generate mock product analytics
	analytics := []map[string]interface{}{
		{
			"product_id":   "product-1",
			"product_name": "Premium Widget",
			"total_sold":   45,
			"total_revenue": 1349.55,
			"avg_price":    29.99,
		},
		{
			"product_id":   "product-2",
			"product_name": "Deluxe Gadget", 
			"total_sold":   28,
			"total_revenue": 1399.72,
			"avg_price":    49.99,
		},
		{
			"product_id":   "product-3",
			"product_name": "Elite Device",
			"total_sold":   12,
			"total_revenue": 1199.88,
			"avg_price":    99.99,
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"analytics": analytics,
		"total_products": len(analytics),
	})
}

func getRevenueAnalytics(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	groupBy := c.DefaultQuery("group_by", "day")

	// Generate mock revenue analytics
	data := []RevenueAnalytics{
		{
			Date:          "2025-08-20",
			Revenue:       1247.88,
			Orders:        12,
			AvgOrderValue: 103.99,
		},
		{
			Date:          "2025-08-19",
			Revenue:       1842.67,
			Orders:        18,
			AvgOrderValue: 102.37,
		},
		{
			Date:          "2025-08-18",
			Revenue:       2156.34,
			Orders:        21,
			AvgOrderValue: 102.68,
		},
	}

	summary := map[string]interface{}{
		"total_revenue":    5246.89,
		"total_orders":     51,
		"avg_order_value":  102.88,
		"growth_rate":      12.5,
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       data,
		"summary":    summary,
		"start_date": startDate,
		"end_date":   endDate,
		"group_by":   groupBy,
	})
}

// Report generation
func generateReport(c *gin.Context) {
	var req ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reportID := uuid.New().String()

	// Create report
	report := Report{
		ID:          reportID,
		Type:        req.Type,
		Status:      "generating",
		GeneratedAt: time.Now(),
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}

	mutex.Lock()
	reports[reportID] = report
	mutex.Unlock()

	// Simulate report generation (in real implementation, this would be async)
	go func() {
		time.Sleep(2 * time.Second) // Simulate processing time
		
		mutex.Lock()
		defer mutex.Unlock()
		
		report := reports[reportID]
		report.Status = "completed"
		report.Data = map[string]interface{}{
			"type": req.Type,
			"generated_at": time.Now(),
			"summary": "Report generated successfully",
		}
		reports[reportID] = report
	}()

	log.Printf("Report generation started: %s", reportID)
	c.JSON(http.StatusAccepted, gin.H{
		"report_id": reportID,
		"status":    "generating",
	})
}

func getReport(c *gin.Context) {
	reportID := c.Param("id")

	mutex.RLock()
	defer mutex.RUnlock()

	report, exists := reports[reportID]
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	c.JSON(http.StatusOK, report)
}

// System monitoring
func getSystemHealth(c *gin.Context) {
	health := map[string]interface{}{
		"status": "healthy",
		"services": []map[string]interface{}{
			{
				"name":   "order-service",
				"status": "healthy",
				"uptime": "99.9%",
			},
			{
				"name":   "inventory-service",
				"status": "healthy",
				"uptime": "99.8%",
			},
			{
				"name":   "product-service",
				"status": "healthy",
				"uptime": "100%",
			},
			{
				"name":   "management-service",
				"status": "healthy",
				"uptime": "100%",
			},
		},
		"kafka": map[string]interface{}{
			"status":        "healthy",
			"topics":        5,
			"messages_per_sec": 45.2,
			"consumer_lag":  "< 1ms",
		},
		"timestamp": time.Now(),
	}

	c.JSON(http.StatusOK, health)
}

func getSystemAlerts(c *gin.Context) {
	mutex.RLock()
	defer mutex.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"alerts": systemAlerts,
		"total":  len(systemAlerts),
	})
}

func createSystemAlert(c *gin.Context) {
	var alert SystemAlert
	if err := c.ShouldBindJSON(&alert); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	alert.ID = uuid.New().String()
	alert.CreatedAt = time.Now()
	alert.IsRead = false

	mutex.Lock()
	systemAlerts = append(systemAlerts, alert)
	mutex.Unlock()

	log.Printf("System alert created: %s", alert.Title)
	c.JSON(http.StatusCreated, alert)
}

// Admin logs
func getAdminLogs(c *gin.Context) {
	mutex.RLock()
	defer mutex.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"logs":  adminLogs,
		"total": len(adminLogs),
	})
}

func createAdminLog(c *gin.Context) {
	var logEntry AdminLog
	if err := c.ShouldBindJSON(&logEntry); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	logEntry.ID = uuid.New().String()
	logEntry.Timestamp = time.Now()
	logEntry.IPAddress = c.ClientIP()

	mutex.Lock()
	adminLogs = append(adminLogs, logEntry)
	mutex.Unlock()

	log.Printf("Admin action logged: %s on %s", logEntry.Action, logEntry.Resource)
	c.JSON(http.StatusCreated, logEntry)
}

// Health check endpoint
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"service":   "management-service",
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

	// Dashboard routes
	r.GET("/dashboard/metrics", getDashboardMetrics)
	r.GET("/dashboard/charts", getDashboardCharts)

	// Analytics routes
	r.GET("/analytics/orders", getOrdersAnalytics)
	r.GET("/analytics/products", getProductsAnalytics)
	r.GET("/analytics/revenue", getRevenueAnalytics)

	// Report routes
	r.POST("/reports/generate", generateReport)
	r.GET("/reports/:id", getReport)

	// System monitoring routes
	r.GET("/system/health", getSystemHealth)
	r.GET("/system/alerts", getSystemAlerts)
	r.POST("/system/alerts", createSystemAlert)

	// Admin log routes
	r.GET("/admin/logs", getAdminLogs)
	r.POST("/admin/logs", createAdminLog)

	// Start server
	port := ":8083"
	log.Printf("Management Service starting on port %s", port)
	log.Printf("Kafka broker: %s", kafkaBroker)

	if err := r.Run(port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}