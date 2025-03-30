const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/auth/google
// @desc    Auth with Google
// @access  Public
router.get('/google', (req, res, next) => {
  console.log('Google OAuth flow initiated');
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account'
  })(req, res, next);
});

// @route   GET /api/auth/google/callback
// @desc    Google auth callback
// @access  Public
router.get(
  '/google/callback',
  (req, res, next) => {
    console.log('Google OAuth callback received');
    passport.authenticate('google', { 
      session: false,
      failureRedirect: `${process.env.FRONTEND_URL}?auth_error=true` 
    })(req, res, next);
  },
  (req, res) => {
    try {
      console.log('Creating JWT token for user:', req.user.id);
      // Create JWT
      const token = jwt.sign(
        { id: req.user.id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Return token and user info
      res.redirect(`${process.env.FRONTEND_URL}/auth/success?token=${token}`);
    } catch (error) {
      console.error('Error in Google callback:', error);
      res.redirect(`${process.env.FRONTEND_URL}?auth_error=true`);
    }
  }
);

// @route   GET /api/auth/me
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

// @route   GET /api/auth/check-config
// @desc    Check OAuth configuration
// @access  Public
router.get('/check-config', (req, res) => {
  const config = {
    clientID: process.env.GOOGLE_CLIENT_ID ? 
      `${process.env.GOOGLE_CLIENT_ID.substring(0, 8)}...` : 'Not configured',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'Not configured',
    frontendURL: process.env.FRONTEND_URL || 'Not configured'
  };
  
  res.json({
    status: 'Config check',
    message: 'If you can see this, your server is running correctly',
    config,
    serverTime: new Date().toISOString()
  });
});

module.exports = router; 