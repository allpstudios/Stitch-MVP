import React, { createContext, useContext, useState } from 'react';

const CartContext = createContext();

export const useCart = () => {
  return useContext(CartContext);
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToCart = (product, selectedQuantities) => {
    console.log('Product:', product); // Debug log
    console.log('Selected quantities:', selectedQuantities); // Debug log

    const newItems = Object.entries(selectedQuantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([key, quantity]) => {
        const [color, size] = key.split('-');
        console.log('Looking for variant with:', { color, size }); // Debug log
        
        // Log all available variants
        console.log('Available variants:', product.variants.edges.map(edge => ({
          id: edge.node.id,
          options: edge.node.selectedOptions
        })));

        const variant = product.variants.edges.find(edge => {
          const hasColor = edge.node.selectedOptions.some(opt => 
            opt.name.toLowerCase() === 'color' && 
            opt.value.toLowerCase() === color.toLowerCase()
          );
          const hasSize = edge.node.selectedOptions.some(opt => 
            opt.name.toLowerCase() === 'size' && 
            opt.value.toLowerCase() === size.toLowerCase()
          );
          
          console.log('Checking variant:', {
            id: edge.node.id,
            options: edge.node.selectedOptions,
            hasColor,
            hasSize
          });
          
          return hasColor && hasSize;
        });

        if (!variant) {
          console.error('No variant found for:', { color, size });
          return null;
        }

        return {
          id: `${product.id}-${color}-${size}`,
          productId: product.id,
          variantId: variant.node.id.includes('gid://shopify/ProductVariant/') 
            ? variant.node.id 
            : `gid://shopify/ProductVariant/${variant.node.id}`,
          title: product.title,
          color,
          size,
          quantity,
          price: variant.node.price.amount,
          image: product.images.edges[0]?.node.url
        };
      })
      .filter(Boolean);

    if (newItems.length === 0) {
      console.error('No valid items to add to cart');
      return;
    }

    setCartItems(prevItems => {
      const updatedItems = [...prevItems];
      
      newItems.forEach(newItem => {
        const existingItemIndex = updatedItems.findIndex(item => item.id === newItem.id);
        
        if (existingItemIndex >= 0) {
          updatedItems[existingItemIndex].quantity += newItem.quantity;
        } else {
          updatedItems.push(newItem);
        }
      });
      
      return updatedItems;
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const toggleCart = () => {
    setIsCartOpen(prev => !prev);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartTotal,
      isCartOpen,
      toggleCart
    }}>
      {children}
    </CartContext.Provider>
  );
}; 