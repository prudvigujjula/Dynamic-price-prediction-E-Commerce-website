const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const multer = require('multer');
const path = require('path');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads')); // Serve images
app.use(express.static(path.join(__dirname, '../frontend')));

const otpStorage = {}; // Temporary storage for OTPs

// MySQL Connection
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Hari@143', // Update with your MySQL password
    database: 'mystore',
});

// Initialize Database
async function initializeDatabase() {
    const connection = await pool.getConnection();
    await connection.query(`
        CREATE DATABASE IF NOT EXISTS mystore;
    `);
    await connection.query(`
        USE mystore;
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            type VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            stock INT NOT NULL,
            image VARCHAR(255) NOT NULL
        );
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firstName VARCHAR(255) NOT NULL,
            lastName VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS addresses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            details TEXT NOT NULL,
            FOREIGN KEY (userId) REFERENCES users(id)
        );
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS admin (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS delivery_costs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            region VARCHAR(255) NOT NULL,
            distance_km DECIMAL(10,2) NOT NULL,
            weight_kg DECIMAL(10,2) NOT NULL,
            base_price DECIMAL(10,2) NOT NULL,
            total_cost DECIMAL(10,2) NOT NULL
        );
    `);
    await connection.query(`
        CREATE TABLE IF NOT EXISTS sales_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            city VARCHAR(255) NOT NULL,
            state VARCHAR(255) NOT NULL,
            latitude DECIMAL(9,6) NOT NULL,
            longitude DECIMAL(9,6) NOT NULL,
            revenue DECIMAL(10,2) NOT NULL
        );
    `);

    // Insert sample products
    const [products] = await connection.query('SELECT COUNT(*) as count FROM products');
    if (products[0].count === 0) {
        await connection.query(`
            INSERT INTO products (name, type, category, price, stock, image) VALUES
            ('Shirts', 'Clothing', 'Men', 5000.00, 100, 'default.jpg'),
            ('Cricket Bat', 'Sports', 'Equipment', 3000.00, 50, 'default.jpg'),
            ('Shoes', 'Footwear', 'Men', 3000.00, 80, 'default.jpg'),
            ('Maggie', 'Food', 'Snacks', 200.00, 200, 'default.jpg'),
            ('Watches', 'Accessories', 'Men', 5000.00, 60, 'default.jpg'),
            ('Mobiles', 'Electronics', 'Smartphones', 30000.00, 30, 'default.jpg'),
            ('Jim Jam', 'Food', 'Snacks', 100.00, 150, 'default.jpg'),
            ('Earpods', 'Electronics', 'Audio', 2000.00, 70, 'default.jpg');
        `);
    }

    // Insert a sample user
    const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
    if (users[0].count === 0) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await connection.query(`
            INSERT INTO users (firstName, lastName, email, password) VALUES
            ('John', 'Doe', 'john.doe@example.com', ?);
        `, [hashedPassword]);
    }

    // Insert a sample admin
    const [admins] = await connection.query('SELECT COUNT(*) as count FROM admin');
    if (admins[0].count === 0) {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await connection.query(`
            INSERT INTO admin (email, password) VALUES
            ('admin@example.com', ?);
        `, [hashedPassword]);
    }

    connection.release();
}

initializeDatabase();

// User Registration
app.post("/register", async (req, res) => {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    const [existingUsers] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUsers.length > 0) {
        return res.status(400).json({ message: "User already exists" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query(
            "INSERT INTO users (email, password, firstname, lastname) VALUES (?, ?, ?, ?)",
            [email, hashedPassword, firstname, lastname]
        );
        res.json({ success: true, message: "User registered successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error during registration" });
    }
});

// User Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET || 'SECRET_KEY',
        { expiresIn: '1h' }
    );

    res.json({
        success: true,
        token,
        user: { id: user.id, firstName: user.firstname, lastName: user.lastname, email: user.email },
        redirect: '/home.html'
    });
});

// Admin Login
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    const [admins] = await pool.query("SELECT * FROM admin WHERE email = ?", [email]);
    if (admins.length === 0) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { userId: admin.id, email: admin.email },
        process.env.JWT_SECRET || 'SECRET_KEY',
        { expiresIn: '1h' }
    );

    res.json({ success: true, token, redirect: '/home.html' });
});

