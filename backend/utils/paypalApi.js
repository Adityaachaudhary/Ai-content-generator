const paypal = require('@paypal/checkout-server-sdk');

// Configure PayPal environment
const configureEnvironment = () => {
  // Check if we're in production or development environment
  const environment = process.env.NODE_ENV === 'production' 
    ? new paypal.core.LiveEnvironment(
        process.env.PAYPAL_CLIENT_ID,
        process.env.PAYPAL_CLIENT_SECRET
      )
    : new paypal.core.SandboxEnvironment(
        process.env.PAYPAL_CLIENT_ID || 'sb',
        process.env.PAYPAL_CLIENT_SECRET || 'sb_secret'
      );

  // Create a PayPal client with the environment
  return new paypal.core.PayPalHttpClient(environment);
};

// Create a PayPal order
const createOrder = async (planId, userId) => {
  try {
    console.log(`Creating PayPal order for plan ${planId}, user ${userId}`);
    
    // Lookup plan details based on planId
    let amount, description;
    switch (planId) {
      case 'basic':
        amount = '9.99';
        description = 'Basic Plan Subscription - Monthly';
        break;
      case 'premium':
        amount = '19.99';
        description = 'Premium Plan Subscription - Monthly';
        break;
      default:
        throw new Error('Invalid plan ID');
    }

    // Base URL for frontend app
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.FRONTEND_URL || 'https://yourdomain.com' 
      : 'http://localhost:3000';

    // For sandbox testing with client "sb" - simplified order creation
    if (process.env.PAYPAL_CLIENT_ID === 'sb' || !process.env.PAYPAL_CLIENT_ID) {
      // Return a mock order for testing
      console.log('Using sandbox/mock PayPal order');
      return {
        id: `TEST-ORDER-${Date.now()}`,
        status: 'CREATED',
        links: [
          {
            href: `${baseUrl}/payment/success?token=TEST-ORDER-${Date.now()}`,
            rel: 'approve',
            method: 'GET'
          }
        ]
      };
    }

    const request = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: `${planId}_${userId}`,
          description: description,
          amount: {
            currency_code: 'USD',
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: 'AI Content Generator',
        landing_page: 'BILLING',
        user_action: 'PAY_NOW',
        return_url: `${baseUrl}/payment/success`,
        cancel_url: `${baseUrl}/payment/cancel`,
      },
    };
    
    const client = configureEnvironment();
    
    // Set the intent to capture
    request.prefer("return=representation");
    
    // Execute the request
    const response = await client.execute(new paypal.orders.OrdersCreateRequest(), request);
    
    console.log(`PayPal Order created: ${response.result.id}`);
    return response.result;
  } catch (error) {
    console.error('Error creating PayPal order:', error);
    throw error;
  }
};

// Capture an order
const captureOrder = async (orderId) => {
  try {
    // For sandbox testing with client "sb" - simplified capture
    if (process.env.PAYPAL_CLIENT_ID === 'sb' || !process.env.PAYPAL_CLIENT_ID) {
      // Check if this is a test order
      if (orderId.startsWith('TEST-ORDER-')) {
        console.log('Capturing sandbox/mock PayPal order');
        return {
          id: orderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              reference_id: 'MOCK_REFERENCE',
              shipping: {
                name: { full_name: 'Test User' }
              }
            }
          ],
          payer: {
            name: { given_name: 'Test', surname: 'User' },
            email_address: 'test@example.com',
            payer_id: 'TESTPAYERID123'
          }
        };
      }
    }

    const client = configureEnvironment();
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.prefer("return=representation");
    
    const response = await client.execute(request);
    
    console.log(`PayPal Order captured: ${response.result.id}`);
    return response.result;
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    throw error;
  }
};

// Get order details
const getOrderDetails = async (orderId) => {
  try {
    const client = configureEnvironment();
    const request = new paypal.orders.OrdersGetRequest(orderId);
    
    // Execute the request
    const response = await client.execute(request);
    
    // Return order details
    return response.result;
  } catch (error) {
    console.error("Error getting PayPal order details:", error);
    throw error;
  }
};

// Verify a webhook signature
const verifyWebhookSignature = async (webhookId, event, requestHeaders) => {
  try {
    const client = configureEnvironment();
    const verifyRequest = new paypal.notifications.VerifyWebhookSignatureRequest();
    
    verifyRequest.requestBody({
      auth_algo: requestHeaders['paypal-auth-algo'],
      cert_url: requestHeaders['paypal-cert-url'],
      transmission_id: requestHeaders['paypal-transmission-id'],
      transmission_sig: requestHeaders['paypal-transmission-sig'],
      transmission_time: requestHeaders['paypal-transmission-time'],
      webhook_id: webhookId,
      webhook_event: event
    });
    
    const response = await client.execute(verifyRequest);
    return response.result.verification_status === 'SUCCESS';
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
};

module.exports = {
  createOrder,
  captureOrder,
  getOrderDetails,
  verifyWebhookSignature
}; 