const { Queue } = require('bullmq');
const redis = require('../config/redis');

const parseQueue = new Queue('parse', { connection: redis });

module.exports = parseQueue;