// Forgot Password (Send OTP)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}. It is valid for 10 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent to ${email}: ${otp}`);
        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// Verify OTP
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    if (otpStorage[email] && otpStorage[email] == otp) {
        delete otpStorage[email];
        res.json({ success: true, message: 'OTP Verified' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// Reset Password
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email]);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password' });
    }
});

// Admin Forgot Password
app.post('/admin/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp;

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password Reset OTP",
        text: `Your OTP is ${otp}. It is valid for 10 minutes.`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`✅ OTP sent to ${email}: ${otp}`);
        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        res.status(500).json({ message: 'Failed to send OTP' });
    }
});

// Admin Verify OTP
app.post('/admin/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    if (otpStorage[email] && otpStorage[email] == otp) {
        delete otpStorage[email];
        res.json({ success: true, message: 'OTP Verified' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// Admin Reset Password
app.post('/admin/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await pool.query("UPDATE admin SET password = ? WHERE email = ?", [hashedPassword, email]);
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting password' });
    }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Fetch User Profile
app.get('/api/user', verifyToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const [users] = await pool.query("SELECT id, firstname, lastname, email FROM users WHERE id = ?", [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(users[0]);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user data' });
    }
});

// Fetch Products for Today's Deals
app.get('/api/products', async (req, res) => {
    try {
        const [products] = await pool.query("SELECT * FROM products");
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Addresses for a User
app.get('/api/addresses', verifyToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const [addresses] = await pool.query("SELECT * FROM addresses WHERE userId = ?", [userId]);
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Save Address for a User
app.post('/api/addresses', verifyToken, async (req, res) => {
    const userId = req.user.userId;
    const { name, details } = req.body;

    if (!name || !details) {
        return res.status(400).json({ message: 'Name and details are required' });
    }

    try {
        const [result] = await pool.query(
            "INSERT INTO addresses (userId, name, details) VALUES (?, ?, ?)",
            [userId, name, details]
        );
        res.status(201).json({ id: result.insertId, userId, name, details });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// GET: Fetch a Single Product by ID
app.get('/product/:id', async (req, res) => {
    try {
        const [product] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
        if (product.length === 0) return res.status(404).json({ message: "Product not found" });
        res.json(product[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: Add New Product
app.post('/add', upload.single('image'), async (req, res) => {
    const { name, type, category, price, stock } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';

    try {
        const [result] = await pool.query(
            "INSERT INTO products (name, type, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)",
            [name, type, category, price, stock, image]
        );
        res.json({ message: "Product added successfully", productId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT: Update Product
app.put('/update/:id', upload.single('image'), async (req, res) => {
    const { name, type, category, price, stock } = req.body;
    let sql = "UPDATE products SET name = ?, type = ?, category = ?, price = ?, stock = ?";
    const values = [name, type, category, price, stock];

    if (req.file) {
        sql += ", image = ?";
        values.push(req.file.filename);
    }
    sql += " WHERE id = ?";
    values.push(req.params.id);

    try {
        await pool.query(sql, values);
        res.json({ message: "Product updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Remove Product
app.delete('/delete/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
        res.json({ message: "Product deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Sales Data
app.get('/sales', async (req, res) => {
    try {
        const [results] = await pool.query('SELECT city, state, latitude, longitude, revenue FROM sales_data');
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Calculate Delivery Cost
app.post('/calculate', async (req, res) => {
    const { region, distance_km, weight_kg } = req.body;
    const base_price = 20;
    const total_cost = base_price + (distance_km * 0.5) + (weight_kg * 1.5);

    try {
        const [result] = await pool.query(
            "INSERT INTO delivery_costs (region, distance_km, weight_kg, base_price, total_cost) VALUES (?, ?, ?, ?, ?)",
            [region, distance_km, weight_kg, base_price, total_cost]
        );
        res.json({ success: true, total_cost });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Delivery Cost Records
app.get('/data', async (req, res) => {
    try {
        const [results] = await pool.query("SELECT * FROM delivery_costs");
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Fetch Summary Stats
app.get('/summary', async (req, res) => {
    try {
        const [results] = await pool.query(`
            SELECT region, AVG(total_cost) AS avg_cost, 
            MAX(total_cost) AS max_cost, MIN(total_cost) AS min_cost 
            FROM delivery_costs GROUP BY region
        `);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));