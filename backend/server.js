const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const passport = require('passport');
const bodyParser = require('body-parser');
const connectDB = require('./config/database');

// Load environment variables
dotenv.config();
console.log('Environment loaded, MongoDB URI:', process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 20)}...` : 'Not set');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const contentRoutes = require('./routes/content');
const paymentRoutes = require('./routes/payment');

// Passport config
require('./config/passport');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', process.env.FRONTEND_URL].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-auth-token', 'Authorization'],
  exposedHeaders: ['x-auth-token']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(bodyParser.json({ limit: '50mb' })); // For parsing JSON data
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    server: 'AI Content Generator API',
    version: '1.0.0',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Connect to MongoDB
console.log('Attempting to connect to MongoDB...');
connectDB()
  .then((connection) => {
    if (connection) {
      console.log('Database connection established successfully');
      startServer();
    } else {
      console.error('Failed to establish database connection');
      // Start server anyway, but mark database as disconnected
      startServer();
    }
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    console.error('Application may not function correctly without database connection');
    // Start server anyway, but mark database as disconnected
    startServer();
  });

// Function to start the server
function startServer() {
  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/content', contentRoutes);
  app.use('/api/payments', paymentRoutes);

  // Root route
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Welcome to AI Content Generator API',
      version: '1.0.0',
      dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      features: [
        'Google OAuth Authentication',
        'Content Generation with Google Gemini',
        'Subscription Management'
      ]
    });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
      error: 'Server error', 
      message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
    });
  });

  // Start the server
  app.listen(PORT, () => {
    console.log(`\n===== AI CONTENT GENERATOR API =====`);
    console.log(`Server running on port ${PORT}`);
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`API URL: http://localhost:${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'Not configured'}`);
    console.log(`Auth Endpoint: http://localhost:${PORT}/api/auth/google`);
    console.log(`Auth Callback: ${process.env.GOOGLE_CALLBACK_URL || 'Not configured'}`);
    console.log(`MongoDB Status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not connected'}`);
    console.log(`Config Check: http://localhost:${PORT}/api/auth/check-config`);
    console.log(`=====================================\n`);
  });
} 