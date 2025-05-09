import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  enableIndexedDbPersistence,
  orderBy
} from 'firebase/firestore';
import { useAuth } from './AuthContext';

// Create the context first
const OrderContext = createContext(null);

// Create the useOrders hook
export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Persistence failed:', err);
});

// Create and export the provider component
export const OrderProvider = ({ children }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, userProfile } = useAuth();
  const isVendor = userProfile?.userType === 'vendor';
  const unsubscribeRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    // Set mounted ref
    mounted.current = true;

    const setupOrderSubscription = async () => {
      if (!user) return;

      try {
        // Create different queries based on user type
        let q;
        
        if (isVendor) {
          // For vendors - show orders they've received from brands
          q = query(
          collection(db, 'orders'),
          where('vendorId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
          console.log('Setting up vendor order subscription for user:', user.uid);
        } else {
          // For brands - show orders they've received from vendors
          q = query(
            collection(db, 'orders'),
            where('brandId', '==', user.uid),
            orderBy('createdAt', 'desc')
          );
          console.log('Setting up brand order subscription for user:', user.uid);
        }

        const unsubscribe = onSnapshot(q, 
          (snapshot) => {
            console.log('Received orders snapshot:', snapshot.docs.length);
            const orders = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            console.log('Raw order data:', orders);
            setOrders(orders);
            setLoading(false);
          },
          (error) => {
            console.error('Error fetching orders:', error);
            setOrders([]);
            setLoading(false);
          }
        );

        return unsubscribe;
      } catch (error) {
        console.error('Error setting up order subscription:', error);
        setLoading(false);
        return () => {};
      }
    };

    setupOrderSubscription();

    // Cleanup function
    return () => {
      mounted.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, isVendor]);

  const createOrder = async (orderData) => {
    try {
      // Validate required fields
      if (!orderData.vendorId && !orderData.brandId) {
        throw new Error('Missing required fields: vendorId or brandId');
      }

      // Add additional fields
      const orderToCreate = {
        ...orderData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: {
          payment: 'pending',
          fulfillment: 'unfulfilled'
        }
      };

      const docRef = await addDoc(collection(db, 'orders'), orderToCreate);
      return docRef.id;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: status
      });
    } catch (err) {
      console.error('Error updating order status:', err);
      throw err;
    }
  };

  return (
    <OrderContext.Provider value={{
      orders,
      loading,
      error,
      createOrder,
      updateOrderStatus
    }}>
      {children}
    </OrderContext.Provider>
  );
}; 