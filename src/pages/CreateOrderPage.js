import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPlus, FaMinus } from 'react-icons/fa';
import { useOrders } from '../context/OrderContext';
import { useAuth } from '../context/AuthContext';
import './CreateOrderPage.css';
import { collection, query, where, getDocs, serverTimestamp, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { MessageService } from '../services/MessageService';

const CreateOrderPage = () => {
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();
  const { createOrder } = useOrders();

  const [formData, setFormData] = useState({
    customer: {
      name: '',
      email: '',
      phone: '',
      company: '',
      userId: ''
    },
    items: [
      { 
        description: '',
        rate: 0,
        quantity: 1,
        amount: 0,
        taxable: false,
        details: ''
      }
    ],
    shipping: {
      address: {
        street: '',
        city: '',
        state: '',
        zip: ''
      },
      method: 'UPS Ground'
    }
  });

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef(null);

  const addItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        { description: '', rate: 0, quantity: 1, amount: 0, taxable: false, details: '' }
      ]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index)
      });
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === 'rate' || field === 'quantity') {
      newItems[index].amount = newItems[index].rate * newItems[index].quantity;
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + (item.rate * item.quantity), 0);
    const taxableAmount = formData.items
      .filter(item => item.taxable)
      .reduce((sum, item) => sum + (item.rate * item.quantity), 0);
    const tax = taxableAmount * 0.1; // 10% tax
    const shipping = 15; // Fixed shipping for now
    const total = subtotal + tax + shipping;
    return { subtotal, tax, shipping, total };
  };

  const searchUsers = async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      console.log('Starting search for term:', searchTerm);

      // Search in both brands and users collections
      const brandsRef = collection(db, 'brands');
      const brandsSnapshot = await getDocs(brandsRef);
      
      const searchTermLower = searchTerm.toLowerCase();
      
      const results = brandsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          console.log('Processing brand:', { id: doc.id, ...data });
          return {
            id: doc.id,
            ...data
          };
        })
        .filter(brand => {
          const matchesName = (brand.name || '').toLowerCase().includes(searchTermLower);
          const matchesCompany = (brand.companyName || '').toLowerCase().includes(searchTermLower);
          const matchesEmail = (brand.email || '').toLowerCase().includes(searchTermLower);
          
          console.log('Filtering brand:', {
            id: brand.id,
            name: brand.name,
            company: brand.companyName,
            email: brand.email,
            matches: {
              name: matchesName,
              company: matchesCompany,
              email: matchesEmail
            }
          });
          
          return matchesName || matchesCompany || matchesEmail;
        });

      console.log('Final filtered results:', results);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching brands:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = (brand) => {
    console.log('Selected brand:', brand);
    setFormData({
      ...formData,
      customer: {
        name: brand.name || brand.companyName || '',
        email: brand.email || '',
        phone: brand.phoneNumber || '',
        company: brand.companyName || '',
        userId: brand.id
      }
    });
    setSearchResults([]);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    console.log('Current user:', user);
    console.log('Selected brand:', formData.customer);
  }, [user, formData.customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submitted');

    if (!formData.customer.userId) {
      alert('Please select a brand/customer');
      return;
    }

    try {
      // Check for existing conversation
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', user.uid)
      );
      
      const querySnapshot = await getDocs(q);
      let existingThread = null;
      
      // Find existing thread between vendor and brand
      querySnapshot.forEach(doc => {
        const conversation = doc.data();
        if (conversation.participants.includes(formData.customer.userId)) {
          existingThread = {
            id: doc.id,
            ...conversation
          };
        }
      });

      // Create the order first
      const orderData = {
        vendorId: user.uid,
        vendorName: userProfile?.companyName || user.displayName,
        brandId: formData.customer.userId,
        brandName: formData.customer.company,
        orderNumber: Math.floor(100000 + Math.random() * 900000).toString(),
        items: formData.items,
        total: calculateTotals(),
        shipping: formData.shipping,
        customer: formData.customer,
        createdAt: serverTimestamp(),
        status: 'pending'
      };

      // Create order in orders collection
      const newOrder = await createOrder(orderData);

      if (existingThread) {
        await MessageService.sendOrderToThread(
          existingThread.id,
          orderData,
          orderData.vendorName
        );
        
        navigate('/dashboard/messages', { 
          state: { 
            selectedChat: existingThread.id,
            openThread: true 
          },
          replace: true
        });
      } else {
        const threadId = await MessageService.createMessageThread({
          participants: [user.uid, formData.customer.userId],
          participantNames: {
            [user.uid]: orderData.vendorName,
            [formData.customer.userId]: formData.customer.company
          },
          order: orderData,
          senderName: orderData.vendorName
        });
        
        navigate('/dashboard/messages', { 
          state: { 
            selectedChat: threadId,
            openThread: true 
          },
          replace: true
        });
      }

    } catch (error) {
      console.error('Error creating order:', error);
      alert('Failed to create order. Please try again.');
    }
  };

  const debugDatabase = async () => {
    try {
      // Check brands collection
      const brandsRef = collection(db, 'brands');
      const brandsSnapshot = await getDocs(brandsRef);
      console.log('Brands in database:', brandsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));

      // Check users collection
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      console.log('Users in database:', usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })));
    } catch (error) {
      console.error('Error debugging database:', error);
    }
  };

  useEffect(() => {
    debugDatabase();
  }, []);

  return (
    <div className="create-order-page">
      <div className="page-header">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <FaArrowLeft /> Back to Orders
        </button>
        <h1>Create New Order</h1>
      </div>

      <div className="page-content">
        <form onSubmit={handleSubmit}>
          {/* Client Information Section */}
          <div className="form-section">
            <h3>Client Information</h3>
            <div className="client-info" ref={searchRef}>
              <div className="input-group">
                <div className="search-container">
                  <input
                    type="text"
                    placeholder="Search for brand/client..."
                    onChange={(e) => {
                      const value = e.target.value;
                      console.log('Search term:', value); // Debug log
                      setFormData({
                        ...formData,
                        customer: { 
                          ...formData.customer, 
                          name: value,
                          userId: '' 
                        }
                      });
                      searchUsers(value);
                    }}
                    value={formData.customer.name}
                    required
                  />
                  {isSearching && <div className="search-loading">Searching...</div>}
                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map(user => {
                        console.log('Rendering user:', user); // Debug log
                        return (
                          <div 
                            key={user.id} 
                            className="search-result-item"
                            onClick={() => handleUserSelect(user)}
                          >
                            <div className="user-info">
                              <strong>{user.name || 'No Name'}</strong>
                              <span>{user.companyName || 'No Company'}</span>
                            </div>
                            <small>{user.email || 'No Email'}</small>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Company Name"
                  value={formData.customer.company}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, company: e.target.value }
                  })}
                />
              </div>
              <div className="input-group">
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.customer.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, email: e.target.value }
                  })}
                  required
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={formData.customer.phone}
                  onChange={(e) => setFormData({
                    ...formData,
                    customer: { ...formData.customer, phone: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Invoice Items Section */}
          <div className="form-section">
            <h3>Order Items</h3>
            <div className="invoice-table">
              <div className="table-header">
                <div className="col-description">Description</div>
                <div className="col-rate">Rate</div>
                <div className="col-qty">QTY</div>
                <div className="col-amount">Amount</div>
                <div className="col-tax">Tax</div>
                <div className="col-actions"></div>
              </div>
              
              {formData.items.map((item, index) => (
                <div key={index} className="table-row">
                  <div className="col-description">
                    <input
                      type="text"
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      required
                    />
                    <textarea
                      placeholder="Additional details"
                      value={item.details}
                      onChange={(e) => updateItem(index, 'details', e.target.value)}
                      rows="2"
                    />
                  </div>
                  <div className="col-rate">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate || ''}
                      onChange={(e) => updateItem(index, 'rate', e.target.value ? parseFloat(e.target.value) : 0)}
                      required
                    />
                  </div>
                  <div className="col-qty">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ''}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value ? parseInt(e.target.value) : 1)}
                      required
                    />
                  </div>
                  <div className="col-amount">
                    ${(item.rate * item.quantity).toFixed(2)}
                  </div>
                  <div className="col-tax">
                    <input
                      type="checkbox"
                      checked={item.taxable}
                      onChange={(e) => updateItem(index, 'taxable', e.target.checked)}
                    />
                  </div>
                  <div className="col-actions">
                    <button 
                      type="button" 
                      className="remove-item"
                      onClick={() => removeItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <FaMinus />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            <button type="button" className="add-item" onClick={addItem}>
              <FaPlus /> Add Line Item
            </button>
          </div>

          {/* Shipping Section */}
          <div className="form-section">
            <h3>Shipping Details</h3>
            <div className="shipping-address">
              <input
                type="text"
                placeholder="Street Address"
                value={formData.shipping.address.street}
                onChange={(e) => setFormData({
                  ...formData,
                  shipping: {
                    ...formData.shipping,
                    address: { ...formData.shipping.address, street: e.target.value }
                  }
                })}
                required
              />
              <div className="address-row">
                <input
                  type="text"
                  placeholder="City"
                  value={formData.shipping.address.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, city: e.target.value }
                    }
                  })}
                  required
                />
                <input
                  type="text"
                  placeholder="State"
                  value={formData.shipping.address.state}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, state: e.target.value }
                    }
                  })}
                  required
                />
                <input
                  type="text"
                  placeholder="ZIP Code"
                  value={formData.shipping.address.zip}
                  onChange={(e) => setFormData({
                    ...formData,
                    shipping: {
                      ...formData.shipping,
                      address: { ...formData.shipping.address, zip: e.target.value }
                    }
                  })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="form-section">
            <h3>Order Summary</h3>
            <div className="order-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>${calculateTotals().subtotal.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Tax (10%):</span>
                <span>${calculateTotals().tax.toFixed(2)}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span>${calculateTotals().shipping.toFixed(2)}</span>
              </div>
              <div className="summary-row total">
                <span>Total:</span>
                <span>${calculateTotals().total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn primary">Create Order</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderPage; 