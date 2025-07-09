const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root', // Replace with your MySQL username
    password: 'Hari@143', // Replace with your MySQL password
    database: 'ecommerce_db',
    connectionLimit: 30
});

// API for static sales data (Subtask 1)
app.get('/api/sales', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT product_name, region_type, SUM(units_sold) as total_sold FROM sales GROUP BY product_name, region_type');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching sales:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// API for trend data (Subtask 2)
app.get('/api/sales-trends', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT product_name, region_type, DATE(sale_date) as sale_date, SUM(units_sold) as total_sold 
            FROM sales 
            GROUP BY product_name, region_type, DATE(sale_date)
            ORDER BY sale_date
        `);
        res.json(rows);
    } catch (error) {
        console.error('Error fetching trends:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// API for inventory requirements (Subtask 3)
app.get('/api/inventory-requirements', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT product_name, region_type, 
                   AVG(units_sold) * 7 + (AVG(units_sold) * 0.2) as inventory_requirement
            FROM sales
            WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY product_name, region_type
        `);
        res.json(rows.map(row => ({
            product_name: row.product_name,
            region_type: row.region_type,
            inventory_requirement: Math.round(row.inventory_requirement)
        })));
    } catch (error) {
        console.error('Error fetching inventory:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// API to add new sale
app.post('/api/sales', async (req, res) => {
    const { product_name, region_type, units_sold } = req.body;
    try {
        await pool.query('INSERT INTO sales (product_name, region_type, units_sold) VALUES (?, ?, ?)', [product_name, region_type, units_sold]);
        const [updatedSales] = await pool.query('SELECT product_name, region_type, SUM(units_sold) as total_sold FROM sales GROUP BY product_name, region_type');
        const [updatedTrends] = await pool.query(`
            SELECT product_name, region_type, DATE(sale_date) as sale_date, SUM(units_sold) as total_sold 
            FROM sales 
            GROUP BY product_name, region_type, DATE(sale_date)
            ORDER BY sale_date
        `);
        const [updatedInventory] = await pool.query(`
            SELECT product_name, region_type, 
                   AVG(units_sold) * 7 + (AVG(units_sold) * 0.2) as inventory_requirement
            FROM sales
            WHERE sale_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY product_name, region_type
        `);
        io.emit('salesUpdate', updatedSales);
        io.emit('trendsUpdate', updatedTrends);
        io.emit('inventoryUpdate', updatedInventory.map(row => ({
            product_name: row.product_name,
            region_type: row.region_type,
            inventory_requirement: Math.round(row.inventory_requirement)
        })));
        res.status(201).json({ message: 'Sale added' });
    } catch (error) {
        console.error('Error adding sale:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = 2000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));