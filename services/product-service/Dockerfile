# Build stage
FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copy go mod file
COPY go.mod ./

# Download dependencies
RUN go mod tidy && go get github.com/gin-gonic/gin github.com/google/uuid github.com/segmentio/kafka-go && go mod download

# Copy source code
COPY . .

# Build the application
RUN go mod tidy && CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o product-service .

# Final stage
FROM alpine:latest

# Add ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/product-service .

# Expose port
EXPOSE 8082

# Run the binary
CMD ["./product-service"]