// This is the final, correct version.
const app = require('./app')
// 1. CHANGE HERE: We only need to import the pool to initialize it.
require('./db/mysql'); 
const mongoose = require('mongoose');
const { createClient } = require('redis');

const PORT = process.env.PORT || 4000;

// --- Database Connections ---


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


// --- Start Server ---
async function startServer() {
  await connectToMongoDB();
  await connectToRedis();

  app.listen(PORT, () => {
    console.log(`🚀 Server is  runndeing on http://localhost:${PORT}`);
  });
}

startServer();