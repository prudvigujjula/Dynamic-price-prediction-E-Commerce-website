const express = require('express');
const { WebSocketServer } = require('ws');
const mysql = require('mysql2/promise');

const app = express();
const server = app.listen(3000, () => console.log('Server running on port 3000'));
const wss = new WebSocketServer({ server });

const db = mysql.createPool({
    host: '127.0.0.1',
    user: 'root', // Replace with your MySQL username
    password: 'Hari@143', // Replace with your MySQL password
    database: 'ecommerce_db',
    connectionLimit: 30
});

let geoPulse = { users: 0 };
let revenue = 0;
let influencers = [{ name: 'LocalStar', reach: 5000 }];

wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.send(JSON.stringify({ geoPulse, revenue, influencers }));

    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        if (data.type === 'priceUpdate') {
            revenue += parseInt(data.value);
            await db.query('INSERT INTO sales_log (price) VALUES (?)', [data.value]);
        } else if (data.type === 'autoPrice') {
            console.log(`Auto-pricing ${data.enabled ? 'enabled' : 'disabled'}`);
        } else if (data.type === 'contentUpload') {
            await db.query('INSERT INTO marketing_assets (name) VALUES (?)', [data.name]);
        } else if (data.type === 'exportInfluencers') {
            console.log('Exporting influencers:', influencers);
        }
        wss.clients.forEach(client => client.send(JSON.stringify({ geoPulse, revenue, influencers })));
    });
});

setInterval(async () => {
    geoPulse.users = (await db.query('SELECT COUNT(*) as count FROM customers'))[0][0].count || 0;
    revenue = (await db.query('SELECT SUM(price) as total FROM sales_log'))[0][0].total || 0;
    wss.clients.forEach(client => client.send(JSON.stringify({ geoPulse, revenue, influencers })));
}, 5000);