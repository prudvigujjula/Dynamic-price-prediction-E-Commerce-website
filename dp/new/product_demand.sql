CREATE DATABASE product_demand;
USE product_demand;

CREATE TABLE sales (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    region_type ENUM('urban', 'rural') NOT NULL,
    units_sold INT NOT NULL,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data for testing
INSERT INTO sales (product_name, region_type, units_sold, sale_date) VALUES
('Laptop', 'urban', 1200, '2025-03-01'),
('Laptop', 'rural', 300, '2025-03-01'),
('Phone', 'urban', 800, '2025-03-02'),
('Phone', 'rural', 600, '2025-03-02'),
('Tool Kit', 'urban', 500, '2025-03-03'),
('Tool Kit', 'rural', 1000, '2025-03-03'),
('Laptop', 'urban', 500, '2025-03-10'),
('Phone', 'rural', 200, '2025-03-15');