const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if no token
    if (!token) {
      console.log('Authentication failed: No token provided');
      return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Set user from payload
      const user = await User.findById(decoded.id);
      
      if (!user) {
        console.log(`Authentication failed: User not found for ID ${decoded.id}`);
        return res.status(401).json({ msg: 'User not found' });
      }
      
      req.user = user;
      next();
    } catch (tokenError) {
      console.log('Token verification failed:', tokenError.message);
      return res.status(401).json({ msg: 'Token is not valid', error: tokenError.message });
    }
  } catch (err) {
    console.error('Authentication middleware error:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
};

const checkSubscription = async (req, res, next) => {
  try {
    // Check if user exists
    if (!req.user) {
      console.log('Subscription check failed: User not authenticated');
      return res.status(401).json({ msg: 'User not authenticated' });
    }

    // Check usage limits for free tier
    if (req.user.subscription.status === 'free' && req.user.usageCount >= req.user.usageLimit) {
      console.log(`Usage limit reached for user ${req.user.id}: ${req.user.usageCount}/${req.user.usageLimit}`);
      return res.status(403).json({ 
        msg: 'Free tier usage limit reached. Please upgrade your subscription.',
        limitReached: true
      });
    }

    // Check subscription expiration for paid tiers
    if (
      ['basic', 'premium'].includes(req.user.subscription.status) && 
      req.user.subscription.endDate && 
      new Date(req.user.subscription.endDate) < new Date()
    ) {
      console.log(`Subscription expired for user ${req.user.id}, downgrading to free tier`);
      // Update user subscription status to free if subscription expired
      await User.findByIdAndUpdate(req.user._id, {
        'subscription.status': 'free'
      });
      
      return res.status(403).json({ 
        msg: 'Your subscription has expired. Please renew.',
        subscriptionExpired: true
      });
    }

    next();
  } catch (err) {
    console.error('Subscription check middleware error:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
};

module.exports = { auth, checkSubscription }; 