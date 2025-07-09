
USE ecommerce_db;

CREATE TABLE sales_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    price DECIMAL(10, 2),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE marketing_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    region VARCHAR(50),
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO customers (region) VALUES ('NY'), ('LA');

-- Sample initial data
INSERT INTO sales_log (price) VALUES (50.00);
INSERT INTO marketing_assets (name) VALUES ('banner1.jpg');