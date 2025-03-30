const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Content = require('../models/Content');
const mongoose = require('mongoose');
const { getConnectionStats } = require('../utils/dbHelpers');

// @route   GET /api/users/dashboard
// @desc    Get user dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get user with subscription data
    const user = await User.findById(req.user.id).select('-__v');
    
    // Get user's content count
    const contentCount = await Content.countDocuments({ user: req.user.id });
    
    // Get recent content (limit to 5)
    const recentContent = await Content.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);

    // Calculate usage percentage
    const usagePercentage = user.usageLimit > 0 
      ? Math.round((user.usageCount / user.usageLimit) * 100) 
      : 0;

    // Calculate subscription status
    let subscriptionStatus = {
      currentPlan: user.subscription.status,
      isActive: true,
      daysRemaining: null
    };

    // If user has a subscription with an end date
    if (user.subscription.endDate) {
      const today = new Date();
      const endDate = new Date(user.subscription.endDate);
      
      // Check if subscription is active
      subscriptionStatus.isActive = endDate > today;
      
      // Calculate days remaining
      if (subscriptionStatus.isActive) {
        const diffTime = Math.abs(endDate - today);
        subscriptionStatus.daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    // Return dashboard data
    res.json({
      user: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        subscription: subscriptionStatus,
        usageCount: user.usageCount,
        usageLimit: user.usageLimit,
        usagePercentage
      },
      contentStats: {
        total: contentCount,
        recent: recentContent
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-__v');
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/users/db-status
// @desc    Get database connection status
// @access  Private (Admin only)
router.get('/db-status', auth, async (req, res) => {
  try {
    // Check if user is admin (you should implement a proper admin check)
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Get connection stats
    const stats = getConnectionStats();
    
    // Add mongoose version for reference
    stats.mongooseVersion = mongoose.version;
    
    // Add connection state information
    const stateMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
      99: 'uninitialized'
    };
    stats.state = stateMap[mongoose.connection.readyState] || 'unknown';
    
    res.json({
      success: true,
      database: stats
    });
  } catch (err) {
    console.error('Error checking DB status:', err.message);
    res.status(500).json({
      success: false,
      error: 'Server Error',
      message: err.message
    });
  }
});

module.exports = router; 