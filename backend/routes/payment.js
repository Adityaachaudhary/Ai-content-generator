const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const { 
  createOrder, 
  captureOrder, 
  getOrderDetails, 
  verifyWebhookSignature 
} = require('../utils/paypalApi');

// @route   GET /api/payments/plans
// @desc    Get subscription plans
// @access  Public
router.get('/plans', (req, res) => {
  // Return hardcoded subscription plans
  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      features: [
        '5 AI generations per month',
        'Basic content types',
        'Standard quality',
        'No download options'
      ],
      limits: {
        usageLimit: 5
      }
    },
    {
      id: 'basic',
      name: 'Basic',
      price: 9.99,
      features: [
        '50 AI generations per month',
        'All content types',
        'High quality content',
        'Download as PDF and Markdown'
      ],
      limits: {
        usageLimit: 50
      }
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      features: [
        'Unlimited AI generations',
        'All content types',
        'Highest quality content',
        'All download options',
        'Priority support'
      ],
      limits: {
        usageLimit: 9999 // Effectively unlimited
      }
    }
  ];

  res.json(plans);
});

// @route   POST /api/payments/create-order
// @desc    Create PayPal order for subscription
// @access  Private
router.post('/create-order', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    
    // Validate planId
    if (!planId || !['basic', 'premium'].includes(planId)) {
      return res.status(400).json({ msg: 'Invalid plan selected' });
    }

    // Create PayPal order
    const order = await createOrder(planId, req.user.id);
    
    if (!order || !order.id) {
      return res.status(500).json({ msg: 'Error creating PayPal order' });
    }

    // Store the order ID in the user document for reference
    await User.findByIdAndUpdate(req.user.id, {
      'payment.pendingOrderId': order.id,
      'payment.pendingPlanId': planId
    });

    // Return the order ID to the client
    return res.json({ 
      success: true, 
      orderId: order.id 
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// @route   POST /api/payments/capture-order
// @desc    Capture PayPal order after user approval
// @access  Private
router.post('/capture-order', auth, async (req, res) => {
  try {
    const { orderId } = req.body;
    
    // Validate order ID
    if (!orderId) {
      return res.status(400).json({ msg: 'Order ID is required' });
    }

    // Get the user to check pending order
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Verify that this order belongs to the user
    if (user.payment.pendingOrderId !== orderId) {
      return res.status(400).json({ msg: 'Order ID does not match pending order' });
    }

    // Capture the order
    const captureData = await captureOrder(orderId);

    // Check if capture was successful
    if (captureData.status === 'COMPLETED') {
      // Get plan details
      const planId = user.payment.pendingPlanId;
      
      // Update user subscription status
      await handleCompletedPayment(user, planId);

      // Return success to client
      return res.json({
        success: true,
        status: 'COMPLETED',
        planId: planId
      });
    } else {
      return res.status(400).json({ 
        success: false, 
        msg: 'Payment not completed', 
        status: captureData.status 
      });
    }
  } catch (error) {
    console.error('Capture order error:', error);
    return res.status(500).json({ msg: 'Server error', error: error.message });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle PayPal webhooks
// @access  Public
router.post('/webhook', async (req, res) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const event = req.body;
    const headers = req.headers;
    
    // Verify the webhook signature
    const isValid = await verifyWebhookSignature(webhookId, event, headers);
    
    if (!isValid) {
      return res.status(401).json({ msg: 'Invalid webhook signature' });
    }
    
    // Process different webhook events
    const eventType = event.event_type;
    
    switch (eventType) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        // Payment was successful
        await handlePaymentCompleted(event);
        break;
        
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.REFUNDED':
        // Payment was denied or refunded
        await handlePaymentDeniedOrRefunded(event);
        break;
        
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
    
    res.status(200).json({ msg: 'Webhook received' });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// Handle completed payments
const handlePaymentCompleted = async (event) => {
  try {
    const orderId = event.resource.supplementary_data.related_ids.order_id;
    const payerId = event.resource.payer.payer_id;
    
    // Find user with this orderId
    const user = await User.findOne({ 'subscription.orderId': orderId });
    
    if (!user) {
      console.log(`No user found with order ID: ${orderId}`);
      return;
    }
    
    // If payment was completed but user subscription not updated (rare case),
    // update it now
    if (user.subscription.status === 'free') {
      const planId = user.subscription.pendingPlanId || 'basic';
      let usageLimit = planId === 'basic' ? 50 : 9999;
      
      // Calculate subscription end date (30 days from now)
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);
      
      await User.findByIdAndUpdate(user._id, {
        subscription: {
          status: planId,
          planId: planId,
          customerId: payerId,
          orderId: orderId,
          startDate: new Date(),
          endDate: endDate
        },
        usageLimit: usageLimit,
        // Reset usage count when subscription is purchased
        usageCount: 0
      });
    }
    
    console.log(`Payment completed processed for user: ${user._id}`);
  } catch (error) {
    console.error('Error handling payment completed:', error);
    throw error;
  }
};

// Handle denied or refunded payments
const handlePaymentDeniedOrRefunded = async (event) => {
  try {
    const orderId = event.resource.supplementary_data.related_ids.order_id;
    
    // Find user with this orderId
    const user = await User.findOne({ 'subscription.orderId': orderId });
    
    if (!user) {
      console.log(`No user found with order ID: ${orderId}`);
      return;
    }
    
    // Revert to free plan
    await User.findByIdAndUpdate(user._id, {
      subscription: {
        status: 'free',
        planId: 'free',
        customerId: user.subscription.customerId,
        orderId: null,
        startDate: null,
        endDate: null
      },
      usageLimit: 5
    });
    
    console.log(`Payment denied/refunded processed for user: ${user._id}`);
  } catch (error) {
    console.error('Error handling payment denied/refunded:', error);
    throw error;
  }
};

// Handle completed payment
const handleCompletedPayment = async (user, planId) => {
  try {
    // Determine new usage limits based on plan
    let usageLimit = 10; // Default for free plan
    
    if (planId === 'basic') {
      usageLimit = 50;
    } else if (planId === 'premium') {
      usageLimit = 200;
    }
    
    // Calculate subscription end date (30 days from now)
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    // Update user subscription
    await User.findByIdAndUpdate(user._id, {
      'subscription.status': planId,
      'subscription.planId': planId,
      'subscription.startDate': new Date(),
      'subscription.endDate': endDate,
      'subscription.isActive': true,
      'payment.pendingOrderId': null,
      'payment.pendingPlanId': null,
      usageLimit: usageLimit,
      // Reset usage count when subscription is purchased
      usageCount: 0
    });
    
    return true;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw error;
  }
};

// @route   GET /api/payments/subscription
// @desc    Get user's subscription details
// @access  Private
router.get('/subscription', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }
    
    // Check if subscription is expired
    if (user.subscription.endDate && new Date(user.subscription.endDate) < new Date()) {
      // Reset to free plan if expired
      await User.findByIdAndUpdate(user._id, {
        subscription: {
          status: 'free',
          planId: 'free',
          customerId: user.subscription.customerId,
          orderId: null,
          startDate: null,
          endDate: null
        },
        usageLimit: 5
      });
      
      // Return free plan details
      return res.json({
        subscription: {
          status: 'free',
          planId: 'free',
          startDate: null,
          endDate: null,
          isActive: true
        },
        usageLimit: 5,
        usageCount: user.usageCount
      });
    }
    
    // Calculate days remaining if there's an end date
    let daysRemaining = null;
    if (user.subscription.endDate) {
      const endDate = new Date(user.subscription.endDate);
      const today = new Date();
      const diffTime = endDate - today;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
    
    res.json({
      subscription: {
        status: user.subscription.status,
        planId: user.subscription.planId,
        startDate: user.subscription.startDate,
        endDate: user.subscription.endDate,
        isActive: user.subscription.status !== 'free',
        daysRemaining: daysRemaining
      },
      usageLimit: user.usageLimit,
      usageCount: user.usageCount,
      usagePercentage: (user.usageCount / user.usageLimit) * 100
    });
  } catch (err) {
    console.error('Error getting subscription:', err);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router; 