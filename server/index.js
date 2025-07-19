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

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

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
  res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:5173');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
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
