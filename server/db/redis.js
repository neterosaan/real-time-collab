const { createClient } = require('redis');

let redisClient

async function connectToRedis() {

    if (redisClient) {
    return; // Already connected
  }
 redisClient = createClient({
    url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
  });
  redisClient.on('error', (err) => console.error('❌ Redis Client Error', err));
  redisClient.on('connect', () => console.log('✅ Redis client is connecting...'));
  redisClient.on('ready', () => console.log('🚀 Redis client is ready!'));
  redisClient.on('end', () => console.log('Redis client connection ended.'));
  try {
    await redisClient.connect();
    console.log('✅ Successfully connected to Redis.');
    return redisClient;
  } catch (error) {
    console.error('❌ Could not connect to Redis:', error);
    process.exit(1);
  }
}

function getRedisClient() {
  if (!redisClient || !redisClient.isOpen) {
    throw new Error('Redis client is not connected or ready.');
  }
  return redisClient;
}

module.exports = { connectToRedis, getRedisClient };