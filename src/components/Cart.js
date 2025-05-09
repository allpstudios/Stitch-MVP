import React from 'react';
import { useCart } from '../context/CartContext';
import './Cart.css';
import { FaTimes } from 'react-icons/fa';
import { createCart } from '../utils/shopifyClient';

const Cart = () => {
  const { 
    cartItems, 
    removeFromCart, 
    updateQuantity, 
    getCartTotal, 
    isCartOpen, 
    toggleCart 
  } = useCart();

  if (!isCartOpen) return null;

  const handleCheckout = async () => {
    try {
      console.log('Starting checkout with cart items:', cartItems);

      if (!cartItems || cartItems.length === 0) {
        console.error('No items in cart');
        return;
      }

      const lineItems = cartItems.map(item => {
        if (!item.variantId) {
          console.error('Missing variantId for item:', item);
          return null;
        }

        const cleanId = item.variantId.replace('gid://shopify/ProductVariant/', '');
        const fullVariantId = `gid://shopify/ProductVariant/${cleanId}`;
        
        console.log('Processing line item:', {
          originalId: item.variantId,
          cleanId,
          fullVariantId
        });

        return {
          merchandiseId: fullVariantId,
          quantity: item.quantity
        };
      }).filter(Boolean);

      if (lineItems.length === 0) {
        throw new Error('No valid line items to checkout');
      }

      console.log('Sending to createCart:', lineItems);
      const cart = await createCart(lineItems);
      
      if (!cart?.checkoutUrl) {
        throw new Error('No checkout URL received from cart creation');
      }

      // Ensure we're going directly to checkout
      const checkoutUrl = new URL(cart.checkoutUrl);
      console.log('Redirecting to checkout:', checkoutUrl.toString());
      window.location.href = checkoutUrl.toString();
    } catch (error) {
      console.error('Detailed checkout error:', error);
      alert('There was an error starting checkout. Please try again.');
    }
  };

  return (
    <div className="cart-overlay">
      <div className="cart-container">
        <div className="cart-header">
          <h2>Shopping Cart</h2>
          <button className="close-cart" onClick={toggleCart}>
            <FaTimes />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="cart-empty">
            <p>Your cart is empty</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map(item => (
                <div key={item.id} className="cart-item">
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.title} />
                  </div>
                  <div className="cart-item-details">
                    <h3>{item.title}</h3>
                    <p>Color: {item.color}</p>
                    <p>Size: {item.size}</p>
                    <div className="cart-item-quantity">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-price">
                    ${(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button 
                    className="remove-item"
                    onClick={() => removeFromCart(item.id)}
                  >
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
            <div className="cart-footer">
              <div className="cart-total">
                <span>Total:</span>
                <span>${getCartTotal().toFixed(2)}</span>
              </div>
              <button 
                className="checkout-button"
                onClick={handleCheckout}
              >
                Proceed to Checkout
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart; 