const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || '3306',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || 'Hari@143',
  database: process.env.DB_NAME || 'ecommerce_db'
});

db.connect(err => {
  if (err) {
    console.error('❌ Database Connection Failed:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL Database');
});

module.exports = db;
