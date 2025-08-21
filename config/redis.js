const IORedis = require('ioredis');
const url = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(url);
module.exports = redis;
