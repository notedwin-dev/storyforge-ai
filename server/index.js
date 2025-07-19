const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

const uploadRoutes = require('./routes/upload');
const generateRoutes = require('./routes/generate');
const statusRoutes = require('./routes/status');
const exportRoutes = require('./routes/export');
const voiceRoutes = require('./routes/voice');
const authRoutes = require('./routes/auth');
const testAIRoutes = require('./routes/test-ai');
const storiesRoutes = require('./routes/stories');
const { setupWebSocket } = require('./services/websocket');
const { cleanupTempFiles } = require('./services/cleanup');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware with relaxed policies for development
app.use(helmet({
  crossOriginOpenerPolicy: { policy: "unsafe-none" },
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// More permissive CORS for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all localhost origins for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Allow specific origins
    const allowedOrigins = [
      process.env.CORS_ORIGIN || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173'
    ];

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/voices', voiceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/test-ai', testAIRoutes);
app.use('/api/stories', storiesRoutes);

// Serve static files for local storage (when not using S3)
app.use('/uploads', (req, res, next) => {
  // More permissive CORS headers for images
  const origin = req.headers.origin;
  if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  }
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}, express.static(path.join(__dirname, 'uploads')));

app.use('/demo', express.static(path.join(__dirname, 'public', 'demo')));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test image serving
app.get('/api/test-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(__dirname, 'uploads', 'storyboards', filename);
  
  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error('Error serving test image:', err);
      res.status(404).json({ error: 'Image not found', filename });
    }
  });
});

// Image proxy endpoint for CORS-safe image serving
app.get('/api/image/*', (req, res) => {
  const imagePath = req.params[0]; // Get the full path after /api/image/
  const fullPath = path.join(__dirname, 'uploads', imagePath);

  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  res.sendFile(fullPath, (err) => {
    if (err) {
      console.error('Error serving image:', err);
      res.status(404).json({ error: 'Image not found', path: imagePath });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'Maximum file size is 10MB'
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Cleanup cron job - runs every hour
cron.schedule('0 * * * *', () => {
  console.log('Running cleanup job...');
  cleanupTempFiles();
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 StoryForge AI Server running on port ${PORT}`);
  console.log(`📱 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
});

// Setup WebSocket for real-time updates
setupWebSocket(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
