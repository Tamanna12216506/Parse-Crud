require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

// Ensure upload dir exists
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// DB connect
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGODB_URI, { dbName: undefined })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error', err);
    process.exit(1);
  });

// Routes
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');

app.use('/auth', authRoutes);
app.use('/files', fileRoutes);

// Health
app.get('/', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`🚀 API listening on http://localhost:${port}`));
