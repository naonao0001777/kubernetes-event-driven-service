package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/segmentio/kafka-go"
)

type PaymentEvent struct {
	OrderID     string    `json:"order_id"`
	ProductID   string    `json:"product_id"`
	Quantity    int       `json:"quantity"`
	Amount      float64   `json:"amount"`
	EventType   string    `json:"event_type"`
	Reason      string    `json:"reason,omitempty"`
	ProcessedAt time.Time `json:"processed_at"`
}

type ShippingEvent struct {
	OrderID        string    `json:"order_id"`
	ProductID      string    `json:"product_id"`
	Quantity       int       `json:"quantity"`
	EventType      string    `json:"event_type"`
	TrackingNumber string    `json:"tracking_number"`
	Carrier        string    `json:"carrier"`
	EstimatedDays  int       `json:"estimated_delivery_days"`
	ShippedAt      time.Time `json:"shipped_at"`
}

type ShipmentLog struct {
	mu        sync.RWMutex
	shipments []ShippingEvent
}

func NewShipmentLog() *ShipmentLog {
	return &ShipmentLog{
		shipments: make([]ShippingEvent, 0),
	}
}

func (sl *ShipmentLog) AddShipment(event ShippingEvent) {
	sl.mu.Lock()
	defer sl.mu.Unlock()
	sl.shipments = append(sl.shipments, event)
}

func (sl *ShipmentLog) GetShipments() []ShippingEvent {
	sl.mu.RLock()
	defer sl.mu.RUnlock()
	result := make([]ShippingEvent, len(sl.shipments))
	copy(result, sl.shipments)
	return result
}

var shipmentLog = NewShipmentLog()

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func publishShippingEvent(event ShippingEvent) error {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(getKafkaBroker()),
		Topic:    "shipping",
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

func processShipment(orderID, productID string, quantity int) ShippingEvent {
	time.Sleep(200 * time.Millisecond)

	carriers := []string{"FedEx", "UPS", "DHL", "USPS"}
	carrier := carriers[len(orderID)%len(carriers)]

	trackingNumber := "TRK" + uuid.New().String()[:8]

	estimatedDays := 3
	if quantity > 5 {
		estimatedDays = 5
	}

	event := ShippingEvent{
		OrderID:        orderID,
		ProductID:      productID,
		Quantity:       quantity,
		EventType:      "Shipped",
		TrackingNumber: trackingNumber,
		Carrier:        carrier,
		EstimatedDays:  estimatedDays,
		ShippedAt:      time.Now(),
	}

	log.Printf("Order shipped: %s via %s, tracking: %s", orderID, carrier, trackingNumber)
	return event
}

func processPaymentEvent(event PaymentEvent) {
	if event.EventType != "PaymentCompleted" {
		log.Printf("Ignoring payment event: %s for order: %s", event.EventType, event.OrderID)
		return
	}

	log.Printf("Processing shipment for order: %s", event.OrderID)

	shippingEvent := processShipment(event.OrderID, event.ProductID, event.Quantity)
	shipmentLog.AddShipment(shippingEvent)

	if err := publishShippingEvent(shippingEvent); err != nil {
		log.Printf("Failed to publish shipping event: %v", err)
	}
}

func consumePaymentEvents() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{getKafkaBroker()},
		Topic:   "payment",
		GroupID: "shipping-service",
	})
	defer reader.Close()

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("Error reading message: %v", err)
			continue
		}

		var event PaymentEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("Error unmarshaling message: %v", err)
			continue
		}

		processPaymentEvent(event)
	}
}

func getShipments(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"shipments": shipmentLog.GetShipments(),
	})
}

func trackShipment(c *gin.Context) {
	trackingNumber := c.Param("tracking")
	
	shipments := shipmentLog.GetShipments()
	for _, shipment := range shipments {
		if shipment.TrackingNumber == trackingNumber {
			c.JSON(http.StatusOK, shipment)
			return
		}
	}
	
	c.JSON(http.StatusNotFound, gin.H{"error": "Tracking number not found"})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "shipping-service"})
}

func main() {
	go consumePaymentEvents()

	r := gin.Default()
	r.GET("/shipments", getShipments)
	r.GET("/track/:tracking", trackShipment)
	r.GET("/health", healthCheck)

	log.Printf("Shipping Service starting on port :8086")
	r.Run(":8086")
}