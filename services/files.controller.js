const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');
const { v4: uuidv4 } = require('uuid');
const File = require('../models/File');
const redis = require('../config/redis');
const parseQueue = require('../queue/queue');

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

exports.upload = async (req, res) => {
  const contentLength = Number(req.headers['content-length'] || 0) || 0;
  const uploadId = uuidv4();
  const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
  const savePath = path.join(uploadDir, uploadId);

  // Prepare redis progress
  await redis.hset(`upload:${uploadId}`, { status: 'uploading', progress: 0, bytesReceived: 0, contentLength });
  await redis.expire(`upload:${uploadId}`, 60 * 60 * 6); // 6 hours TTL

  const bb = Busboy({ headers: req.headers });
  let fileMeta = { filename: null, mimeType: 'application/octet-stream', size: 0 };

  bb.on('file', (name, file, info) => {
    const { filename, mimeType } = info;
    fileMeta.filename = filename;
    fileMeta.mimeType = mimeType;
    const out = fs.createWriteStream(savePath);
    file.on('data', async data => {
      fileMeta.size += data.length;
      // Update progress estimation (cap at 90 during upload)
      const rawPct = contentLength ? (fileMeta.size / contentLength) * 90 : 0;
      const pct = clamp(Math.floor(rawPct), 0, 90);
      await redis.hset(`upload:${uploadId}`, { bytesReceived: fileMeta.size, progress: pct });
    });
    file.pipe(out);
    out.on('close', async () => {
      // Create DB record now that file is saved
      await File.create({
        _id: uploadId,
        originalName: fileMeta.filename || 'unknown',
        mimeType: fileMeta.mimeType,
        size: fileMeta.size,
        path: savePath,
        status: 'processing',
        progress: 95
      });
      await redis.hset(`upload:${uploadId}`, { status: 'processing', progress: 95 });
      await redis.publish(`upload:${uploadId}:events`, JSON.stringify({ status: 'processing', progress: 95 }));
      // Enqueue parsing
      await parseQueue.add('parse-file', { id: uploadId }, { attempts: 2, backoff: { type: 'exponential', delay: 2000 } });
    });
  });

  bb.on('finish', () => {
    res.status(202).json({
      file_id: uploadId,
      status: 'processing',
      message: 'Upload received. Parsing has started.'
    });
  });

  req.pipe(bb);
};

exports.progress = async (req, res) => {
  const { id } = req.params;
  const key = `upload:${id}`;
  const data = await redis.hgetall(key);
  if (Object.keys(data).length) {
    const progress = Number(data.progress || 0);
    const status = data.status || 'uploading';
    return res.json({ file_id: id, status, progress });
  }
  // Fall back to DB (ready/failed)
  const doc = await File.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  return res.json({ file_id: id, status: doc.status, progress: doc.progress });
};

exports.progressStream = async (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let active = true;
  const send = async () => {
    const data = await redis.hgetall(`upload:${id}`);
    if (Object.keys(data).length) {
      res.write(`data: ${JSON.stringify({ file_id: id, status: data.status, progress: Number(data.progress||0) })}\n\n`);
      if (data.status === 'ready' || data.status === 'failed') { active = false; res.end(); }
    } else {
      // Fallback check DB
      const doc = await File.findById(id).lean();
      if (doc) {
        res.write(`data: ${JSON.stringify({ file_id: id, status: doc.status, progress: doc.progress })}\n\n`);
        if (doc.status === 'ready' || doc.status === 'failed') { active = false; res.end(); }
      }
    }
  };

  // Poll every 750ms
  const interval = setInterval(() => { if (active) send(); }, 750);
  req.on('close', () => { active = false; clearInterval(interval); });
};

exports.getFile = async (req, res) => {
  const { id } = req.params;
  const doc = await File.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (doc.status !== 'ready') {
    return res.status(202).json({ message: 'File upload or processing in progress. Please try again later.' });
  }
  res.json({ file_id: id, filename: doc.originalName, mimeType: doc.mimeType, parsed: doc.parsed });
};

exports.listFiles = async (req, res) => {
  const docs = await File.find({}, { parsed: 0 }).sort({ createdAt: -1 }).lean();
  const mapped = docs.map(d => ({
    id: d._id, filename: d.originalName, status: d.status, created_at: d.createdAt, size: d.size, mimeType: d.mimeType, progress: d.progress
  }));
  res.json(mapped);
};

exports.deleteFile = async (req, res) => {
  const { id } = req.params;
  const doc = await File.findById(id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  // remove file from disk
  try { fs.unlinkSync(doc.path); } catch (e) {}
  await doc.deleteOne();
  await redis.del(`upload:${id}`);
  res.json({ message: 'Deleted', file_id: id });
};
