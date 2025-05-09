export const STRIPE_PUBLISHABLE_KEY = 'pk_test_W3pfSqPH8YPslJV7F59I2BQg';

// Initialize Stripe Elements configuration
export const STRIPE_OPTIONS = {
  appearance: {
    theme: 'stripe',
    variables: {
      colorPrimary: '#FF69B4',
      colorBackground: '#ffffff',
      colorText: '#30313d',
      colorDanger: '#df1b41',
      fontFamily: 'Ideal Sans, system-ui, sans-serif',
      borderRadius: '4px',
    },
  },
};

// Payment processing status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
}; 