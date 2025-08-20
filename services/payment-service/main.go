package main

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/segmentio/kafka-go"
)

type InventoryEvent struct {
	OrderID   string `json:"order_id"`
	ProductID string `json:"product_id"`
	Quantity  int    `json:"quantity"`
	EventType string `json:"event_type"`
	Reason    string `json:"reason,omitempty"`
}

type PaymentEvent struct {
	OrderID     string `json:"order_id"`
	ProductID   string `json:"product_id"`
	Quantity    int    `json:"quantity"`
	Amount      float64 `json:"amount"`
	EventType   string `json:"event_type"`
	Reason      string `json:"reason,omitempty"`
	ProcessedAt time.Time `json:"processed_at"`
}

var productPrices = map[string]float64{
	"product-1": 29.99,
	"product-2": 49.99,
	"product-3": 99.99,
}

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func publishPaymentEvent(event PaymentEvent) error {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(getKafkaBroker()),
		Topic:    "payment",
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

func processPayment(orderID, productID string, quantity int) PaymentEvent {
	time.Sleep(100 * time.Millisecond)

	price, exists := productPrices[productID]
	if !exists {
		price = 19.99
	}
	amount := price * float64(quantity)

	event := PaymentEvent{
		OrderID:     orderID,
		ProductID:   productID,
		Quantity:    quantity,
		Amount:      amount,
		ProcessedAt: time.Now(),
	}

	if rand.Float32() < 0.95 {
		event.EventType = "PaymentCompleted"
		log.Printf("Payment completed for order: %s, amount: $%.2f", orderID, amount)
	} else {
		event.EventType = "PaymentFailed"
		event.Reason = "Payment declined by bank"
		log.Printf("Payment failed for order: %s - %s", orderID, event.Reason)
	}

	return event
}

func processInventoryEvent(event InventoryEvent) {
	if event.EventType != "InventoryConfirmed" {
		log.Printf("Ignoring inventory event: %s for order: %s", event.EventType, event.OrderID)
		return
	}

	log.Printf("Processing payment for order: %s", event.OrderID)

	paymentEvent := processPayment(event.OrderID, event.ProductID, event.Quantity)

	if err := publishPaymentEvent(paymentEvent); err != nil {
		log.Printf("Failed to publish payment event: %v", err)
	}
}

func consumeInventoryEvents() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{getKafkaBroker()},
		Topic:   "inventory",
		GroupID: "payment-service",
	})
	defer reader.Close()

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message: %v", err)
			continue
		}

		var event InventoryEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		processInventoryEvent(event)
	}
}

func getProductPrices(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"prices": productPrices,
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "payment-service"})
}

func main() {
	rand.Seed(time.Now().UnixNano())
	
	go consumeInventoryEvents()

	r := gin.Default()
	r.GET("/prices", getProductPrices)
	r.GET("/health", healthCheck)

	log.Printf("Payment Service starting on port :8084")
	r.Run(":8084")
}