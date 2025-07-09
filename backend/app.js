const express = require('express');
const db = require('./db'); // Ensure correct relative path
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Register Route (Example)
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (results.length > 0) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword], (err) => {
            if (err) {
                return res.status(500).json({ message: 'Database error' });
            }
            res.status(201).json({ message: 'User registered successfully' });
        });
    });
});

module.exports = app;
