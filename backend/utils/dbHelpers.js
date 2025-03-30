const mongoose = require('mongoose');

/**
 * Database helper utilities
 * Functions to help with MongoDB connection management
 */

/**
 * Check if the MongoDB connection is established and ready
 * @returns {boolean} Connection status
 */
const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Retry connection with exponential backoff
 * @param {Function} connectFn - Function to establish connection
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} initialDelay - Initial delay in milliseconds
 * @returns {Promise<boolean>} Success status
 */
const retryConnection = async (connectFn, maxRetries = 5, initialDelay = 1000) => {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries < maxRetries) {
    try {
      await connectFn();
      console.log(`Connection established after ${retries} retries`);
      return true;
    } catch (error) {
      retries++;
      console.error(`Connection attempt ${retries} failed: ${error.message}`);
      
      if (retries >= maxRetries) {
        console.error('Maximum retries reached. Connection failed.');
        return false;
      }
      
      // Exponential backoff
      delay *= 2;
      console.log(`Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return false;
};

/**
 * Get connection statistics
 * @returns {Object} Connection statistics
 */
const getConnectionStats = () => {
  if (!isConnected()) {
    return { status: 'disconnected' };
  }
  
  return {
    status: 'connected',
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    collections: mongoose.connection.collections ? 
      Object.keys(mongoose.connection.collections).length : 0,
    models: Object.keys(mongoose.models).length
  };
};

module.exports = {
  isConnected,
  retryConnection,
  getConnectionStats
}; 