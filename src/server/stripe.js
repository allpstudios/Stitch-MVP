const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create a payment intent for a quote
exports.createPaymentIntent = async (quoteAmount) => {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(quoteAmount * 100), // Convert to cents
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Confirm payment was successful
exports.confirmPayment = async (paymentIntentId) => {
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    return paymentIntent.status === 'succeeded';
  } catch (error) {
    console.error('Error confirming payment:', error);
    throw error;
  }
};

// Create a refund if needed
exports.createRefund = async (paymentIntentId) => {
  try {
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
    });
    return refund;
  } catch (error) {
    console.error('Error creating refund:', error);
    throw error;
  }
}; 