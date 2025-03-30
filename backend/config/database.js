const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

/**
 * Connect to MongoDB database
 * This module handles establishing and managing the connection to MongoDB
 * with proper error handling and connection options.
 */

// MongoDB connection options - Updated to modern options
const options = {
  // Note: useNewUrlParser and useUnifiedTopology are no longer needed in mongoose 6+
  serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4, // Use IPv4, skip trying IPv6
  autoIndex: true, // Build indexes
  maxPoolSize: 10, // Maintain up to 10 socket connections
  minPoolSize: 2 // Minimum of 2 socket connections
};

// Check if MongoDB URI is configured
const checkConfig = () => {
  if (!process.env.MONGODB_URI) {
    console.error('\x1b[31m%s\x1b[0m', 'ERROR: MONGODB_URI environment variable is not set');
    console.error('Please set it in your .env file');
    return false;
  }
  return true;
};

// Establish the connection
const establishConnection = async () => {
  if (!checkConfig()) {
    throw new Error('MongoDB configuration is missing');
  }
  
  return mongoose.connect(process.env.MONGODB_URI, options);
};

// Connection function with retry logic
const connectDB = async () => {
  try {
    const conn = await establishConnection();
    
    console.log('\x1b[32m%s\x1b[0m', `MongoDB Connected: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('\x1b[32m%s\x1b[0m', 'Mongoose connected to MongoDB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('\x1b[31m%s\x1b[0m', `Mongoose connection error: ${err}`);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('\x1b[33m%s\x1b[0m', 'Mongoose disconnected from MongoDB');
    });
    
    // If Node process ends, close the connection
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('\x1b[33m%s\x1b[0m', 'Mongoose connection closed due to app termination');
      process.exit(0);
    });
    
    return conn;
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `MongoDB connection error: ${error.message}`);
    
    // Implement retry logic
    console.log('Attempting to reconnect...');
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
      try {
        retryCount++;
        console.log(`Retry attempt ${retryCount}/${maxRetries}`);
        
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const conn = await establishConnection();
        console.log('\x1b[32m%s\x1b[0m', `MongoDB Connected after ${retryCount} retries`);
        return conn;
      } catch (retryError) {
        console.error('\x1b[31m%s\x1b[0m', `Retry ${retryCount} failed: ${retryError.message}`);
        
        if (retryCount >= maxRetries) {
          console.error('\x1b[31m%s\x1b[0m', 'Maximum retries reached. Exiting...');
          // Instead of exiting, return null and let the application decide what to do
          return null;
        }
      }
    }
  }
};

module.exports = connectDB; 