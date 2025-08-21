require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Worker } = require('bullmq');
const redis = require('./config/redis');
const mongoose = require('mongoose');
const File = require('./models/File');
const parseLib = require('./utils/parse');

// Mongo connect for worker
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, { dbName: undefined })
  .then(() => console.log('✅ [Worker] MongoDB connected'))
  .catch(err => { console.error('❌ [Worker] MongoDB error', err); process.exit(1); });

const worker = new Worker('parse', async job => {
  const { id } = job.data;
  const file = await File.findById(id);
  if (!file) throw new Error('File not found');

  // Mark processing
  await redis.hset(`upload:${id}`, { status: 'processing', progress: 95 });
  await File.updateOne({ _id: id }, { status: 'processing', progress: 95 });

  try {
    const parsed = await parseLib.parseFile(file.path, file.mimeType);
    await File.updateOne({ _id: id }, { parsed, status: 'ready', progress: 100, error: null });
    await redis.hset(`upload:${id}`, { status: 'ready', progress: 100 });
    await redis.publish(`upload:${id}:events`, JSON.stringify({ status: 'ready', progress: 100 }));
  } catch (err) {
    console.error('[Worker] parse error', err);
    await File.updateOne({ _id: id }, { status: 'failed', error: String(err), progress: 100 });
    await redis.hset(`upload:${id}`, { status: 'failed', progress: 100, error: String(err) });
    await redis.publish(`upload:${id}:events`, JSON.stringify({ status: 'failed', progress: 100 }));
  }
}, { connection: redis });

worker.on('completed', job => console.log(`✅ [Worker] Job completed ${job.id}`));
worker.on('failed', (job, err) => console.error(`❌ [Worker] Job failed ${job?.id}`, err));
