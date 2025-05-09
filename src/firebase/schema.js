/**
 * @typedef {Object} Order
 * @property {string} orderNumber
 * @property {Date} date
 * @property {string} customerId
 * @property {string} vendorId
 * @property {OrderItem[]} items
 * @property {OrderStatus} status
 * @property {OrderTotals} totals
 * @property {ShippingDetails} shipping
 * @property {CustomerInfo} customer
 */

/**
 * @typedef {Object} OrderItem
 * @property {string} productId
 * @property {string} name
 * @property {number} quantity
 * @property {number} price
 * @property {string} size
 * @property {string} color
 */

/**
 * @typedef {Object} OrderStatus
 * @property {'pending'|'paid'|'failed'} payment
 * @property {'unfulfilled'|'processing'|'shipped'|'delivered'} fulfillment
 */

/**
 * @typedef {Object} OrderTotals
 * @property {number} subtotal
 * @property {number} tax
 * @property {number} shipping
 * @property {number} total
 */

/**
 * @typedef {Object} ShippingDetails
 * @property {{street: string, city: string, state: string, zip: string}} address
 * @property {string} method
 * @property {string} tracking
 */

/**
 * @typedef {Object} CustomerInfo
 * @property {string} name
 * @property {string} email
 * @property {string} phone
 */

// Example order structure (for reference only)
const orderExample = {
  orderNumber: '',
  date: new Date(),
  customerId: '',
  vendorId: '',
  items: [{
    productId: '',
    name: '',
    quantity: 0,
    price: 0,
    size: '',
    color: ''
  }],
  status: {
    payment: 'pending',
    fulfillment: 'unfulfilled'
  },
  totals: {
    subtotal: 0,
    tax: 0,
    shipping: 0,
    total: 0
  },
  shipping: {
    address: {
      street: '',
      city: '',
      state: '',
      zip: ''
    },
    method: '',
    tracking: ''
  },
  customer: {
    name: '',
    email: '',
    phone: ''
  }
};

export const OrderSchema = {
  orderExample
}; 