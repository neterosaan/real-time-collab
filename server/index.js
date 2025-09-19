// This is the final, correct version.
const express = require('express');
const mysql = require('mysql2/promise');
const mongoose = require('mongoose');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 4000;

// --- Database Connections ---

async function connectToMySQL() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: 'root', // Connect as the root user
      password: process.env.MYSQL_ROOT_PASSWORD, // Use the root password variable
      database: process.env.MYSQL_DATABASE,
    });
    console.log('✅ Successfully connected to MySQL.');
    return connection;
  } catch (error) {
    console.error('❌ Could not connect to MySQL:', error);
    process.exit(1);
  }
}

async function connectToMongoDB() {
  const mongoURI = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DATABASE}?authSource=admin`;
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ Successfully connected to MongoDB.');
  } catch (error) {
    console.error('❌ Could not connect to MongoDB:', error);
    process.exit(1);
  }
}

async function connectToRedis() {
  const redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
  });
  redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));
  try {
    await redisClient.connect();
    console.log('✅ Successfully connected to Redis.');
    return redisClient;
  } catch (error) {
    console.error('❌ Could not connect to Redis:', error);
    process.exit(1);
  }
}


// --- API Endpoints ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});


// --- Start Server ---
async function startServer() {
  await connectToMySQL();
  await connectToMongoDB();
  await connectToRedis();

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
  });
}

startServer();