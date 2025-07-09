const bcrypt = require('bcryptjs');
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    port: '3306',
    password: 'Hari@143',
    database: 'ecommerce_db'
});

db.connect(async (err) => {
    if (err) throw err;
    console.log('✅ Connected to MySQL');

    const plainPassword = 'dfghj';  // The password you want to hash
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const updateQuery = "UPDATE admin SET password = ? WHERE email = 'gujjulahari9@gmail.com' ";
    db.query(updateQuery, [hashedPassword], (err, result) => {
        if (err) throw err;
        console.log('✅ Password updated successfully');
        db.end();
    });
});