import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { STRIPE_PUBLISHABLE_KEY, STRIPE_OPTIONS } from '../config/stripe';
import { createPaymentIntent } from '../server/stripe';
import './PaymentForm.css';

// Initialize Stripe
const stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);

const CheckoutForm = ({ amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin,
          payment_method_data: {
            billing_details: {
              phone: null // Make phone optional
            }
          }
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMessage(error.message);
        onError(error);
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent);
      }
    } catch (err) {
      setErrorMessage('An unexpected error occurred.');
      onError(err);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h3>Enter Payment Details</h3>
      <PaymentElement 
        options={{
          fields: {
            billingDetails: {
              phone: 'never' // Don't collect phone number
            }
          }
        }}
      />
      {errorMessage && <div className="error-message">{errorMessage}</div>}
      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="payment-button"
      >
        {isProcessing ? 'Processing...' : `Pay $${amount.toFixed(2)}`}
      </button>
    </form>
  );
};

const PaymentForm = ({ amount, onSuccess, onError }) => {
  const [clientSecret, setClientSecret] = useState(null);

  useEffect(() => {
    const initializePayment = async () => {
      try {
        const { clientSecret: secret } = await createPaymentIntent(amount);
        setClientSecret(secret);
      } catch (error) {
        onError(error);
      }
    };

    initializePayment();
  }, [amount]);

  if (!clientSecret) {
    return <div>Loading payment form...</div>;
  }

  return (
    <Elements stripe={stripePromise} options={{ ...STRIPE_OPTIONS, clientSecret }}>
      <CheckoutForm amount={amount} onSuccess={onSuccess} onError={onError} />
    </Elements>
  );
};

export default PaymentForm; 