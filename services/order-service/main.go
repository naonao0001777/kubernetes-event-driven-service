package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type OrderRequest struct {
	ProductID string `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,min=1"`
}

type OrderCreatedEvent struct {
	OrderID   string `json:"order_id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	EventType string `json:"event_type"`
}

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func publishOrderEvent(orderEvent OrderCreatedEvent) error {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(getKafkaBroker()),
		Topic:    "orders",
		Balancer: &kafka.LeastBytes{},
	}
	defer writer.Close()

	eventBytes, err := json.Marshal(orderEvent)
	if err != nil {
		return err
	}

	return writer.WriteMessages(context.Background(),
		kafka.Message{
			Key:   []byte(orderEvent.OrderID),
			Value: eventBytes,
		},
	)
}

func createOrder(c *gin.Context) {
	var req OrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	orderID := uuid.New().String()

	orderEvent := OrderCreatedEvent{
		OrderID:   orderID,
		ProductID: req.ProductID,
		Quantity:  req.Quantity,
		EventType: "OrderCreated",
	}

	if err := publishOrderEvent(orderEvent); err != nil {
		log.Printf("Failed to publish order event: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"order_id":   orderID,
		"product_id": req.ProductID,
		"quantity":   req.Quantity,
		"status":     "created",
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "order-service"})
}

func main() {
	r := gin.Default()

	r.POST("/order", createOrder)
	r.GET("/health", healthCheck)

	log.Println("Order Service starting on :8080")
	r.Run(":8080")
}