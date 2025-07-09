const request = require('supertest');
const app = require('../app'); // ✅ Ensure this path correctly points to app.js
const db = require('../db'); // Adjust this to your actual database file path

// Clear test database before each test
beforeEach((done) => {
    db.query('DELETE FROM users', done);
});

describe('POST /register', () => {
    it('should register a new user', async () => {
        const response = await request(app)
            .post('/register')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
        
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('message', 'User registered successfully');
    });

    it('should not register a user with missing fields', async () => {
        const response = await request(app)
            .post('/register')
            .send({ email: 'test@example.com' });
        
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('message', 'All fields are required');
    });

    it('should not register a user with an existing email', async () => {
        await request(app)
            .post('/register')
            .send({ email: 'test@example.com', password: 'password123' });

        const response = await request(app)
            .post('/register')
            .send({ email: 'test@example.com', password: 'password456' });
        
        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('message', 'User already exists');
    });
});
