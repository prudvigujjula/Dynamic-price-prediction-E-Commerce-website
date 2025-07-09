const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');  // Database connection file
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

const otpStorage = {};  // Temporary storage for OTPs

// --------------------------
// 🚀 1️⃣ User Registration
// --------------------------
app.post("/register", async (req, res) => {
    const { firstname, lastname, email, password } = req.body;

    if (!firstname || !lastname || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            db.query(
                "INSERT INTO users (email, password, firstname, lastname) VALUES (?, ?, ?, ?)",
                [email, hashedPassword, firstname, lastname],
                (err, result) => {
                    if (err) return res.status(500).json({ message: "Registration error" });

                    res.json({ success: true, message: "User registered successfully" });
                }
            );
        } catch (error) {
            res.status(500).json({ message: "Error hashing password" });
        }
    });
});

// --------------------------
// 🚀 2️⃣ User Login
// --------------------------
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'SECRET_KEY',
            { expiresIn: '1h' }
        );

        res.json({ success: true, token, user: { id: user.id, firstName: user.firstname, lastName: user.lastname, email: user.email } });
    });
});

// --------------------------
// Admin Login
// --------------------------
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    db.query("SELECT * FROM admin WHERE email = ?", [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id, email: user.email },
            process.env.JWT_SECRET || 'SECRET_KEY',
            { expiresIn: '1h' }
        );

        res.json({ success: true, token, redirect: '/home.html' });
    });
});

// --------------------------
// 🚀 3️⃣ Forgot Password (Send OTP)
// --------------------------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your Gmail
        pass: process.env.EMAIL_PASS  // Your Gmail App Password
    }
});

app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp; // Save OTP temporarily

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

// --------------------------
// 🚀 4️⃣ Verify OTP
// --------------------------
app.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    console.log(`🔍 Checking OTP for ${email}: Sent OTP = ${otpStorage[email]}, User Entered = ${otp}`);

    if (otpStorage[email] && otpStorage[email] == otp) {
        delete otpStorage[email];  // ✅ Remove OTP after successful verification
        res.json({ success: true, message: 'OTP Verified' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// --------------------------
// 🚀 5️⃣ Reset Password
// --------------------------
app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query("UPDATE users SET password = ? WHERE email = ?", [hashedPassword, email], (err, result) => {
            if (err) return res.status(500).json({ message: 'Server error' });

            res.json({ success: true, message: 'Password updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Error hashing password' });
    }
});

// --------------------------
// Admin Forgot Password
// --------------------------
app.post('/admin/forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: 'Email is required' });

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStorage[email] = otp; // Save OTP temporarily

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

// --------------------------
// 🚀 Verify OTP (Admin)
// --------------------------
app.post('/admin/verify-otp', (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: 'Email and OTP are required' });
    }

    console.log(`🔍 Checking OTP for ${email}: Sent OTP = ${otpStorage[email]}, User Entered = ${otp}`);

    if (otpStorage[email] && otpStorage[email] == otp) {
        delete otpStorage[email];  // ✅ Remove OTP after successful verification
        res.json({ success: true, message: 'OTP Verified' });
    } else {
        res.status(400).json({ message: 'Invalid OTP' });
    }
});

// --------------------------
// 🚀 Reset Password (Admin)
// --------------------------
app.post('/admin/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.query("UPDATE admin SET password = ? WHERE email = ?", [hashedPassword, email], (err, result) => {
            if (err) return res.status(500).json({ message: 'Server error' });

            res.json({ success: true, message: 'Password updated successfully' });
        });
    } catch (error) {
        res.status(500).json({ message: 'Error hashing password' });
    }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1]; // Expecting "Bearer <token>"

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'SECRET_KEY');
        req.user = decoded; // Attach user info to request
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// 🚀 **Modified: Fetch User Profile**
// Highlighted Change: Added endpoint to fetch user details using JWT token
app.get('/api/user', verifyToken, (req, res) => {
    const userId = req.user.userId; // Get userId from JWT token

    db.query("SELECT id, firstname, lastname, email FROM users WHERE id = ?", [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(500).json({ message: 'Error fetching user data' });
        }
        res.json(results[0]);
    });
});

// 🚀 **Modified: Fetch Products for Today's Deals**
// Highlighted Change: Renamed and adjusted endpoint to match homepage fetch
app.get('/api/products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// 🚀 **Modified: Fetch Addresses for a User**
// Highlighted Change: Added endpoint to fetch addresses for the logged-in user
app.get('/api/addresses', verifyToken, (req, res) => {
    const userId = req.user.userId; // Get userId from JWT token

    db.query("SELECT * FROM addresses WHERE userId = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err });
        res.json(results);
    });
});

