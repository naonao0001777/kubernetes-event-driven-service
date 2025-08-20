package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
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

type NotificationEvent struct {
	OrderID       string    `json:"order_id"`
	EventType     string    `json:"event_type"`
	Message       string    `json:"message"`
	Channel       string    `json:"channel"`
	SentAt        time.Time `json:"sent_at"`
}

type NotificationLog struct {
	mu   sync.RWMutex
	logs []NotificationEvent
}

func NewNotificationLog() *NotificationLog {
	return &NotificationLog{
		logs: make([]NotificationEvent, 0),
	}
}

func (nl *NotificationLog) AddLog(event NotificationEvent) {
	nl.mu.Lock()
	defer nl.mu.Unlock()
	nl.logs = append(nl.logs, event)
}

func (nl *NotificationLog) GetLogs() []NotificationEvent {
	nl.mu.RLock()
	defer nl.mu.RUnlock()
	result := make([]NotificationEvent, len(nl.logs))
	copy(result, nl.logs)
	return result
}

var notificationLog = NewNotificationLog()

func getKafkaBroker() string {
	if broker := os.Getenv("KAFKA_BROKER"); broker != "" {
		return broker
	}
	return "localhost:9092"
}

func publishNotificationEvent(event NotificationEvent) error {
	writer := &kafka.Writer{
		Addr:     kafka.TCP(getKafkaBroker()),
		Topic:    "notification",
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

func sendNotification(orderID string, message string) NotificationEvent {
	time.Sleep(50 * time.Millisecond)

	event := NotificationEvent{
		OrderID:   orderID,
		EventType: "NotificationSent",
		Message:   message,
		Channel:   "email",
		SentAt:    time.Now(),
	}

	log.Printf("Sending notification for order: %s - %s", orderID, message)
	
	return event
}

func processPaymentEvent(event PaymentEvent) {
	if event.EventType != "PaymentCompleted" {
		log.Printf("Ignoring payment event: %s for order: %s", event.EventType, event.OrderID)
		return
	}

	message := fmt.Sprintf("Payment of $%.2f completed for order %s. Your order will be processed soon.", 
		event.Amount, event.OrderID)

	notificationEvent := sendNotification(event.OrderID, message)
	notificationLog.AddLog(notificationEvent)

	if err := publishNotificationEvent(notificationEvent); err != nil {
		log.Printf("Failed to publish notification event: %v", err)
	}
}

func consumePaymentEvents() {
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{getKafkaBroker()},
		Topic:   "payment",
		GroupID: "notification-service",
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

func getNotifications(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"notifications": notificationLog.GetLogs(),
	})
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "healthy", "service": "notification-service"})
}

func main() {
	go consumePaymentEvents()

	r := gin.Default()
	r.GET("/notifications", getNotifications)
	r.GET("/health", healthCheck)

	log.Printf("Notification Service starting on port :8085")
	r.Run(":8085")
}