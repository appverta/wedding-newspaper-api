const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
  origin: [
    'https://ai-wedding.appverta.app',
    'https://wedding.abverda.com',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Configuration
const PRICES = {
  basic: {
    amount: 1999, // $19.99 in cents
    name: 'Basic Package',
    description: 'AI Content Co-Pilot + 1 Template Style'
  },
  premium: {
    amount: 2499, // $24.99 in cents
    name: 'Premium Package',
    description: 'AI Content Co-Pilot + 3 Template Styles + Instructions'
  },
  complete: {
    amount: 4999, // $49.99 in cents
    name: 'Complete Bundle',
    description: 'Everything + Future Updates + Priority Support'
  }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Wedding Newspaper API is running on Railway!'
  });
});

// Validate access code
app.post('/api/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Access code is required' });
    }
    
    // Simple validation - in production, check against database
    if (code.startsWith('WN-') && code.length >= 10) {
      res.json({ 
        valid: true, 
        message: 'Access code is valid',
        code: code
      });
    } else {
      res.json({ 
        valid: false, 
        message: 'Invalid access code format'
      });
    }
  } catch (error) {
    console.error('Error validating code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId } = req.body;
    
    if (!PRICES[priceId]) {
      return res.status(400).json({ error: 'Invalid price ID' });
    }

    const price = PRICES[priceId];
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: price.name,
              description: price.description,
            },
            unit_amount: price.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://ai-wedding.appverta.app'}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://ai-wedding.appverta.app'}?canceled=true`,
      metadata: {
        priceId: priceId,
        packageType: price.name
      }
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook
app.post('/api/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful:', session.id);
      
      // Generate access code
      const accessCode = generateAccessCode();
      console.log('Generated access code:', accessCode);
      
      // In production, save to database and send email to customer
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Generate access code
function generateAccessCode() {
  const prefix = "WN";
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${year}-${random}-${timestamp}`;
}

// Start server
app.listen(PORT, () => {
  console.log(`Wedding Newspaper API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
