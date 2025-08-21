const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  _id: { type: String },                  // uuid
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, default: 0 },
  path: { type: String, required: true },
  status: { type: String, enum: ['uploading', 'processing', 'ready', 'failed'], default: 'uploading' },
  progress: { type: Number, default: 0 }, // 0-100
  parsed: { type: mongoose.Schema.Types.Mixed, default: null },
  error: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('File', FileSchema);
