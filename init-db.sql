-- Production Database Initialization Script
-- 本番環境用データベース初期化

-- Create databases for each service
CREATE DATABASE order_service_db;
CREATE DATABASE inventory_service_db;
CREATE DATABASE product_service_db;
CREATE DATABASE payment_service_db;
CREATE DATABASE shipping_service_db;
CREATE DATABASE status_service_db;

-- Create users for each service with limited privileges
CREATE USER order_user WITH PASSWORD 'order_secure_2025';
CREATE USER inventory_user WITH PASSWORD 'inventory_secure_2025';
CREATE USER product_user WITH PASSWORD 'product_secure_2025';
CREATE USER payment_user WITH PASSWORD 'payment_secure_2025';
CREATE USER shipping_user WITH PASSWORD 'shipping_secure_2025';
CREATE USER status_user WITH PASSWORD 'status_secure_2025';

-- Grant database permissions
GRANT ALL PRIVILEGES ON DATABASE order_service_db TO order_user;
GRANT ALL PRIVILEGES ON DATABASE inventory_service_db TO inventory_user;
GRANT ALL PRIVILEGES ON DATABASE product_service_db TO product_user;
GRANT ALL PRIVILEGES ON DATABASE payment_service_db TO payment_user;
GRANT ALL PRIVILEGES ON DATABASE shipping_service_db TO shipping_user;
GRANT ALL PRIVILEGES ON DATABASE status_service_db TO status_user;

-- Connect to order_service_db and create tables
\c order_service_db;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id VARCHAR(255),
    product_id VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_events (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connect to inventory_service_db and create tables
\c inventory_service_db;

CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) UNIQUE NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) NOT NULL,
    movement_type VARCHAR(50) NOT NULL, -- ADD, REMOVE, RESERVE, RELEASE
    quantity INTEGER NOT NULL,
    previous_quantity INTEGER,
    new_quantity INTEGER,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connect to product_service_db and create tables  
\c product_service_db;

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    category_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id VARCHAR(255),
    sku VARCHAR(100),
    images JSON,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
);

-- Connect to payment_service_db and create tables
\c payment_service_db;

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    payment_id VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'JPY',
    payment_method VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connect to shipping_service_db and create tables
\c shipping_service_db;

CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    shipment_id VARCHAR(255) UNIQUE NOT NULL,
    order_id VARCHAR(255) NOT NULL,
    tracking_number VARCHAR(255),
    carrier VARCHAR(100),
    status VARCHAR(50) DEFAULT 'preparing',
    shipping_address JSON,
    estimated_delivery DATE,
    actual_delivery DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Connect to status_service_db and create tables
\c status_service_db;

CREATE TABLE IF NOT EXISTS order_status (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    status_details JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_data JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for testing
\c product_service_db;

INSERT INTO categories (category_id, name, description) VALUES 
('cat-electronics', 'エレクトロニクス', '電子機器・ガジェット'),
('cat-books', '書籍', '本・雑誌・電子書籍'),
('cat-clothing', 'ファッション', '衣類・アクセサリー'),
('cat-home', 'ホーム・キッチン', '家庭用品・キッチン用品')
ON CONFLICT (category_id) DO NOTHING;

INSERT INTO products (product_id, name, description, price, category_id, sku) VALUES 
('prod-laptop-001', 'プロフェッショナルノートパソコン', '高性能ビジネス向けラップトップ', 149800.00, 'cat-electronics', 'LAPTOP-PRO-001'),
('prod-book-001', 'プログラミング入門書', 'Go言語での実践プログラミング', 3200.00, 'cat-books', 'BOOK-GO-001'),
('prod-shirt-001', 'カジュアルTシャツ', 'コットン100%の快適なTシャツ', 2900.00, 'cat-clothing', 'SHIRT-CASUAL-001'),
('prod-mug-001', 'セラミックマグカップ', '手作り感のある陶器マグ', 1200.00, 'cat-home', 'MUG-CERAMIC-001')
ON CONFLICT (product_id) DO NOTHING;

\c inventory_service_db;

INSERT INTO inventory (product_id, quantity, reorder_level) VALUES 
('prod-laptop-001', 50, 5),
('prod-book-001', 200, 20),
('prod-shirt-001', 150, 15),
('prod-mug-001', 100, 10)
ON CONFLICT (product_id) DO NOTHING;