// 🚀 **Modified: Save Address for a User**
// Highlighted Change: Adjusted endpoint to use JWT token for userId
app.post('/api/addresses', verifyToken, (req, res) => {
    const userId = req.user.userId; // Get userId from JWT token
    const { name, details } = req.body;

    if (!name || !details) {
        return res.status(400).json({ message: 'Name and details are required' });
    }

    db.query(
        "INSERT INTO addresses (userId, name, details) VALUES (?, ?, ?)",
        [userId, name, details],
        (err, result) => {
            if (err) return res.status(500).json({ error: err });
            res.status(201).json({ id: result.insertId, userId, name, details });
        }
    );
});

// Existing product-related endpoints
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

app.get('/product/:id', (req, res) => {
    const sql = "SELECT * FROM products WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        if (result.length === 0) return res.status(404).json({ message: "Product not found" });
        res.json(result[0]);
    });
});

app.post('/add', upload.single('image'), (req, res) => {
    const { name, type, category, price, stock } = req.body;
    const image = req.file ? req.file.filename : 'default.jpg';

    const sql = "INSERT INTO products (name, type, category, price, stock, image) VALUES (?, ?, ?, ?, ?, ?)";
    const values = [name, type, category, price, stock, image];

    db.query(sql, values, (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: "Product added successfully", productId: result.insertId });
    });
});

app.put('/update/:id', upload.single('image'), (req, res) => {
    const { name, type, category, price, stock } = req.body;
    let sql = "UPDATE products SET name=?, type=?, category=?, price=?, stock=?";
    const values = [name, type, category, price, stock];

    if (req.file) {
        sql += ", image=?";
        values.push(req.file.filename);
    }
    sql += " WHERE id=?";
    values.push(req.params.id);

    db.query(sql, values, (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: "Product updated successfully" });
    });
});

app.delete('/delete/:id', (req, res) => {
    const sql = "DELETE FROM products WHERE id = ?";
    db.query(sql, [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ error: err });
        res.json({ message: "Product deleted successfully" });
    });
});

app.get('/sales', (req, res) => {
    const query = 'SELECT city, state, latitude, longitude, revenue FROM sales_data';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(results);
        }
    });
});

app.post('/calculate', (req, res) => {
    const { region, distance_km, weight_kg } = req.body;
    const base_price = 20;  // Fixed base price
    const total_cost = base_price + (distance_km * 0.5) + (weight_kg * 1.5);

    const sql = "INSERT INTO delivery_costs (region, distance_km, weight_kg, base_price, total_cost) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [region, distance_km, weight_kg, base_price, total_cost], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, total_cost });
    });
});

app.get('/data', (req, res) => {
    db.query("SELECT * FROM delivery_costs", (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.get('/summary', (req, res) => {
    const sql = `
        SELECT region, AVG(total_cost) AS avg_cost, 
        MAX(total_cost) AS max_cost, MIN(total_cost) AS min_cost 
        FROM delivery_costs GROUP BY region
    `;
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

app.get('/user/products', (req, res) => {
    const { name, category, minPrice, maxPrice } = req.query;

    const minPriceNum = minPrice ? parseFloat(minPrice) : 0;
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER;

    let sql = `
        SELECT p.name, p.price, p.company, c.name AS category, 
               AVG(p.price) OVER (PARTITION BY p.category_id) AS avg_price
        FROM userproducts p
        JOIN categories c ON p.category_id = c.id
    `;

    const filters = [];
    if (name) filters.push(`p.name LIKE '%${name}%'`);
    if (category) filters.push(`c.name = '${category}'`);
    if (minPrice) filters.push(`p.price >= ${minPriceNum}`);
    if (maxPrice) filters.push(`p.price <= ${maxPriceNum}`);

    if (filters.length > 0) sql += ` WHERE ${filters.join(' AND ')}`;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Error fetching products:", err);
            res.status(500).send("Error fetching products");
            return;
        }
        res.json(results);
    });
});

app.get('/user/categories', (req, res) => {
    const sql = "SELECT name FROM categories";
    db.query(sql, (err, results) => {
        if (err) {
            console.error("Error fetching categories:", err);
            res.status(500).send("Error fetching categories");
            return;
        }
        res.json(results);
    });
});

// --------------------------
// 🚀 Start Server
// --------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));