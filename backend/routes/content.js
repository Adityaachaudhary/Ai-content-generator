const express = require('express');
const router = express.Router();
const { auth, checkSubscription } = require('../middleware/auth');
const User = require('../models/User');
const Content = require('../models/Content');
const { generateContent, testGeminiAPIKey } = require('../utils/geminiApi');
const mongoose = require('mongoose');

// @route   GET /api/content/check-gemini-api
// @desc    Check if Gemini API key is working
// @access  Private (admin)
router.get('/check-gemini-api', auth, async (req, res) => {
  try {
    // Check if user is admin (you can implement your own admin check)
    if (!req.user.isAdmin && req.user.email !== 'admin@example.com') {
      return res.status(403).json({ 
        success: false, 
        msg: 'Not authorized to access this endpoint'
      });
    }
    
    console.log('Testing Gemini API key');
    const result = await testGeminiAPIKey();
    
    return res.json({
      success: result.success,
      apiKeyConfigured: !!process.env.GEMINI_API_KEY,
      apiKeyFirstChars: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 5) + '...' : 'Not set',
      message: result.success ? 'Gemini API key is working' : result.error,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error checking Gemini API:', err);
    return res.status(500).json({
      success: false,
      msg: 'Failed to check Gemini API',
      error: err.message
    });
  }
});

// @route   POST /api/content/generate
// @desc    Generate new content with AI
// @access  Private
router.post('/generate', [auth, checkSubscription], async (req, res) => {
  console.log('Content generation request received');
  try {
    const { prompt, contentType } = req.body;

    // Validate request
    if (!prompt) {
      console.log('Rejected content generation: No prompt provided');
      return res.status(400).json({ msg: 'Prompt is required' });
    }

    console.log(`Generating content for user ${req.user.id}, prompt: "${prompt.substring(0, 30)}..."`);

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database connection is not available for content generation');
      return res.status(500).json({ msg: 'Database connection error' });
    }

    try {
      // Generate content using Gemini API
      const generatedContent = await generateContent(prompt, contentType || 'other');
      
      // Create new content record
      const newContent = new Content({
        user: req.user.id,
        prompt,
        generatedContent,
        contentType: contentType || 'other'
      });
      
      await newContent.save();
      console.log(`Content saved with ID: ${newContent._id}`);
      
      // Increment user's usage count
      await User.findByIdAndUpdate(
        req.user.id,
        { $inc: { usageCount: 1 } },
        { new: true }
      );
      
      res.json(newContent);
    } catch (apiError) {
      console.error('Error during content generation or database operation:', apiError);
      
      // Handle various API errors specifically
      if (apiError.message.includes('API key')) {
        return res.status(500).json({ 
          msg: 'API configuration error. Please contact support.', 
          error: 'API_CONFIG_ERROR'
        });
      } else if (apiError.message.includes('Rate limit')) {
        return res.status(429).json({ 
          msg: 'Too many requests. Please try again later.', 
          error: 'RATE_LIMIT_EXCEEDED'
        });
      } else {
        return res.status(500).json({ 
          msg: 'Error generating content. Please try again.', 
          error: apiError.message
        });
      }
    }
  } catch (err) {
    console.error('Unexpected error in content generation:', err);
    res.status(500).json({ 
      msg: 'Server Error', 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// @route   POST /api/content/test-gemini
// @desc    Test Gemini API without saving to DB or counting usage
// @access  Private
router.post('/test-gemini', auth, async (req, res) => {
  try {
    const { prompt, contentType, options } = req.body;

    // Validate request
    if (!prompt) {
      return res.status(400).json({ msg: 'Prompt is required' });
    }

    console.log(`Test Gemini API request: ${prompt.substring(0, 50)}...`);

    // Generate content using Gemini API
    const generatedContent = await generateContent(prompt, contentType || 'other', options);

    // Return the generated content without saving
    res.json({ 
      success: true,
      generatedContent,
      contentType: contentType || 'other',
      length: generatedContent.length,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Error testing Gemini API:', err);
    res.status(500).json({ 
      success: false, 
      msg: 'Error testing Gemini API', 
      error: err.message 
    });
  }
});

// @route   GET /api/content
// @desc    Get all content for user
// @access  Private
router.get('/', auth, async (req, res) => {
  console.log(`Getting content for user ${req.user.id}`);
  try {
    const { page = 1, limit = 10, contentType } = req.query;
    
    // Build query
    const query = { user: req.user.id };
    
    // Add content type filter if provided
    if (contentType && contentType !== 'all') {
      query.contentType = contentType;
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error('Database connection is not available for content retrieval');
      return res.status(500).json({ msg: 'Database connection error' });
    }
    
    // Get content with pagination
    const content = await Content.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Content.countDocuments(query);
    
    console.log(`Retrieved ${content.length} items out of ${total} total for user ${req.user.id}`);
    
    res.json({
      content,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('Error retrieving content:', err);
    res.status(500).json({ 
      msg: 'Server Error', 
      error: err.message 
    });
  }
});

// @route   GET /api/content/:id
// @desc    Get content by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    
    // Check if content exists
    if (!content) {
      return res.status(404).json({ msg: 'Content not found' });
    }
    
    // Check if content belongs to user
    if (content.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }
    
    res.json(content);
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Content not found' });
    }
    
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/content/:id
// @desc    Delete content
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const content = await Content.findById(req.params.id);
    
    // Check if content exists
    if (!content) {
      return res.status(404).json({ msg: 'Content not found' });
    }
    
    // Check if content belongs to user
    if (content.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: 'Not authorized' });
    }
    
    await content.deleteOne();
    
    res.json({ msg: 'Content removed' });
  } catch (err) {
    console.error(err.message);
    
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Content not found' });
    }
    
    res.status(500).send('Server Error');
  }
});

module.exports = router; 