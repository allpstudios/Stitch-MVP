import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, onSnapshot, orderBy, getDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';
import { FaBox, FaCheckCircle, FaShippingFast, FaHistory, FaChartLine, FaBell, FaCog, FaPlus, FaEnvelope, FaRobot, FaCalendar, FaDollarSign, FaChartBar, FaCalculator, FaUserPlus, FaBullhorn, FaListUl, FaChevronLeft, FaChevronRight, FaEllipsisH, FaPencilAlt, FaTrash, FaClock, FaMapMarkerAlt, FaUserCircle, FaEdit, FaStar, FaFileAlt, FaFileContract, FaFile, FaArchive, FaUsers, FaChevronDown, FaSearch, FaSyncAlt, FaBug } from 'react-icons/fa';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import OrderDetailsModal from '../components/OrderDetailsModal';
import CreateOrder from '../components/CreateOrder';
import Portal from '../components/Portal';
import { useNavigate, useLocation } from 'react-router-dom';
import Messages from './Messages';
import { format, startOfWeek, endOfWeek, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from 'date-fns';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Link } from 'react-router-dom';
import QuoteRequestModal from '../components/QuoteRequestModal';
import QuoteDetailsModal from '../components/QuoteDetailsModal';
import { useOrders } from '../context/OrderContext';
import OrderOverviewModal from '../components/OrderOverviewModal';
import OrderInvoiceModal from '../components/OrderInvoiceModal';
import StatsCard from '../components/StatsCard';
import Profile from './Profile';  // Import the Profile component
import { toast } from 'react-toastify';

const Dashboard = ({ defaultTab }) => {
  const { orders: contextOrders } = useOrders();
  const { user, userProfile, isVendor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(defaultTab || 'home');
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [shouldOpenThread, setShouldOpenThread] = useState(false);
  const [activeMetric, setActiveMetric] = useState('orders');
  const [dateRange, setDateRange] = useState('7d');
  const [centerContent, setCenterContent] = useState('metrics');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);  // Add this line
  const [showOrderOverview, setShowOrderOverview] = useState(false);
  const [selectedOrderData, setSelectedOrderData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({
    status: []
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCurrentOrdersOpen, setIsCurrentOrdersOpen] = useState(true);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskFormData, setTaskFormData] = useState({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    label: ''
  });
  const [todoLists, setTodoLists] = useState({
    'TO_DO': {
      id: 'TO_DO',
      title: 'To Do',
      cards: []
    },
    'IN_PROGRESS': {
      id: 'IN_PROGRESS',
      title: 'In Progress',
      cards: []
    },
    'DONE': {
      id: 'DONE',
      title: 'Done',
      cards: []
    }
  });
  const [events, setEvents] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    title: '',
    description: '',
    start: '',
    end: '',
    location: '',
    color: '#FF69B4'
  });
  const [quoteRequests, setQuoteRequests] = useState([]);
  const [quoteMessages, setQuoteMessages] = useState([]);
  const [orderMessages, setOrderMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    fulfilledOrders: 0,
    pendingOrders: 0,
    totalQuotes: 0,
    pendingQuotes: 0,
    acceptedQuotes: 0
  });
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [isQuoteRequestsOpen, setIsQuoteRequestsOpen] = useState(true);
  const [isOrdersTableOpen, setIsOrdersTableOpen] = useState(true);

  // Add notification count states
  const [quotesCount, setQuotesCount] = useState(0);
  const [ordersCount, setOrdersCount] = useState(0);
  const [messagesCount, setMessagesCount] = useState(0);
  const [alertsCount, setAlertsCount] = useState(0);

  // Add customers state
  const [customers, setCustomers] = useState([]);
  
  // Add a separate state for display customers that won't be affected by navigation
  const [displayCustomers, setDisplayCustomers] = useState([]);
  
  // Add a useRef to cache customer data that persists between tab changes
  const customerDataCache = useRef(null);
  
  // Add this function to save customers data to localStorage
  const saveCustomersToStorage = useCallback((data) => {
    try {
      // Only save non-empty data
      if (data && data.length > 0) {
        console.log(`Saving ${data.length} customers to localStorage`);
        localStorage.setItem('cached_customers', JSON.stringify(data));
      } else if (isVendor) {
        // For vendors with no customer data, remove any existing cache
        // to ensure we don't show stale data
        console.log("Clearing cached customer data for vendor");
        localStorage.removeItem('cached_customers');
      }
    } catch (err) {
      console.error("Error saving customers to localStorage:", err);
    }
  }, [isVendor]);
  
  // Add this function to load customers data from localStorage
  const loadCustomersFromStorage = useCallback(() => {
    try {
      const cachedData = localStorage.getItem('cached_customers');
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        console.log(`Loaded ${parsedData.length} customers from localStorage`);
        return parsedData;
      }
    } catch (err) {
      console.error("Error loading customers from localStorage:", err);
    }
    return null;
  }, []);
  
  // Clear any stale cached customer data for vendors on component mount
  useEffect(() => {
    if (isVendor) {
      console.log("Vendor dashboard mounted, clearing any stale cached customer data");
      // Clear cached data in localStorage
      localStorage.removeItem('cached_customers');
      // Clear the memory cache
      customerDataCache.current = null;
      // Reset display customers to ensure we don't show stale data
      setDisplayCustomers([]);
    }
  }, [isVendor]);
  
  // Listen for customers changes and update display customers and caches
  useEffect(() => {
    if (customers && customers.length > 0) {
      console.log(`Updating customer caches with ${customers.length} customers`);
      // Update the display customers
      setDisplayCustomers(customers);
      // Update the memory cache
      customerDataCache.current = [...customers];
      // Update local storage
      saveCustomersToStorage(customers);
    }
  }, [customers, saveCustomersToStorage]);
  
  // Guarantee display customers is populated from the cache on mount and tab change
  useEffect(() => {
    if (activeTab === 'customers') {
      // For vendors, we want to ensure we're always showing real customer data
      // and not relying on cached data that might include fake/test customers
      if (isVendor) {
        console.log("Vendor customers tab activated, will refresh to get real data only");
        // Don't load from cache for vendors - we'll rely on the refreshCustomers call
        // which happens in another useEffect when tab changes
      } 
      // For brands, we can still use cached data
      else if (!isVendor) {
        // If we have customers in memory, use those
        if (customers && customers.length > 0) {
          console.log(`Setting display customers from memory: ${customers.length} records`);
          setDisplayCustomers(customers);
        } 
        // Otherwise check the ref cache
        else if (customerDataCache.current && customerDataCache.current.length > 0) {
          console.log(`Setting display customers from ref cache: ${customerDataCache.current.length} records`);
          setDisplayCustomers(customerDataCache.current);
        }
        // Finally check localStorage 
        else {
          try {
            const cachedData = localStorage.getItem('cached_customers');
            if (cachedData) {
              const parsedData = JSON.parse(cachedData);
              
              // For brands, check if there are any real interactions before using localStorage data
              if (!isVendor) {
                const hasInteractions = orders.length > 0 || quoteRequests.length > 0;
                if (!hasInteractions) {
                  console.log("No real vendor interactions but found cached data, ignoring cached data");
                  localStorage.removeItem('cached_customers');
                  return;
                }
              }
              
              console.log(`Setting display customers from localStorage: ${parsedData.length} records`);
              setDisplayCustomers(parsedData);
            }
          } catch (err) {
            console.error("Error loading customers from localStorage:", err);
          }
        }
      }
    }
  }, [activeTab, customers, isVendor, orders, quoteRequests]);
  
  // Enhanced refresh customers function to force reload
  const refreshCustomers = useCallback(() => {
    if (user?.uid && isVendor) {
      console.log("Force refreshing customer data");
      setLoading(true);
      
      // Now do a complete fresh fetch from the database
      const fetchCustomers = async () => {
        try {
          const customersMap = new Map();
          
          // 1. Fetch all quote requests
          const quotesRef = collection(db, 'quoteRequests');
          const customersQuotesQuery = query(quotesRef, where('vendorId', '==', user.uid));
          const quotesSnapshot = await getDocs(customersQuotesQuery);
          
          quotesSnapshot.docs.forEach(docSnapshot => {
            const quote = docSnapshot.data();
            const brandId = quote.brandId;
            
            if (brandId && brandId !== user.uid) {
              const brandName = quote.brandName || 'Unknown Brand';
              
              if (customersMap.has(brandId)) {
                const customer = customersMap.get(brandId);
                customer.quotes += 1;
              } else {
                customersMap.set(brandId, {
                  id: brandId,
                  name: brandName,
                  location: quote.brandLocation || '',
                  quotes: 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: quote.createdAt || new Date()
                });
              }
            }
          });
          
          // 2. Fetch all quote messages
          const messagesRef = collection(db, 'messages');
          const customersMessagesQuery = query(
            messagesRef,
            where('recipientId', '==', user.uid),
            where('type', '==', 'quote')
          );
          const messagesSnapshot = await getDocs(customersMessagesQuery);
          
          messagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            const senderId = message.senderId;
            
            if (senderId && senderId !== user.uid) {
              const senderName = message.senderName || 'Unknown Brand';
              console.log(`DEBUG - Processing quote message from ${senderName} (${senderId})`);
              
              if (customersMap.has(senderId)) {
                const customer = customersMap.get(senderId);
                // Only increment quotes for new threads, not replies
                if (!message.replyTo) {
                  customer.quotes += 1;
                  console.log(`DEBUG - Updated quote count for ${senderName} to ${customer.quotes}`);
                }
                
                // Update lastInteraction if this message is more recent
                const messageTime = normalizeTimestamp(message.timestamp || new Date());
                const currentInteractionTime = normalizeTimestamp(customer.lastInteraction);
                
                if (messageTime > currentInteractionTime) {
                  customer.lastInteraction = messageTime;
                  console.log(`DEBUG - Updated last interaction time for ${senderName}`);
                }
              } else {
                customersMap.set(senderId, {
                  id: senderId,
                  name: senderName,
                  location: message.senderLocation || '',
                  quotes: message.replyTo ? 0 : 1, // Only count as a quote if it's not a reply
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                });
                console.log(`DEBUG - Added new customer ${senderName} from quote message`);
              }
            }
          });
          
          // Also check quote messages sent by this vendor to customers
          const outgoingQuotesQuery = query(
            messagesRef,
            where('senderId', '==', user.uid),
            where('type', '==', 'quote')
          );
          const outgoingMessagesSnapshot = await getDocs(outgoingQuotesQuery);
          
          outgoingMessagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            const recipientId = message.recipientId;
            
            if (recipientId && recipientId !== user.uid) {
              const recipientName = message.recipientName || 'Unknown Brand';
              console.log(`DEBUG - Processing outgoing quote message to ${recipientName} (${recipientId})`);
              
              if (customersMap.has(recipientId)) {
                const customer = customersMap.get(recipientId);
                // Only increment quotes if this is a new quote thread, not a reply
                if (!message.replyTo) {
                  customer.quotes += 1;
                  console.log(`DEBUG - Updated quote count for ${recipientName} to ${customer.quotes}`);
                }
                
                // Update lastInteraction if this message is more recent
                const messageTime = normalizeTimestamp(message.timestamp || new Date());
                const currentInteractionTime = normalizeTimestamp(customer.lastInteraction);
                
                if (messageTime > currentInteractionTime) {
                  customer.lastInteraction = messageTime;
                  console.log(`DEBUG - Updated last interaction time for ${recipientName}`);
                }
              } else {
                customersMap.set(recipientId, {
                  id: recipientId,
                  name: recipientName,
                  location: message.recipientLocation || '',
                  quotes: message.replyTo ? 0 : 1, // Only count as quote if it's a new thread
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                });
                console.log(`DEBUG - Added new customer ${recipientName} from outgoing quote message`);
              }
            }
          });
          
          // 3. Fetch all orders
          const ordersRef = collection(db, 'orders');
          const ordersQuery = query(
            ordersRef,
            where('vendorId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          
          ordersSnapshot.docs.forEach(docSnapshot => {
            const order = docSnapshot.data();
            const brandId = order.brandId;
            
            if (brandId && brandId !== user.uid) {
              // Log order structure for debugging
              console.log("DEBUG - Customer Table Order:", {
                orderId: order.id,
                brandId: brandId,
                total: order.total,
                totalType: typeof order.total,
                hasTotalsObj: !!order.totals,
                totalsTotal: order.totals?.total,
                totalsTotalType: typeof order.totals?.total,
                orderObj: order.order,
                orderTotal: order.order?.total,
                orderTotalsTotal: order.order?.totals?.total,
                hasItems: !!order.items,
                itemsLength: order.items?.length,
                hasNestedItems: !!order.order?.items,
                nestedItemsLength: order.order?.items?.length
              });
              
              // Use comprehensive approach for order total calculation
              let orderTotal = 0;
              
              // First check if we have a totals object with a total property
              if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                orderTotal = parseFloat(order.totals.total);
                console.log(`DEBUG - Using order.totals.total: ${orderTotal}`);
              } 
              // Then check if there's a direct total property
              else if (order.total && !isNaN(parseFloat(order.total))) {
                orderTotal = parseFloat(order.total);
                console.log(`DEBUG - Using order.total: ${orderTotal}`);
              }
              // Then check if there's a nested order object with either format
              else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
                orderTotal = parseFloat(order.order.totals.total);
                console.log(`DEBUG - Using order.order.totals.total: ${orderTotal}`);
              }
              else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
                orderTotal = parseFloat(order.order.total);
                console.log(`DEBUG - Using order.order.total: ${orderTotal}`);
              }
              // Try calculating from items if available
              else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                orderTotal = order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
                console.log(`DEBUG - Calculated total from items: ${orderTotal}`);
              }
              // Try calculating from nested items if available
              else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
                orderTotal = order.order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
                console.log(`DEBUG - Calculated total from nested items: ${orderTotal}`);
              }
              else {
                console.log(`DEBUG - No valid total found in order for brand ${brandId}`);
                // Check if there's payment info that might have amount
                if (order.payment?.amount) {
                  orderTotal = parseFloat(order.payment.amount);
                  console.log(`DEBUG - Using payment amount: ${orderTotal}`);
                } else if (order.order?.payment?.amount) {
                  orderTotal = parseFloat(order.order.payment.amount);
                  console.log(`DEBUG - Using nested payment amount: ${orderTotal}`);
                }
              }
              
              if (customersMap.has(brandId)) {
                const customer = customersMap.get(brandId);
                customer.orders += 1;
                customer.spent += orderTotal;
                console.log(`DEBUG - Updated customer ${customer.name} spent to: ${customer.spent}`);
              } else {
                customersMap.set(brandId, {
                  id: brandId,
                  name: order.brandName || 'Unknown Brand',
                  location: order.brandLocation || '',
                  quotes: 0,
                  orders: 1,
                  spent: orderTotal,
                  lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                });
                console.log(`DEBUG - Created customer ${order.brandName} with spent: ${orderTotal}`);
              }
            }
          });
          
          // 4. Also check order messages for more order data
          const orderMessagesQuery = query(
            messagesRef,
            where('recipientId', '==', user.uid),
            where('type', '==', 'order')
          );
          const orderMessagesSnapshot = await getDocs(orderMessagesQuery);
          
          // Save order messages to state for future use
          const orderMessagesArray = orderMessagesSnapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          }));
          setOrderMessages(orderMessagesArray);
          
          orderMessagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            if (message.order && message.senderId && message.senderId !== user.uid) {
              const brandId = message.senderId;
              const brandName = message.senderName || 'Unknown Brand';
              
              // Calculate order total
              let orderTotal = 0;
              const order = message.order;
              
              if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                orderTotal = parseFloat(order.totals.total);
              } else if (order.total && !isNaN(parseFloat(order.total))) {
                orderTotal = parseFloat(order.total);
              } else if (order.items && Array.isArray(order.items)) {
                orderTotal = order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
              } else if (order.payment?.amount) {
                orderTotal = parseFloat(order.payment.amount);
              }
              
              if (customersMap.has(brandId)) {
                const customer = customersMap.get(brandId);
                customer.orders += 1;
                customer.spent += orderTotal;
                console.log(`DEBUG - Updated customer ${brandName} from message spent to: ${customer.spent}`);
              } else {
                customersMap.set(brandId, {
                  id: brandId,
                  name: brandName,
                  location: message.senderLocation || '',
                  quotes: 0,
                  orders: 1,
                  spent: orderTotal,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                });
                console.log(`DEBUG - Created customer ${brandName} from message with spent: ${orderTotal}`);
              }
            }
          });
          
          if (customersMap.size > 0) {
            const customersArray = Array.from(customersMap.values())
              .sort((a, b) => {
                if (!a.lastInteraction) return 1;
                if (!b.lastInteraction) return -1;
                
                // Safely handle different types of lastInteraction
                try {
                  if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                    return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
                  } else {
                    // Convert to JavaScript Date objects and compare
                    const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                    const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                    return dateB - dateA;
                  }
                } catch (error) {
                  console.warn("Error comparing dates:", error);
                  return 0;
                }
              });
              
            // Set both the customers state and the display state
            setCustomers(customersArray);
            setDisplayCustomers(customersArray);
            customerDataCache.current = customersArray;
            saveCustomersToStorage(customersArray);
            console.log(`Refresh: Found and set ${customersArray.length} customers`);
          } else {
            // Clear customers data when no interactions are found
            setCustomers([]);
            setDisplayCustomers([]);
            customerDataCache.current = [];
            saveCustomersToStorage([]);
            console.log("No customers found in refresh");
          }
          
          setLoading(false);
        } catch (error) {
          console.error("Error refreshing customers:", error);
          setLoading(false);
        }
      };
      
      fetchCustomers();
    } else if (user?.uid && !isVendor) {
      // This is for brands - fetch vendors instead of customers
      setLoading(true);
      
      // Fetch vendors that the brand has interacted with
      const fetchVendors = async () => {
        try {
          const vendorsMap = new Map();
          
          // 1. Fetch all quote requests sent by this brand
          const quotesRef = collection(db, 'quoteRequests');
          const vendorQuotesQuery = query(quotesRef, where('brandId', '==', user.uid));
          const quotesSnapshot = await getDocs(vendorQuotesQuery);
          
          quotesSnapshot.docs.forEach(docSnapshot => {
            const quote = docSnapshot.data();
            const vendorId = quote.vendorId;
            
            if (vendorId && vendorId !== user.uid) {
              const vendorName = quote.vendorName || 'Unknown Vendor';
              
              if (vendorsMap.has(vendorId)) {
                const vendor = vendorsMap.get(vendorId);
                vendor.quotes += 1;
              } else {
                vendorsMap.set(vendorId, {
                  id: vendorId,
                  name: vendorName,
                  location: quote.vendorLocation || '',
                  quotes: 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: quote.createdAt || new Date()
                });
              }
            }
          });
          
          // 2. Fetch all quote messages sent by this brand
          const messagesRef = collection(db, 'messages');
          const vendorMessagesQuery = query(
            messagesRef,
            where('senderId', '==', user.uid),
            where('type', '==', 'quote')
          );
          const messagesSnapshot = await getDocs(vendorMessagesQuery);
          
          messagesSnapshot.docs.forEach(docSnapshot => {
            const message = docSnapshot.data();
            const recipientId = message.recipientId;
            
            if (recipientId && recipientId !== user.uid) {
              const recipientName = message.recipientName || 'Unknown Vendor';
              
              if (vendorsMap.has(recipientId)) {
                const vendor = vendorsMap.get(recipientId);
                vendor.quotes += 1;
              } else {
                vendorsMap.set(recipientId, {
                  id: recipientId,
                  name: recipientName,
                  location: message.recipientLocation || '',
                  quotes: 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                });
              }
            }
          });
          
          // 3. Fetch all orders placed by this brand
          const ordersRef = collection(db, 'orders');
          const ordersQuery = query(
            ordersRef,
            where('brandId', '==', user.uid)
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          
          ordersSnapshot.docs.forEach(docSnapshot => {
            const order = docSnapshot.data();
            const brandId = order.brandId;
            
            if (brandId && brandId !== user.uid) {
              // Log order structure for debugging
              console.log("DEBUG - Vendor Customer Table Order:", {
                orderId: docSnapshot.id,
                brandId: brandId,
                total: order.total,
                totalType: typeof order.total,
                hasTotalsObj: !!order.totals,
                totalsTotal: order.totals?.total,
                totalsTotalType: typeof order.totals?.total,
                orderObj: order.order,
                orderTotal: order.order?.total,
                orderTotalsTotal: order.order?.totals?.total,
                hasItems: !!order.items,
                itemsLength: order.items?.length,
                hasNestedItems: !!order.order?.items,
                nestedItemsLength: order.order?.items?.length
              });
              
              // Check both order.total and order.totals.total for complete amount tracking
              let orderTotal = 0;
              
              // First check if we have a totals object with a total property
              if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                orderTotal = parseFloat(order.totals.total);
                console.log(`DEBUG - Using order.totals.total: ${orderTotal}`);
              } 
              // Then check if there's a direct total property
              else if (order.total && !isNaN(parseFloat(order.total))) {
                orderTotal = parseFloat(order.total);
                console.log(`DEBUG - Using order.total: ${orderTotal}`);
              }
              // Then check if there's a nested order object with either format
              else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
                orderTotal = parseFloat(order.order.totals.total);
                console.log(`DEBUG - Using order.order.totals.total: ${orderTotal}`);
              }
              else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
                orderTotal = parseFloat(order.order.total);
                console.log(`DEBUG - Using order.order.total: ${orderTotal}`);
              }
              // Try calculating from items if available
              else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                orderTotal = order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
                console.log(`DEBUG - Calculated total from items: ${orderTotal}`);
              }
              // Try calculating from nested items if available
              else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
                orderTotal = order.order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
                console.log(`DEBUG - Calculated total from nested items: ${orderTotal}`);
              }
              else {
                console.log(`DEBUG - No valid total found in order for brand ${brandId}`);
                // Check if there's payment info that might have amount
                if (order.payment?.amount) {
                  orderTotal = parseFloat(order.payment.amount);
                  console.log(`DEBUG - Using payment amount: ${orderTotal}`);
                } else if (order.order?.payment?.amount) {
                  orderTotal = parseFloat(order.order.payment.amount);
                  console.log(`DEBUG - Using nested payment amount: ${orderTotal}`);
                }
              }
              
              // Extract vendor ID from the order
              const vendorId = order.vendorId || 
                              (order.vendor && order.vendor.id) || 
                              order.vendor_id ||
                              (order.order && order.order.vendorId);
              
              if (!vendorId) {
                console.log(`DEBUG - No vendor ID found in order:`, order.id);
                return; // Skip this order if no vendor ID
              }
              
              if (vendorsMap.has(vendorId)) {
                const vendor = vendorsMap.get(vendorId);
                vendor.orders += 1;
                vendor.spent += orderTotal;
                console.log(`DEBUG - Updated vendor spent to: ${vendor.spent}`);
              } else {
                vendorsMap.set(vendorId, {
                  id: vendorId,
                  name: order.vendorName || 'Unknown Vendor',
                  location: order.vendorLocation || '',
                  quotes: 0,
                  orders: 1,
                  spent: orderTotal,
                  lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                });
                console.log(`DEBUG - Created vendor with spent: ${orderTotal}`);
              }
            }
          });
          
          // 4. Get additional vendor information from vendor profiles
          const vendorIds = Array.from(vendorsMap.keys());
          if (vendorIds.length > 0) {
            const vendorsRef = collection(db, 'vendors');
            
            // Get vendor profiles in batches if there are many
            for (let i = 0; i < vendorIds.length; i += 10) {
              const batch = vendorIds.slice(i, i + 10);
              const vendorQuery = query(vendorsRef, where('userId', 'in', batch));
              const vendorSnapshot = await getDocs(vendorQuery);
              
              vendorSnapshot.docs.forEach(docSnapshot => {
                const vendorProfile = docSnapshot.data();
                const vendorId = vendorProfile.userId;
                
                if (vendorId && vendorsMap.has(vendorId)) {
                  const vendor = vendorsMap.get(vendorId);
                  // Update with better vendor information if available
                  vendor.name = vendorProfile.companyName || vendor.name;
                  vendor.location = vendorProfile.location || vendor.location;
                }
              });
            }
          }
          
          if (vendorsMap.size > 0) {
            const vendorsArray = Array.from(vendorsMap.values())
              .sort((a, b) => {
                if (!a.lastInteraction) return 1;
                if (!b.lastInteraction) return -1;
                
                // Safely handle different types of lastInteraction
                try {
                  if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                    return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
                  } else {
                    // Convert to JavaScript Date objects and compare
                    const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                    const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                    return dateB - dateA;
                  }
                } catch (error) {
                  console.warn("Error comparing dates:", error);
                  return 0;
                }
              });
              
            // Set both the customers state and the display state
            setCustomers(vendorsArray);
            setDisplayCustomers(vendorsArray);
            customerDataCache.current = vendorsArray;
            saveCustomersToStorage(vendorsArray);
            console.log(`Refresh: Found and set ${vendorsArray.length} vendors for brand`);
          } else {
            // Clear all vendors data when no interactions found
            setCustomers([]);
            setDisplayCustomers([]);
            customerDataCache.current = [];
            saveCustomersToStorage([]);
            console.log("No vendors found in refresh for brand");
          }
          
          setLoading(false);
        } catch (error) {
          console.error("Error refreshing vendors:", error);
          setLoading(false);
        }
      };
      
      fetchVendors();
    }
  }, [user?.uid, isVendor]);

  // New function to immediately process existing state data for customers
  const processExistingCustomerData = useCallback(() => {
    console.log("Processing existing state data for customers");
    const customersMap = new Map();
    
    // Process quote requests already in state
    if (quoteRequests && quoteRequests.length > 0) {
      console.log(`Processing ${quoteRequests.length} quote requests from state`);
      quoteRequests.forEach(quote => {
        const brandId = quote.brandId || 
                      (quote.sender && quote.sender.id) || 
                      quote.senderId;
                      
        const brandName = quote.brandName || 
                        (quote.sender && quote.sender.name) || 
                        quote.senderName || 
                        "Unknown Brand";
        
        if (brandId && brandId !== user?.uid) {
          customersMap.set(brandId, {
            id: brandId,
            name: brandName,
            location: quote.brandLocation || '',
            quotes: 1,
            orders: 0,
            spent: 0,
            lastInteraction: quote.createdAt || quote.timestamp || new Date()
          });
        }
      });
    }
    
    // Process quote messages already in state
    if (quoteMessages && quoteMessages.length > 0) {
      console.log(`Processing ${quoteMessages.length} quote messages from state`);
      quoteMessages.forEach(message => {
        if (message.senderId && message.senderId !== user?.uid) {
          if (!customersMap.has(message.senderId)) {
            customersMap.set(message.senderId, {
              id: message.senderId,
              name: message.senderName || 'Unknown Brand',
              location: message.senderLocation || '',
              quotes: 1,
              orders: 0,
              spent: 0,
              lastInteraction: message.timestamp || new Date()
            });
          }
        }
      });
    }
    
    // Process orders already in state
    if (orders && orders.length > 0) {
      console.log(`Processing ${orders.length} orders from state`);
      orders.forEach(order => {
        if (order.brandId && order.brandId !== user?.uid) {
          // Calculate order total using the same comprehensive approach
          let orderTotal = 0;
          
          // Log order for debugging
          console.log(`DEBUG - Processing in-state order:`, {
            orderId: order.id,
            brandId: order.brandId,
            total: order.total,
            hasTotalsObj: !!order.totals,
            totalsTotal: order.totals?.total,
            hasNestedOrder: !!order.order,
            nestedTotal: order.order?.total,
            nestedTotalsTotal: order.order?.totals?.total,
            hasItems: !!order.items,
            itemsCount: order.items?.length
          });
          
          // First check if we have a totals object with a total property
          if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
            orderTotal = parseFloat(order.totals.total);
            console.log(`DEBUG - Using order.totals.total: ${orderTotal}`);
          } 
          // Then check if there's a direct total property
          else if (order.total && !isNaN(parseFloat(order.total))) {
            orderTotal = parseFloat(order.total);
            console.log(`DEBUG - Using order.total: ${orderTotal}`);
          }
          // Then check if there's a nested order object with either format
          else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
            orderTotal = parseFloat(order.order.totals.total);
            console.log(`DEBUG - Using order.order.totals.total: ${orderTotal}`);
          }
          else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
            orderTotal = parseFloat(order.order.total);
            console.log(`DEBUG - Using order.order.total: ${orderTotal}`);
          }
          // Try calculating from items if available
          else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            orderTotal = order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
            console.log(`DEBUG - Calculated total from items: ${orderTotal}`);
          }
          // Try calculating from nested items if available
          else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
            orderTotal = order.order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
            console.log(`DEBUG - Calculated total from nested items: ${orderTotal}`);
          }
          else {
            console.log(`DEBUG - No valid total found for order from brand ${order.brandName || order.brandId}`);
          }
          
          if (customersMap.has(order.brandId)) {
            const customer = customersMap.get(order.brandId);
            customer.orders += 1;
            customer.spent += orderTotal;
          } else {
            customersMap.set(order.brandId, {
              id: order.brandId,
              name: order.brandName || 'Unknown Brand',
              location: order.brandLocation || '',
              quotes: 0,
              orders: 1,
              spent: orderTotal,
              lastInteraction: normalizeTimestamp(order.timestamp || new Date())
            });
          }
        }
      });
    }
    
    // Process order messages from state if available
    if (orderMessages && orderMessages.length > 0) {
      console.log(`Processing ${orderMessages.length} order messages from state`);
      orderMessages.forEach(message => {
        if (message.order && message.senderId && message.senderId !== user?.uid) {
          const brandId = message.senderId;
          const brandName = message.senderName || 'Unknown Brand';
          
          // Calculate order total
          let orderTotal = 0;
          const order = message.order;
          
          if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
            orderTotal = parseFloat(order.totals.total);
          } else if (order.total && !isNaN(parseFloat(order.total))) {
            orderTotal = parseFloat(order.total);
          } else if (order.items && Array.isArray(order.items)) {
            orderTotal = order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
          } else if (order.payment?.amount) {
            orderTotal = parseFloat(order.payment.amount);
          }
          
          if (customersMap.has(brandId)) {
            const customer = customersMap.get(brandId);
            customer.orders += 1;
            customer.spent += orderTotal;
            console.log(`DEBUG - Updated customer ${brandName} from message spent now: ${customer.spent}`);
          } else {
            customersMap.set(brandId, {
              id: brandId,
              name: brandName,
              location: message.senderLocation || '',
              quotes: 0,
              orders: 1,
              spent: orderTotal,
              lastInteraction: normalizeTimestamp(message.timestamp || new Date())
            });
            console.log(`DEBUG - Created customer ${brandName} from order message in state with spent: ${orderTotal}`);
          }
        }
      });
    }
    
    // If we found any customers, update the state immediately
    if (customersMap.size > 0) {
      const customersArray = Array.from(customersMap.values())
        .sort((a, b) => {
          if (!a.lastInteraction) return 1;
          if (!b.lastInteraction) return -1;
          
          // Safely handle different types of lastInteraction
          try {
            if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
              return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
            } else {
              // Convert to JavaScript Date objects and compare
              const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
              const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
              return dateB - dateA;
            }
          } catch (error) {
            console.warn("Error comparing dates:", error);
            return 0;
          }
        });
      
      console.log(`Setting ${customersArray.length} customers from state data`);
      setCustomers(customersArray);
    }
  }, [quoteRequests, quoteMessages, orders, orderMessages, user?.uid]);

  // Modified function to handle tab change and preserve customer data when switching tabs
  const handleTabChange = (tab) => {
    // When leaving the customers tab, save the current data to both ref and localStorage
    if (activeTab === 'customers' && tab !== 'customers') {
      console.log(`Caching ${customers.length} customers for later return to customers tab`);
      customerDataCache.current = [...customers];
      saveCustomersToStorage(customers);
    }
    
    setActiveTab(tab);
    
    // If customer tab is selected, restore cached customer data immediately from both sources
    if (tab === 'customers') {
      console.log("Customer tab selected, initiating data refresh");
      
      // First check the ref cache
      if (customerDataCache.current && customerDataCache.current.length > 0) {
        console.log(`Restoring ${customerDataCache.current.length} customers from memory cache`);
        setCustomers(customerDataCache.current);
      } 
      // Then try localStorage as a fallback
      else {
        const storedCustomers = loadCustomersFromStorage();
        if (storedCustomers && storedCustomers.length > 0) {
          // For brands, check if there are real interactions before using stored customers
          if (!isVendor) {
            const hasInteractions = orders.length > 0 || quoteRequests.length > 0;
            if (!hasInteractions) {
              console.log("No real vendor interactions when changing to vendors tab, ignoring stored data");
              // Clear all stored data
              localStorage.removeItem('cached_customers');
              setCustomers([]);
              customerDataCache.current = [];
              return;
            }
          }
          
          console.log(`Restoring ${storedCustomers.length} customers from localStorage`);
          setCustomers(storedCustomers);
          customerDataCache.current = storedCustomers;
        }
      }
      
      // Do an initial data processing from existing state
      processExistingCustomerData();
      
      // Then do a full refresh to get the latest data
      refreshCustomers();
    }
    
    if (tab === 'home') {
      navigate('/dashboard');
    } else if (tab === 'history') {
      navigate('/dashboard/history');
    } else if (tab === 'profile') {
      navigate('/dashboard/profile');
    } else if (tab === 'messages') {
      // Don't navigate if we're already on the messages tab
      if (activeTab !== 'messages') {
        navigate('/dashboard/messages');
      }
    } else if (tab === 'customers') {
      navigate('/dashboard/customers');
    } else {
      navigate(`/dashboard/${tab}`);
    }
  };
  
  // Use effect to load customers when customers tab is active
  useEffect(() => {
    if (activeTab === 'customers' && user?.uid && isVendor) {
      console.log("Customers tab activated, ensuring data is loaded");
      
      // First check the memory cache (useRef)
      if (customerDataCache.current && customerDataCache.current.length > 0) {
        console.log(`Restoring ${customerDataCache.current.length} customers from memory cache`);
        setCustomers(customerDataCache.current);
      } 
      // Then try localStorage
      else {
        const storedCustomers = loadCustomersFromStorage();
        if (storedCustomers && storedCustomers.length > 0) {
          // For brands, check if there are real interactions before using stored customers
          if (!isVendor) {
            const hasInteractions = orders.length > 0 || quoteRequests.length > 0;
            if (!hasInteractions) {
              console.log("No real vendor interactions when changing to vendors tab, ignoring stored data");
              // Clear all stored data
              localStorage.removeItem('cached_customers');
              setCustomers([]);
              customerDataCache.current = [];
              return;
            }
          }
          
          console.log(`Restoring ${storedCustomers.length} customers from localStorage`);
          setCustomers(storedCustomers);
          customerDataCache.current = storedCustomers;
        }
      }
      
      // Immediately initialize customers from existing data in state
      processExistingCustomerData();
      
      // Direct database query to fetch all potential customer data
      const fetchAllCustomerData = async () => {
        console.log("CUSTOMER DEBUG: Starting direct customer data fetch");
        try {
          const customersMap = new Map();
          
          // Initialize customersMap with any cached data
          if (customerDataCache.current && customerDataCache.current.length > 0) {
            customerDataCache.current.forEach(customer => {
              customersMap.set(customer.id, { ...customer });
            });
            console.log(`CUSTOMER DEBUG: Initialized customersMap with ${customersMap.size} cached customers`);
          } else {
            // Try loading from localStorage
            const storedCustomers = loadCustomersFromStorage();
            if (storedCustomers && storedCustomers.length > 0) {
              storedCustomers.forEach(customer => {
                customersMap.set(customer.id, { ...customer });
              });
              console.log(`CUSTOMER DEBUG: Initialized customersMap with ${customersMap.size} customers from localStorage`);
            }
          }
          
          // 1. Fetch all quote requests
          const quotesRef = collection(db, 'quoteRequests');
          const customerQuotesQuery = query(quotesRef, where('vendorId', '==', user.uid));
          const quotesSnapshot = await getDocs(customerQuotesQuery);
          console.log(`CUSTOMER DEBUG: Found ${quotesSnapshot.docs.length} quote requests`);
          
          // Initialize a map to track actual quote counts
          const brandQuoteCounts = new Map();
          
          quotesSnapshot.docs.forEach(docSnapshot => {
            const quote = { ...docSnapshot.data(), id: docSnapshot.id };
            const brandId = quote.brandId;
            
            if (brandId && brandId !== user.uid) {
              // Track this as a real quote request
              brandQuoteCounts.set(brandId, (brandQuoteCounts.get(brandId) || 0) + 1);
              
              const brandName = quote.brandName || 'Unknown Brand';
              
              if (customersMap.has(brandId)) {
                const customer = customersMap.get(brandId);
                // Set the actual quote count
                customer.quotes = brandQuoteCounts.get(brandId);
              } else {
                customersMap.set(brandId, {
                  id: brandId,
                  name: brandName,
                  location: quote.brandLocation || '',
                  quotes: 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: quote.createdAt || new Date()
                });
                console.log(`CUSTOMER DEBUG: Added customer from quote: ${brandName}`);
              }
            }
          });
          
          // Initialize a map to track actual order counts and amounts
          const brandOrderData = new Map();
          
          // 2. Process orders from OrderContext first
          if (orders && orders.length > 0) {
            console.log(`CUSTOMER DEBUG: Processing ${orders.length} orders from OrderContext`);
            orders.forEach(order => {
              console.log('CUSTOMER DEBUG: Processing order:', JSON.stringify(order));
              
              // Get the brand's ID either from brandId or by finding the brand with matching name
              const brandId = order.brandId || order.customerId;
              const vendorId = order.vendorId || user.uid; // Default to current user if vendorId not present
              
              // Only process if this order is between this vendor and this brand
              if ((brandId && brandId !== user.uid) || (order.customerName === 'BRAND')) {
                console.log(`CUSTOMER DEBUG: Valid order found for brand ${order.customerName || order.brandName}`);
                // Calculate order total with comprehensive approach
                let orderTotal = 0;
                
                // Only calculate and add to total spent if the order has been paid
                const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'completed';
                
                if (isPaid) {
                  if (order.total && !isNaN(parseFloat(order.total))) {
                    orderTotal = parseFloat(order.total);
                  }
                  else if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                    orderTotal = parseFloat(order.totals.total);
                  } 
                  else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
                    orderTotal = parseFloat(order.order.totals.total);
                  }
                  else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
                    orderTotal = parseFloat(order.order.total);
                  }
                  else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                    orderTotal = order.items.reduce((sum, item) => {
                      const price = parseFloat(item.price || item.rate || 0);
                      const quantity = parseInt(item.quantity || 1, 10);
                      return sum + (price * quantity);
                    }, 0);
                  }
                  else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
                    orderTotal = order.order.items.reduce((sum, item) => {
                      const price = parseFloat(item.price || item.rate || 0);
                      const quantity = parseInt(item.quantity || 1, 10);
                      return sum + (price * quantity);
                    }, 0);
                  }
                  else if (order.payment?.amount) {
                    orderTotal = parseFloat(order.payment.amount);
                  }
                }

                console.log(`CUSTOMER DEBUG: Order payment status: ${order.paymentStatus}, total: ${orderTotal}`);

                // Find or create the customer in our map
                const customerName = order.customerName || order.brandName || 'Unknown Brand';
                let customerId = brandId;
                
                // If we don't have a brandId, try to find the customer by name
                if (!customerId) {
                  for (const [id, customer] of customersMap.entries()) {
                    if (customer.name === customerName) {
                      customerId = id;
                      break;
                    }
                  }
                }

                // Track order count and total amount for this brand
                if (!brandOrderData.has(customerId)) {
                  brandOrderData.set(customerId, { orders: 0, spent: 0 });
                }
                const brandData = brandOrderData.get(customerId);
                brandData.orders++;
                // Only add to spent if the order is paid
                if (isPaid) {
                  brandData.spent += orderTotal;
                }
                
                if (customersMap.has(customerId)) {
                  const customer = customersMap.get(customerId);
                  customer.orders = brandData.orders;
                  customer.spent = brandData.spent;
                  console.log(`CUSTOMER DEBUG: Updated existing customer ${customer.name} with order total ${orderTotal}, total orders: ${brandData.orders}, total spent: ${brandData.spent}, payment status: ${order.paymentStatus}`);
                } else {
                  customersMap.set(customerId, {
                    id: customerId,
                    name: customerName,
                    location: order.brandLocation || order.customerLocation || '',
                    quotes: brandQuoteCounts.get(customerId) || 0,
                    orders: 1,
                    spent: orderTotal,
                    lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                  });
                  console.log(`CUSTOMER DEBUG: Added new customer ${customerName} with first order`);
                }
              } else {
                console.log(`CUSTOMER DEBUG: Skipping order - customerName: ${order.customerName}, vendorName: ${order.vendorName}, currentUser: ${user.uid}`);
              }
            });
          } else {
            console.log('CUSTOMER DEBUG: No orders found in OrderContext');
          }

          // 3. Process order messages to catch any additional orders
          const customerOrderMessagesRef = collection(db, 'messages');
          const customerOrderMessagesQuery = query(
            customerOrderMessagesRef,
            where('recipientId', '==', user.uid),
            where('type', '==', 'order')
          );
          const customerOrderMessagesSnapshot = await getDocs(customerOrderMessagesQuery);
          console.log(`CUSTOMER DEBUG: Found ${customerOrderMessagesSnapshot.docs.length} order messages`);

          customerOrderMessagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            if (message.order && message.senderId && message.senderId !== user.uid) {
              const brandId = message.senderId;
              let orderTotal = 0;

              const order = message.order;
              if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                orderTotal = parseFloat(order.totals.total);
              } 
              else if (order.total && !isNaN(parseFloat(order.total))) {
                orderTotal = parseFloat(order.total);
              }
              else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                orderTotal = order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
              }

              if (!brandOrderData.has(brandId)) {
                brandOrderData.set(brandId, { orders: 0, spent: 0 });
              }
              const brandData = brandOrderData.get(brandId);
              brandData.orders++;
              brandData.spent += orderTotal;
              console.log(`CUSTOMER DEBUG: Processed order message for brand ${message.senderName}, total: ${orderTotal}, total orders: ${brandData.orders}, total spent: ${brandData.spent}`);
            }
          });

          // Update all customers with their order data
          for (const [brandId, data] of brandOrderData.entries()) {
            if (customersMap.has(brandId)) {
              const customer = customersMap.get(brandId);
              customer.orders = data.orders;
              customer.spent = data.spent;
              console.log(`CUSTOMER DEBUG: Final update for customer ${customer.name}: ${data.orders} orders, ${data.spent} spent`);
            }
          }
          
          // 4. Process conversations to ensure we have all customers, but don't affect counts
          const customerConversationsRef = collection(db, 'conversations');
          const customerConversationsQuery = query(customerConversationsRef, 
            where('participants', 'array-contains', user.uid)
          );
          const customerConversationsSnapshot = await getDocs(customerConversationsQuery);
          console.log(`CUSTOMER DEBUG: Found ${customerConversationsSnapshot.docs.length} conversations`);
          
          customerConversationsSnapshot.docs.forEach(docSnapshot => {
            const conversation = { ...docSnapshot.data(), id: docSnapshot.id };
            const participants = conversation.participants || [];
            
            // Find the participant who isn't the current user (the customer)
            const customerId = participants.find(id => id !== user.uid);
            
            if (customerId && customerId !== user.uid) {
              // Extract customer name from participantNames if available
              let customerName = 'Unknown Brand';
              if (conversation.participantNames) {
                if (Array.isArray(conversation.participantNames)) {
                  const currentUserName = userProfile?.companyName || '';
                  customerName = conversation.participantNames.find(name => name !== currentUserName) || 'Unknown Brand';
                } else if (typeof conversation.participantNames === 'object') {
                  customerName = conversation.participantNames[customerId] || 'Unknown Brand';
                }
              }
              
              if (!customersMap.has(customerId)) {
                // Only add new customers, don't update existing ones
                customersMap.set(customerId, {
                  id: customerId,
                  name: customerName,
                  location: '',
                  quotes: brandQuoteCounts.get(customerId) || 0,
                  orders: brandOrderData.get(customerId)?.orders || 0,
                  spent: brandOrderData.get(customerId)?.spent || 0,
                  lastInteraction: normalizeTimestamp(conversation.lastMessage?.timestamp || new Date())
                });
                console.log(`CUSTOMER DEBUG: Added new customer from conversation: ${customerName}`);
              } else {
                console.log(`CUSTOMER DEBUG: Conversation found for existing customer: ${customerName}`);
              }
            }
          });
          
          // 5. Fetch all quote messages with quote type
          const messagesRef = collection(db, 'messages');
          const quoteMessagesQuery = query(
            messagesRef,
            where('type', '==', 'quote')
          );
          const messagesSnapshot = await getDocs(quoteMessagesQuery);
          console.log(`CUSTOMER DEBUG: Found ${messagesSnapshot.docs.length} quote messages`);
          
          // Track unique conversation IDs to avoid double counting quotes
          const processedConversations = new Set();
          
          messagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            
            // Determine if this message is relevant to this vendor
            const isRecipient = message.recipientId === user.uid;
            const isSender = message.senderId === user.uid;
            
            if (isRecipient || isSender) {
              // Determine the customer ID and name
              const customerId = isRecipient ? message.senderId : message.recipientId;
              const customerName = isRecipient ? message.senderName : message.recipientName;
              const conversationId = message.conversationId;
              
              if (customerId && customerId !== user.uid && conversationId) {
                if (customersMap.has(customerId)) {
                  const customer = customersMap.get(customerId);
                  // Only increment quotes for new conversations we haven't processed
                  if (!message.replyTo && !processedConversations.has(conversationId)) {
                    processedConversations.add(conversationId);
                    // Reset quotes to ensure we're not double counting
                    customer.quotes = (brandQuoteCounts.get(customerId) || 0) + 1;
                  }
                  console.log(`CUSTOMER DEBUG: Updated existing customer from quote message: ${customerName || 'Unknown'}`);
                } else if (!processedConversations.has(conversationId)) {
                  processedConversations.add(conversationId);
                  customersMap.set(customerId, {
                    id: customerId,
                    name: customerName || 'Unknown Brand',
                    location: message.senderLocation || '',
                    quotes: message.replyTo ? 0 : 1,
                    orders: 0,
                    spent: 0,
                    lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                  });
                  console.log(`CUSTOMER DEBUG: Added new customer from quote message: ${customerName || 'Unknown'}`);
                }
              }
            }
          });
          
          // 6. Also fetch direct conversations for additional customers
          const conversationsRef = collection(db, 'conversations');
          const conversationsQuery = query(conversationsRef, 
            where('participants', 'array-contains', user.uid)
          );
          const conversationsSnapshot = await getDocs(conversationsQuery);
          console.log(`CUSTOMER DEBUG: Found ${conversationsSnapshot.docs.length} conversations`);
          
          conversationsSnapshot.docs.forEach(docSnapshot => {
            const conversation = { ...docSnapshot.data(), id: docSnapshot.id };
            const participants = conversation.participants || [];
            
            // Find the participant who isn't the current user (the customer)
            const customerId = participants.find(id => id !== user.uid);
            
            if (customerId && customerId !== user.uid) {
              // Extract customer name from participantNames if available
              let customerName = 'Unknown Brand';
              if (conversation.participantNames) {
                if (Array.isArray(conversation.participantNames)) {
                  const currentUserName = userProfile?.companyName || '';
                  customerName = conversation.participantNames.find(name => name !== currentUserName) || 'Unknown Brand';
                } else if (typeof conversation.participantNames === 'object') {
                  customerName = conversation.participantNames[customerId] || 'Unknown Brand';
                }
              }
              
              if (customersMap.has(customerId)) {
                console.log(`CUSTOMER DEBUG: Conversation found for existing customer: ${customerName}`);
              } else {
                customersMap.set(customerId, {
                  id: customerId,
                  name: customerName,
                  location: '',
                  quotes: 0,
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(conversation.lastMessage?.timestamp || new Date())
                });
                console.log(`CUSTOMER DEBUG: Added new customer from conversation: ${customerName}`);
              }
            }
          });
          
          // 7. Fetch all orders from orders collection
          const ordersRef = collection(db, 'orders');
          const ordersQuery = query(
            ordersRef,
            where('vendorId', '==', user.uid),
            orderBy('timestamp', 'desc')
          );
          const ordersSnapshot = await getDocs(ordersQuery);
          console.log(`CUSTOMER DEBUG: Found ${ordersSnapshot.docs.length} orders in orders collection`);
          
          ordersSnapshot.docs.forEach(docSnapshot => {
            const order = { ...docSnapshot.data(), id: docSnapshot.id };
            const brandId = order.brandId;
            
            if (brandId && brandId !== user.uid) {
              // Calculate order total using the comprehensive approach
              let orderTotal = 0;
              
              if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                orderTotal = parseFloat(order.totals.total);
              } 
              else if (order.total && !isNaN(parseFloat(order.total))) {
                orderTotal = parseFloat(order.total);
              }
              else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
                orderTotal = parseFloat(order.order.totals.total);
              }
              else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
                orderTotal = parseFloat(order.order.total);
              }
              else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
                orderTotal = order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
              }
              else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
                orderTotal = order.order.items.reduce((sum, item) => {
                  const price = parseFloat(item.price || item.rate || 0);
                  const quantity = parseInt(item.quantity || 1, 10);
                  return sum + (price * quantity);
                }, 0);
              }
              else if (order.payment?.amount) {
                orderTotal = parseFloat(order.payment.amount);
              } 
              else if (order.order?.payment?.amount) {
                orderTotal = parseFloat(order.order.payment.amount);
              }
              
              if (customersMap.has(brandId)) {
                const customer = customersMap.get(brandId);
                customer.orders += 1;
                customer.spent += orderTotal;
                console.log(`CUSTOMER DEBUG: Updated existing customer from order: ${order.brandName || 'Unknown'}`);
              } else {
                customersMap.set(brandId, {
                  id: brandId,
                  name: order.brandName || 'Unknown Brand',
                  location: order.brandLocation || '',
                  quotes: 0,
                  orders: 1,
                  spent: orderTotal,
                  lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                });
                console.log(`CUSTOMER DEBUG: Added new customer from order: ${order.brandName || 'Unknown'}`);
              }
            }
          });
          
          // 7. Check for order messages
          const orderMessagesQuery = query(
            messagesRef,
            where('type', '==', 'order')
          );
          const orderMessagesSnapshot = await getDocs(orderMessagesQuery);
          console.log(`CUSTOMER DEBUG: Found ${orderMessagesSnapshot.docs.length} order messages`);
          
          orderMessagesSnapshot.docs.forEach(docSnapshot => {
            const message = { ...docSnapshot.data(), id: docSnapshot.id };
            // Only count orders where this vendor is the recipient of the order
            if (message.order && message.recipientId === user.uid) {
              const customerId = message.senderId;
              if (customerId && customerId !== user.uid) {
                // Calculate order total with comprehensive approach
                let orderTotal = 0;
                const order = message.order;
                
                if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
                  orderTotal = parseFloat(order.totals.total);
                } 
                else if (order.total && !isNaN(parseFloat(order.total))) {
                  orderTotal = parseFloat(order.total);
                }
                else if (order.items && Array.isArray(order.items)) {
                  orderTotal = order.items.reduce((sum, item) => {
                    const price = parseFloat(item.price || item.rate || 0);
                    const quantity = parseInt(item.quantity || 1, 10);
                    return sum + (price * quantity);
                  }, 0);
                }
                else if (order.payment?.amount) {
                  orderTotal = parseFloat(order.payment.amount);
                }
                
                if (customersMap.has(customerId)) {
                  const customer = customersMap.get(customerId);
                  customer.orders += 1;
                  customer.spent += orderTotal;
                  console.log(`CUSTOMER DEBUG: Updated existing customer from order message: ${message.senderName || 'Unknown'}`);
                } else {
                  customersMap.set(customerId, {
                    id: customerId,
                    name: message.senderName || 'Unknown Brand',
                    location: '',
                    quotes: 0,
                    orders: 1,
                    spent: orderTotal,
                    lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                  });
                  console.log(`CUSTOMER DEBUG: Added new customer from order message: ${message.senderName || 'Unknown'}`);
                }
              }
            }
          });
          
          // If we found any customers, update state immediately
          console.log(`CUSTOMER DEBUG: Total customers found: ${customersMap.size}`);
          if (customersMap.size > 0) {
            const customersArray = Array.from(customersMap.values())
              .map(customer => ({
                ...customer,
                // Convert Firebase timestamps to JS Date objects for consistent sorting
                lastInteraction: customer.lastInteraction && customer.lastInteraction.toDate 
                  ? customer.lastInteraction.toDate() 
                  : customer.lastInteraction || new Date()
              }))
              .sort((a, b) => {
                // Using vanilla JS dates for reliable sorting
                return new Date(b.lastInteraction) - new Date(a.lastInteraction);
              });
            
            console.log(`CUSTOMER DEBUG: Final customer array has ${customersArray.length} customers`);
            customersArray.forEach((customer, index) => {
              if (index < 3) { // Just log the first few for debug
                console.log(`CUSTOMER DEBUG: Customer ${index+1}: ${customer.name}, ID: ${customer.id}`);
              }
            });
            
            // Update both state variables
            setCustomers(customersArray);
            setDisplayCustomers(customersArray);
            console.log(`CUSTOMER DEBUG: State updated with ${customersArray.length} customers`);
            
            // Update both caches
            customerDataCache.current = customersArray;
            saveCustomersToStorage(customersArray);
            console.log(`CUSTOMER DEBUG: Caches updated with ${customersArray.length} customers`);
          } else {
            // Even if we didn't find customers, ensure displayCustomers is at least an empty array
            setCustomers([]);
            setDisplayCustomers([]);
            customerDataCache.current = [];
            console.log("CUSTOMER DEBUG: No customers found, set empty arrays");
          }
          
          // Finish loading
          setLoading(false);
        } catch (error) {
          console.error("CUSTOMER DEBUG: Error in direct fetch of customer data:", error);
          // In case of error, ensure displayCustomers is at least an empty array
          setCustomers([]);
          setDisplayCustomers([]);
          setLoading(false);
        }
      };
      
      // Execute the direct fetch immediately
      fetchAllCustomerData();
    }
  }, [activeTab, user?.uid, isVendor, processExistingCustomerData, loadCustomersFromStorage, saveCustomersToStorage]);

  // Function to generate unique ID for tasks
  const generateTaskId = () => `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Function to handle task creation
  const handleAddTask = async () => {
    if (!user?.uid || !taskFormData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const newTask = {
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim(),
        priority: taskFormData.priority || 'medium',
        dueDate: taskFormData.dueDate || null,
        label: taskFormData.label.trim(),
        status: 'TO_DO',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add the task to Firebase
      const docRef = await addDoc(collection(db, userType, user.uid, 'tasks'), newTask);
      
      // Reset form
      setTaskFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        label: ''
      });
      setShowAddTaskModal(false);
    } catch (error) {
      console.error('Error adding task:', error);
      alert('Failed to add task. Please try again.');
    }
  };

  // Function to handle task deletion
  const handleDeleteTask = async (listId, taskId) => {
    if (!user?.uid || !taskId) return;

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const taskRef = doc(db, userType, user.uid, 'tasks', taskId);
      await deleteDoc(taskRef);
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  // Function to handle task editing
  const handleEditTask = (listId, taskId) => {
    const task = todoLists[listId].cards.find(card => card.id === taskId);
    setEditingTask({ listId, taskId });
    setTaskFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate || '',
      label: task.label || ''
    });
    setShowAddTaskModal(true);
  };

  // Function to save edited task
  const handleSaveEdit = async () => {
    if (!editingTask?.taskId || !user?.uid || !taskFormData.title.trim()) {
      alert('Please enter a task title');
      return;
    }

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const taskRef = doc(db, userType, user.uid, 'tasks', editingTask.taskId);
      await updateDoc(taskRef, {
        title: taskFormData.title.trim(),
        description: taskFormData.description.trim(),
        priority: taskFormData.priority || 'medium',
        dueDate: taskFormData.dueDate || null,
        label: taskFormData.label.trim(),
        updatedAt: serverTimestamp()
      });

      setEditingTask(null);
      setTaskFormData({
        title: '',
        description: '',
        priority: 'medium',
        dueDate: '',
        label: ''
      });
      setShowAddTaskModal(false);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    }
  };

  // Add Firebase persistence for tasks
  useEffect(() => {
    if (!user?.uid) return;

    let unsubscribe;
    
    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const tasksRef = collection(db, userType, user.uid, 'tasks');
      
      unsubscribe = onSnapshot(
        tasksRef,
        {
          next: (snapshot) => {
            const loadedTasks = {
              'TO_DO': {
                id: 'TO_DO',
                title: 'To Do',
                cards: []
              },
              'IN_PROGRESS': {
                id: 'IN_PROGRESS',
                title: 'In Progress',
                cards: []
              },
              'DONE': {
                id: 'DONE',
                title: 'Done',
                cards: []
              }
            };

            snapshot.forEach((doc) => {
              const task = {
                id: doc.id,
                ...doc.data()
              };
              const status = task.status || 'TO_DO';
              if (loadedTasks[status]) {
                loadedTasks[status].cards.push(task);
              } else {
                // If status is invalid, default to TO_DO
                loadedTasks['TO_DO'].cards.push({
                  ...task,
                  status: 'TO_DO'
                });
              }
            });

            // Sort cards by creation date
            Object.values(loadedTasks).forEach(list => {
              list.cards.sort((a, b) => {
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
              });
            });

            setTodoLists(loadedTasks);
          },
          error: (error) => {
            console.error('Error fetching tasks:', error);
          }
        }
      );
    } catch (error) {
      console.error('Error setting up tasks listener:', error);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid, isVendor]);

  // Task board rendering
  const renderTaskBoard = () => {
    return (
      <div className="todo-board">
        {Object.values(todoLists).map((list) => (
          <div key={list.id} className="todo-column">
            <div className="column-header">
              <h3>{list.title}</h3>
              <span className="task-count">{list.cards.length}</span>
            </div>
            <Droppable droppableId={list.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`todo-list ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                >
                  {list.cards.map((card, index) => (
                    <Draggable
                      key={card.id}
                      draggableId={card.id}
                      index={index}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`todo-card ${snapshot.isDragging ? 'dragging' : ''} priority-${card.priority}`}
                        >
                          <div className="card-header">
                            {card.label && <span className="card-label">{card.label}</span>}
                            <div className="card-actions">
                              <button className="card-action-btn" onClick={() => handleEditTask(list.id, card.id)}>
                                <FaPencilAlt />
                              </button>
                              <button className="card-action-btn" onClick={() => handleDeleteTask(list.id, card.id)}>
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                          <h4 className="card-title">{card.title}</h4>
                          {card.description && <p className="card-description">{card.description}</p>}
                          {card.dueDate && (
                            <div className="card-due-date">
                              Due: {new Date(card.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        ))}
      </div>
    );
  };

  // Updated drag and drop handler
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    
    if (!destination || !user?.uid) {
      return;
    }

    try {
      // Create a deep copy of the current state
      const newTodoLists = JSON.parse(JSON.stringify(todoLists));
      
      // Find the task in the source list
      const sourceList = newTodoLists[source.droppableId];
      const [movedTask] = sourceList.cards.splice(source.index, 1);
      
      // Add task to destination list
      const destList = newTodoLists[destination.droppableId];
      destList.cards.splice(destination.index, 0, movedTask);
      
      // Update local state immediately for smooth UI
      setTodoLists(newTodoLists);

      // Update Firebase
      const userType = isVendor ? 'vendors' : 'brands';
      const taskRef = doc(db, userType, user.uid, 'tasks', draggableId);
      await updateDoc(taskRef, {
        status: destination.droppableId,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating task:', error);
      // Revert to previous state on error
      const userType = isVendor ? 'vendors' : 'brands';
      const tasksRef = collection(db, userType, user.uid, 'tasks');
      const snapshot = await getDocs(tasksRef);
      
      const loadedTasks = {
        'TO_DO': { id: 'TO_DO', title: 'To Do', cards: [] },
        'IN_PROGRESS': { id: 'IN_PROGRESS', title: 'In Progress', cards: [] },
        'DONE': { id: 'DONE', title: 'Done', cards: [] }
      };
      
      snapshot.forEach((doc) => {
        const task = { id: doc.id, ...doc.data() };
        const status = task.status || 'TO_DO';
        if (loadedTasks[status]) {
          loadedTasks[status].cards.push(task);
        }
      });
      
      setTodoLists(loadedTasks);
    }
  };

  // Update the todo section rendering to include DragDropContext and Modal
  const renderTodoSection = () => (
    <div className="todo-container">
      <div className="todo-header">
        <h2>Task Board</h2>
        <button 
          className="add-todo-btn"
          onClick={() => {
            setEditingTask(null);
            setTaskFormData({
              title: '',
              description: '',
              priority: 'medium',
              dueDate: '',
              label: ''
            });
            setShowAddTaskModal(true);
          }}
        >
          <FaPlus /> Add Task
        </button>
      </div>
      <DragDropContext onDragEnd={handleDragEnd}>
        {renderTaskBoard()}
      </DragDropContext>

      {/* Task Modal */}
      {showAddTaskModal && (
        <div className="modal-overlay">
          <div className="task-modal">
            <div className="task-modal-header">
              <h3>{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
              <button 
                className="close-modal-btn"
                onClick={() => {
                  setShowAddTaskModal(false);
                  setEditingTask(null);
                }}
              >
                ×
              </button>
            </div>
            <div className="task-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Task title"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Task description"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={taskFormData.priority}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Due Date</label>
                  <input
                    type="date"
                    value={taskFormData.dueDate}
                    onChange={(e) => setTaskFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Label</label>
                <input
                  type="text"
                  value={taskFormData.label}
                  onChange={(e) => setTaskFormData(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Add a label"
                />
              </div>
              <div className="form-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddTaskModal(false);
                    setEditingTask(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={editingTask ? handleSaveEdit : handleAddTask}
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Handle navigation state
  useEffect(() => {
    if (location.state) {
      const { activeTab: newTab, selectedChatId, openThread, forceOpen } = location.state;
      
      console.log('Dashboard received state:', location.state);
      
      if (newTab) {
        setActiveTab(newTab);
      }
      if (selectedChatId) {
        // Set the chat ID and dispatch an event to refresh the Messages component
        setSelectedChatId(selectedChatId);
        
        // Create and dispatch a custom event to tell the Messages component to open this thread
        const refreshEvent = new CustomEvent('refreshMessages', {
          detail: {
            threadId: selectedChatId,
            forceOpen: forceOpen || openThread,
          }
        });
        window.dispatchEvent(refreshEvent);
        
        console.log('Dispatched refreshMessages event for chat:', selectedChatId);
      }
      
      // Clear the navigation state
      navigate(location.pathname, { replace: true });
    }
  }, [location.state, navigate]);

  // Empty metrics data
  const [metricsData, setMetricsData] = useState({
    orders: { '7d': 0, '30d': 0, '90d': 0, 'ytd': 0, '12m': 0 },
    sales: { '7d': 0, '30d': 0, '90d': 0, 'ytd': 0, '12m': 0 },
    dailyData: []
  });

  const getDaysInMonth = (date) => {
    const start = startOfWeek(startOfMonth(date));
    const end = endOfWeek(endOfMonth(date));
    const days = eachDayOfInterval({ start, end });
    return {
      daysInMonth: days.length,
      startingDay: start.getDay(),
      days
    };
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      newDate.setMonth(prevDate.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const renderWeekView = () => {
    const start = startOfWeek(currentDate);
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const today = new Date();

    return (
      <div className="week-view">
        <div className="weekday-header">
          {weekDays.map(day => (
            <div key={day.toString()} className="weekday">
              <div className="weekday-name">{format(day, 'EEE')}</div>
              <div className={`weekday-date ${isSameDay(day, today) ? 'today' : ''}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        <div className="week-grid">
          {Array.from({ length: 24 }, (_, hour) => (
            <div key={hour} className="hour-row">
              <div className="hour-label">{hour}:00</div>
              {weekDays.map(day => {
                const dayEvents = events.filter(event => {
                  const eventDate = new Date(event.start);
                  return isSameDay(eventDate, day) && eventDate.getHours() === hour;
                });

                return (
                  <div key={day.toString()} className="hour-cell">
                    {dayEvents.map(event => (
                      <div
                        key={event.id}
                        className="calendar-event"
                        style={{ backgroundColor: event.color }}
                        onClick={() => {
                          setSelectedEvent(event);
                          setEventFormData(event);
                          setShowEventModal(true);
                        }}
                      >
                        <div className="event-title">{event.title}</div>
                        {event.location && (
                          <div className="event-location">
                            <FaMapMarkerAlt /> {event.location}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleAddEvent = async () => {
    if (!user?.uid || !eventFormData.title.trim() || !eventFormData.start) {
      alert('Please enter event title and start time');
      return;
    }

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const newEvent = {
        ...eventFormData,
        id: `event-${Date.now()}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Add the event to Firebase
      await addDoc(collection(db, userType, user.uid, 'events'), newEvent);
      
      // Reset form and close modal
      setEventFormData({
        title: '',
        description: '',
        start: '',
        end: '',
        location: '',
        color: '#FF69B4'
      });
      setShowEventModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error adding event:', error);
      alert('Failed to add event. Please try again.');
    }
  };

  // Add this function to handle event deletion
  const handleDeleteEvent = async (eventId) => {
    if (!user?.uid || !eventId) return;

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const eventRef = doc(db, userType, user.uid, 'events', eventId);
      await deleteDoc(eventRef);
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Failed to delete event. Please try again.');
    }
  };

  // Add this function to handle event editing
  const handleEditEvent = async () => {
    if (!selectedEvent?.id || !user?.uid || !eventFormData.title.trim()) {
      alert('Please enter event title');
      return;
    }

    try {
      const userType = isVendor ? 'vendors' : 'brands';
      const eventRef = doc(db, userType, user.uid, 'events', selectedEvent.id);
      await updateDoc(eventRef, {
        ...eventFormData,
        updatedAt: serverTimestamp()
      });

      setEventFormData({
        title: '',
        description: '',
        start: '',
        end: '',
        location: '',
        color: '#FF69B4'
      });
      setShowEventModal(false);
      setSelectedEvent(null);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event. Please try again.');
    }
  };

  // Add this useEffect for loading events
  useEffect(() => {
    if (!user?.uid) return;

    const userType = isVendor ? 'vendors' : 'brands';
    const eventsRef = collection(db, userType, user.uid, 'events');
    
    const unsubscribe = onSnapshot(eventsRef, (snapshot) => {
      const loadedEvents = [];
      snapshot.forEach((doc) => {
        loadedEvents.push({ id: doc.id, ...doc.data() });
      });
      setEvents(loadedEvents);
    });

    return () => unsubscribe();
  }, [user?.uid, isVendor]);

  const renderDayView = () => {
    const dayEvents = events.filter(event => isSameDay(new Date(event.start), currentDate));

    return (
      <div className="day-view">
        <div className="day-header">
          <h3>{format(currentDate, 'EEEE, MMMM d')}</h3>
        </div>
        <div className="time-slots">
          {Array.from({ length: 24 }, (_, hour) => {
            const hourEvents = dayEvents.filter(event => {
              const eventHour = new Date(event.start).getHours();
              return eventHour === hour;
            });

            return (
              <div key={hour} className="hour-slot">
                <div className="time-label">{hour}:00</div>
                <div className="event-space">
                  {hourEvents.map(event => (
                    <div
                      key={event.id}
                      className="calendar-event"
                      style={{ backgroundColor: event.color }}
                      onClick={() => {
                        setSelectedEvent(event);
                        setEventFormData(event);
                        setShowEventModal(true);
                      }}
                    >
                      <div className="event-title">{event.title}</div>
                      {event.location && (
                        <div className="event-location">
                          <FaMapMarkerAlt /> {event.location}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Check if messages was open before refresh
    const activeTab = sessionStorage.getItem('activeTab');
    if (activeTab === 'messages') {
      setActiveTab('messages');
    }
  }, []);

  const handleQuoteSubmit = async (quoteData) => {
    try {
      console.log('Quote submission data:', quoteData);
      
      // If there's a selected vendor, create a conversation and send the quote
      if (quoteData.selectedVendor && quoteData.selectedVendor.id) {
        console.log('Creating quote for vendor:', quoteData.selectedVendor);
        console.log('Current user (brand) ID:', user.uid);
        
        // Create or get conversation with the vendor
        const conversationRef = collection(db, 'conversations');
        
        // First, try to find an existing conversation between this brand and vendor
        const q = query(
          conversationRef,
          where('participants', 'array-contains', user.uid),
          where('vendorId', '==', quoteData.selectedVendor.id)
        );
        
        let conversationId;
        const querySnapshot = await getDocs(q);
        
        console.log('Found conversations count:', querySnapshot.size);
        
        if (querySnapshot.empty) {
          console.log('No existing conversation found, creating new one');
          // Create new conversation
          const newConversation = {
            participants: [user.uid, quoteData.selectedVendor.id],
            participantNames: [userProfile.companyName, quoteData.selectedVendor.companyName],
            brandId: user.uid,
            vendorId: quoteData.selectedVendor.id,
            lastMessage: 'Sent a quote request',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            unreadCount: {
              [user.uid]: 0,
              [quoteData.selectedVendor.id]: 1
            }
          };
          
          const convDoc = await addDoc(conversationRef, newConversation);
          conversationId = convDoc.id;
          console.log('Created new conversation:', conversationId);
        } else {
          // Get the first matching conversation
          const existingConversation = querySnapshot.docs[0];
          conversationId = existingConversation.id;
          console.log('Using existing conversation:', conversationId);
          
          // Update the existing conversation's last message
          await updateDoc(doc(db, 'conversations', conversationId), {
            lastMessage: 'Sent a quote request',
            lastMessageAt: serverTimestamp(),
            [`unreadCount.${quoteData.selectedVendor.id}`]: increment(1)
          });
        }

        // Create the quote message
        console.log('Creating quote message for conversation:', conversationId);
        const messageData = {
          type: 'quote',
          senderId: user.uid,
          senderName: userProfile.companyName,
          recipientId: quoteData.selectedVendor.id,
          recipientName: quoteData.selectedVendor.companyName,
          conversationId: conversationId,
          content: 'Sent a quote request',
          quoteDetails: quoteData.quoteDetails,
          timestamp: serverTimestamp(),
          readBy: [user.uid]
        };

        // Add the message to the messages collection
        const messageDoc = await addDoc(collection(db, 'messages'), messageData);
        console.log('Created message:', messageDoc.id);

        // Close the form and navigate to the conversation
        setShowQuoteForm(false);
        setSelectedChatId(conversationId);
        setShouldOpenThread(true);
        
        // Navigate to messages tab with the conversation ID
        navigate('/dashboard/messages', {
          state: {
            selectedChatId: conversationId,
            openThread: true
          }
        });
      } else {
        console.error('No vendor selected or invalid vendor data:', quoteData.selectedVendor);
        alert('Please select a vendor to send the quote request.');
      }
    } catch (error) {
      console.error('Error submitting quote:', error);
      alert('Failed to submit quote request. Please try again.');
    }
  };

  // Use useEffect to sync with URL on initial load
  useEffect(() => {
    const path = window.location.pathname;
    console.log('Current path:', path); // Debug log
    
    if (path.includes('/dashboard/orders')) {
      setActiveTab('orders');
    } else if (path.includes('/dashboard/messages')) {
      setActiveTab('messages');
    } else if (path.includes('/dashboard/customers')) {
      setActiveTab('customers');
    } else if (path.includes('/dashboard/history')) {
      setActiveTab('history');
    } else if (path.includes('/dashboard/profile')) {
      setActiveTab('profile');
      navigate('/dashboard/profile', { replace: true });
    } else {
      setActiveTab('home');
    }
  }, [navigate]);

  // Update useEffect to process orders from context
  useEffect(() => {
    if (contextOrders) {
      const processedOrders = contextOrders.map(order => {
        // Log the raw order data to debug
        console.log('Processing order:', order);

        // Try to get total from different possible locations
        let total = 0;
        
        // Check if total exists directly in order.totals
        if (order.totals?.total) {
          total = order.totals.total;
        } 
        // If not, check if we need to calculate from quoteDetails
        else if (order.quoteDetails?.total) {
          total = order.quoteDetails.total;
        }
        // If still no total, calculate from items
        else if (order.items?.length > 0) {
          total = order.items.reduce((sum, item) => {
            const itemPrice = item.price || item.rate || 0;
            const itemQuantity = parseInt(item.quantity) || 0;
            return sum + (itemPrice * itemQuantity);
          }, 0);
        }

        // Get total items count from quantities if it exists
        let totalItems = 0;
        if (order.quoteDetails?.quantities) {
          totalItems = Object.values(order.quoteDetails.quantities)
            .reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
        } else if (order.items) {
          totalItems = order.items.reduce((sum, item) => 
            sum + (parseInt(item.quantity) || 0), 0);
        }

        // Handle the createdAt timestamp properly
        let orderDate;
        if (order.createdAt?.toDate) {
          // If it's a Firestore timestamp
          orderDate = order.createdAt.toDate();
        } else if (order.createdAt?.seconds) {
          // If it's a timestamp object with seconds
          orderDate = new Date(order.createdAt.seconds * 1000);
        } else if (order.createdAt) {
          // If it's already a Date or can be converted to one
          orderDate = new Date(order.createdAt);
        } else {
          // Fallback to current date
          orderDate = new Date();
        }

        return {
          id: order.id,
          orderNumber: order.orderNumber || 'N/A',
          date: orderDate,
          customerName: order.customer?.name || order.customerName || 'N/A',
          vendorName: order.vendor?.name || order.vendorName || 'N/A',
          total: total,
          paymentStatus: order.status?.payment || 'pending',
          fulfillmentStatus: order.status?.fulfillment || 'unfulfilled',
          items: totalItems,
          deliveryMethod: order.shipping?.method || 'UPS Ground'
        };
      });

      // Sort orders by date in descending order (newest first)
      const sortedOrders = processedOrders.sort((a, b) => b.date - a.date);
      setOrders(sortedOrders);

      // Update stats
      setStats({
        totalOrders: processedOrders.length,
        fulfilledOrders: processedOrders.filter(o => o.fulfillmentStatus === 'fulfilled').length,
        pendingOrders: processedOrders.filter(o => o.fulfillmentStatus === 'unfulfilled').length
      });
    }
  }, [contextOrders]);

  const handleOrderClick = async (order) => {
    // Get the complete original order from contextOrders
    const originalOrder = contextOrders.find(o => o.orderNumber === order.orderNumber);
    console.log('Found original order:', originalOrder);

    if (!originalOrder) {
      console.error('Could not find original order with number:', order.orderNumber);
      return;
    }

    try {
      // Find the corresponding message order using the order number
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('type', '==', 'order'), where('order.orderNumber', '==', order.orderNumber));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // Use the first matching message order
        const messageOrder = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
        console.log('Found corresponding message order:', messageOrder);
        
        setSelectedOrderData(messageOrder);
        setShowOrderOverview(true);
      } else {
        console.log('No corresponding message order found, using original order');
        // Fallback to original format if no message order found
        const messageForModal = {
          id: originalOrder.id,
          type: 'order',
          order: {
            ...originalOrder,
            id: originalOrder.id,
            orderNumber: originalOrder.orderNumber,
            status: originalOrder.status || {
              payment: 'pending',
              fulfillment: 'unfulfilled'
            }
          },
          senderId: originalOrder.vendorId,
          senderName: originalOrder.vendorName || 'Vendor',
          timestamp: originalOrder.createdAt,
          conversationId: originalOrder.conversationId
        };
        
        setSelectedOrderData(messageForModal);
        setShowOrderOverview(true);
      }
    } catch (error) {
      console.error('Error finding message order:', error);
      // Fallback to original format if error occurs
      const messageForModal = {
        id: originalOrder.id,
        type: 'order',
        order: {
          ...originalOrder,
          id: originalOrder.id,
          orderNumber: originalOrder.orderNumber,
          status: originalOrder.status || {
            payment: 'pending',
            fulfillment: 'unfulfilled'
          }
        },
        senderId: originalOrder.vendorId,
        senderName: originalOrder.vendorName || 'Vendor',
        timestamp: originalOrder.createdAt,
        conversationId: originalOrder.conversationId
      };
      
      setSelectedOrderData(messageForModal);
      setShowOrderOverview(true);
    }
  };

  useEffect(() => {
    // Log the first message from contextOrders to see its structure
    if (contextOrders?.length > 0) {
      console.log('Example working order structure:', contextOrders[0]);
    }
  }, [contextOrders]);

  // Add handleFilterChange function
  const handleFilterChange = (category, value) => {
    console.log('Filter changed:', category, value); // Debug log
    setSelectedFilters(prev => {
      const updatedFilters = { ...prev };
      const index = updatedFilters[category].indexOf(value);
      
      if (index === -1) {
        updatedFilters[category] = [...updatedFilters[category], value];
      } else {
        updatedFilters[category] = updatedFilters[category].filter(item => item !== value);
      }
      
      return updatedFilters;
    });
  };

  // Update getFilteredOrders function
  const getFilteredOrders = () => {
    // Return empty array if orders is undefined or null
    if (!Array.isArray(orders)) return [];
    
    let filteredOrders = [...orders];

    // Apply search filter
    if (filterValue) {
      const searchLower = filterValue.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.orderNumber?.toString().toLowerCase().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.total?.toString().includes(searchLower)
      );
    }

    // Apply status filters
    if (selectedFilters.status?.length > 0) {
      filteredOrders = filteredOrders.filter(order => {
        return selectedFilters.status.some(status => {
          switch (status) {
            case 'pending':
              return order.paymentStatus === 'pending';
            case 'fulfilled':
              return order.fulfillmentStatus === 'fulfilled';
            case 'unfulfilled':
              return order.fulfillmentStatus === 'unfulfilled';
            default:
              return true;
          }
        });
      });
    }

    // Apply date filters
    if (selectedFilters.date?.length > 0) {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfQuarter = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);

      filteredOrders = filteredOrders.filter(order => {
        return selectedFilters.date.some(dateFilter => {
          const orderDate = order.date instanceof Date ? order.date : new Date(order.date);
          switch (dateFilter) {
            case 'today':
              return orderDate.toDateString() === today.toDateString();
            case 'week':
              return orderDate >= startOfWeek;
            case 'month':
              return orderDate >= startOfMonth;
            case 'quarter':
              return orderDate >= startOfQuarter;
            default:
              return true;
          }
        });
      });
    }

    return filteredOrders;
  };

  // Add new useEffect to handle click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const filterContainer = document.querySelector('.filter-dropdown');
      if (filterContainer && !filterContainer.contains(event.target) && !event.target.matches('.filter-button')) {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update the metrics calculation useEffect
  useEffect(() => {
    if (!orders.length) return;

    const now = new Date();
    const metricsDataTemp = {
      orders: { '7d': 0, '30d': 0, '90d': 0, 'ytd': 0, '12m': 0 },
      sales: { '7d': 0, '30d': 0, '90d': 0, 'ytd': 0, '12m': 0 },
      dailyData: []
    };

    // Create a map to store daily totals
    const dailyTotals = new Map();

    orders.forEach(order => {
      const orderDate = new Date(order.date);
      const daysDiff = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
      const total = order.total || 0;

      // Format date for daily data
      const dateKey = orderDate.toISOString().split('T')[0];
      if (!dailyTotals.has(dateKey)) {
        dailyTotals.set(dateKey, { date: dateKey, orders: 0, sales: 0 });
      }
      const dayData = dailyTotals.get(dateKey);
      dayData.orders++;
      dayData.sales += total;

      // Update period totals
      if (daysDiff <= 7) {
        metricsDataTemp.orders['7d']++;
        metricsDataTemp.sales['7d'] += total;
      }
      if (daysDiff <= 30) {
        metricsDataTemp.orders['30d']++;
        metricsDataTemp.sales['30d'] += total;
      }
      if (daysDiff <= 90) {
        metricsDataTemp.orders['90d']++;
        metricsDataTemp.sales['90d'] += total;
      }
      if (orderDate.getFullYear() === now.getFullYear()) {
        metricsDataTemp.orders['ytd']++;
        metricsDataTemp.sales['ytd'] += total;
      }
      if (daysDiff <= 365) {
        metricsDataTemp.orders['12m']++;
        metricsDataTemp.sales['12m'] += total;
      }
    });

    // Convert daily totals to array and sort by date
    metricsDataTemp.dailyData = Array.from(dailyTotals.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    setMetricsData(metricsDataTemp);
  }, [orders]);

  // Add this function to handle date selection
  const handleDateSelect = (date) => {
    setCurrentDate(date);
    setCalendarView('day');
  };

  // Update the renderMonthView function
  const renderMonthView = () => {
    const { days } = getDaysInMonth(currentDate);
    const today = new Date();

    return (
      <div className="month-view">
        <div className="weekday-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        <div className="days-grid">
          {days.map((date, index) => {
            const isCurrentMonth = isSameMonth(date, currentDate);
            const isToday = isSameDay(date, today);
            const dayEvents = events.filter(event => isSameDay(new Date(event.start), date));

            return (
              <div 
                key={index}
                className={`calendar-day ${isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''}`}
                onClick={() => handleDateSelect(date)}
              >
                <span className="day-number">{format(date, 'd')}</span>
                <div className="day-events">
                  {dayEvents.map(event => (
                    <div
                      key={event.id}
                      className="calendar-event"
                      style={{ backgroundColor: event.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                        setEventFormData(event);
                        setShowEventModal(true);
                      }}
                    >
                      <span className="event-time">
                        {format(new Date(event.start), 'HH:mm')}
                      </span>
                      <span className="event-title">{event.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Add useEffect for fetching quote requests
  useEffect(() => {
    if (!user) return;

    // Determine if user is a vendor or brand
    const isVendor = userProfile?.userType === 'vendor';
    
    console.log(`Setting up quote request listeners for ${isVendor ? 'vendor' : 'brand'}:`, user.uid);

    // Set up listeners for quote requests from messages collection
    let quotesMessagesQuery;
    if (isVendor) {
      // For vendors - show quotes they've received from brands
      quotesMessagesQuery = query(
      collection(db, 'messages'),
      where('type', '==', 'quote'),
      where('recipientId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    } else {
      // For brands - show quotes they've sent to vendors
      quotesMessagesQuery = query(
        collection(db, 'messages'),
        where('type', '==', 'quote'),
        where('senderId', '==', user.uid),
        orderBy('timestamp', 'desc')
      );
    }

    // Set up listeners for quote requests from quoteRequests collection
    let quotesRequestsQuery;
    if (isVendor) {
      // For vendors - show quotes they've received from brands
      quotesRequestsQuery = query(
      collection(db, 'quoteRequests'),
      where('vendorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    } else {
      // For brands - show quotes they've sent to vendors
      quotesRequestsQuery = query(
        collection(db, 'quoteRequests'),
        where('brandId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    // Subscribe to quote requests from messages
    const unsubscribeQuotesMessages = onSnapshot(quotesMessagesQuery, async (snapshot) => {
      console.log('Quote messages snapshot size:', snapshot.size);
      
      try {
        // Process quotes from messages
        const quotesFromMessages = snapshot.docs.map(docSnapshot => {
          const data = docSnapshot.data();
          console.log('Processing quote message:', data);
          
          // Calculate total quantity
          const totalQuantity = data.quoteDetails?.quantity || 
            (data.quoteDetails?.quantities 
              ? Object.values(data.quoteDetails.quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0)
              : 0);

          return {
            id: docSnapshot.id,
            source: 'messages',
            ...data,
            date: data.timestamp?.toDate() || new Date(),
            senderName: data.senderName || 'N/A',
            recipientName: data.recipientName || 'N/A',
            vendorName: data.recipientName || 'N/A',
            quoteDetails: {
              ...data.quoteDetails,
              date: data.timestamp?.toDate() || new Date(),
              status: data.quoteDetails?.status || 'pending',
              serviceRequired: data.quoteDetails?.serviceRequired || data.quoteDetails?.services?.[0]?.service || 'N/A',
              timeline: data.quoteDetails?.timeline || 'Standard',
              quantity: totalQuantity
            }
          };
        });

        // Now fetch conversation data for each quote from messages
        const quotesWithConversations = await Promise.all(quotesFromMessages.map(async (quote) => {
          if (quote.conversationId) {
            try {
              const conversationRef = doc(db, 'conversations', quote.conversationId);
              const conversationSnap = await getDoc(conversationRef);
              
              if (conversationSnap.exists()) {
                const conversationData = conversationSnap.data();
                console.log('Found conversation data:', {
                  id: quote.conversationId,
                  data: conversationData
                });

                // For vendors, get the brand name; for brands, get the vendor name
                const isVendor = userProfile?.userType === 'vendor';
                const otherPartyName = Array.isArray(conversationData.participantNames) 
                  ? conversationData.participantNames.find(name => name !== userProfile?.companyName)
                  : null;

                if (isVendor) {
                return {
                  ...quote,
                    senderName: otherPartyName || quote.senderName || 'N/A'
                };
                } else {
                  return {
                    ...quote,
                    recipientName: otherPartyName || quote.recipientName || 'N/A',
                    vendorName: otherPartyName || quote.vendorName || 'N/A'
                  };
                }
              }
            } catch (error) {
              console.error('Error fetching conversation:', error);
            }
          }
          return quote;
        }));

        // Subscribe to quote requests from quoteRequests collection
        const unsubscribeQuotesRequests = onSnapshot(quotesRequestsQuery, (snapshot) => {
          console.log('Quote requests snapshot size:', snapshot.size);
          
          // Process quotes from quoteRequests
          const quotesFromRequests = snapshot.docs.map(doc => {
            const data = doc.data();
            console.log('Processing quote request:', {id: doc.id, ...data});

            // Calculate total quantity from services array with proper type checking
            let totalQuantity = 0;
            if (Array.isArray(data.services)) {
              totalQuantity = data.services.reduce((sum, service) => {
                if (service.quantities && typeof service.quantities === 'object') {
                  return sum + Object.values(service.quantities).reduce((qty, val) => qty + (parseInt(val) || 0), 0);
                }
                return sum + (parseInt(service.totalQuantity) || 0);
              }, 0);
            } else if (data.quantities && typeof data.quantities === 'object') {
              // Handle case where quantities might be at the root level
              totalQuantity = Object.values(data.quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
            } else if (data.totalQuantity) {
              // Handle case where there's just a single totalQuantity field
              totalQuantity = parseInt(data.totalQuantity) || 0;
            }

            // Get service required with proper type checking
            let serviceRequired = 'Not specified';
            if (Array.isArray(data.services) && data.services.length > 0) {
              serviceRequired = data.services[0].service || data.services[0].name || 'Not specified';
            } else if (typeof data.serviceRequired === 'string') {
              serviceRequired = data.serviceRequired;
            }

            return {
              id: doc.id,
              source: 'quoteRequests',
              date: data.createdAt?.toDate() || new Date(),
              senderName: data.brandName || 'Unknown Brand',
              recipientName: data.vendorName || 'Unknown Vendor',
              vendorName: data.vendorName || 'Unknown Vendor',
              quoteDetails: {
                serviceRequired: serviceRequired,
                quantity: totalQuantity,
                timeline: data.deadline ? new Date(data.deadline).toLocaleDateString() : 'Not specified',
                status: data.status || 'pending',
                date: data.createdAt?.toDate() || new Date()
              }
            };
          });

          // Combine quotes from both sources and update state
          const allQuotes = [...quotesWithConversations, ...quotesFromRequests];
          console.log('All combined quotes:', allQuotes);
          
          setQuoteRequests(allQuotes);
          setStats(prev => ({
            ...prev,
            totalQuotes: allQuotes.length,
            pendingQuotes: allQuotes.filter(q => q.quoteDetails?.status === 'pending').length,
            acceptedQuotes: allQuotes.filter(q => q.quoteDetails?.status === 'accepted').length
          }));
          setLoading(false);
        });

        return () => {
          unsubscribeQuotesMessages();
          unsubscribeQuotesRequests();
        };
      } catch (error) {
        console.error('Error processing quotes:', error);
        setLoading(false);
      }
    });

    return () => unsubscribeQuotesMessages();
  }, [user, userProfile?.companyName, userProfile?.userType]);

  // Function to get filtered quotes
  const getFilteredQuotes = () => {
    const isVendor = userProfile?.userType === 'vendor';
    if (!quoteRequests) return [];
    
    return quoteRequests.filter(quote => {
      const searchLower = searchTerm.toLowerCase();
      const serviceRequired = quote.quoteDetails?.serviceRequired?.toLowerCase() || '';
      
      if (isVendor) {
        // For vendors - search by service and brand name
        const brandName = quote.senderName?.toLowerCase() || '';
        return serviceRequired.includes(searchLower) || brandName.includes(searchLower);
      } else {
        // For brands - search by service and vendor name
        const vendorName = quote.recipientName?.toLowerCase() || '';
      return serviceRequired.includes(searchLower) || vendorName.includes(searchLower);
      }
    });
  };

  // Add archived items state
  const [archivedOrders, setArchivedOrders] = useState([]);
  const [archivedQuotes, setArchivedQuotes] = useState([]);
  const [archivedFiles, setArchivedFiles] = useState([]);
  const [archivedMessages, setArchivedMessages] = useState([]);

  // Function to handle archiving items
  const handleArchiveItem = async (type, item) => {
    try {
      const archivedAt = new Date().toISOString();
      const archiveData = {
        ...item,
        archivedAt,
        status: 'archived'
      };

      // Add to archived collection
      await addDoc(collection(db, `archived_${type}`), archiveData);
      
      // Remove from original collection
      await deleteDoc(doc(db, type, item.id));

      // Show success message
      alert(`${type.charAt(0).toUpperCase() + type.slice(1)} archived successfully`);
    } catch (error) {
      console.error('Error archiving item:', error);
      alert('Failed to archive item');
    }
  };

  // Function to restore archived items
  const handleRestoreItem = async (type, item) => {
    try {
      // Get the archived item
      const archivedRef = doc(db, `archived_${type}`, item.id);
      const archivedDoc = await getDoc(archivedRef);
      
      if (!archivedDoc.exists()) {
        throw new Error('Archived item not found');
      }

      const itemData = archivedDoc.data();

      // Determine the target collection and prepare restore data
      let targetCollection = 'messages';  // Since quotes are stored in messages collection
      let restoreData = { ...itemData };

      // Remove archive-specific fields
      delete restoreData.archivedAt;
      delete restoreData.archivedBy;
      delete restoreData.archivedByName;
      delete restoreData.originalQuoteId;
      delete restoreData.status;

      // For quotes, ensure the message type and other required fields are set
      if (type === 'quotes') {
        restoreData = {
          ...restoreData,
          type: 'quote',
          timestamp: serverTimestamp(),
          readBy: [user.uid]
        };

        // Ensure quoteDetails has the correct structure
        if (restoreData.quoteDetails) {
          restoreData.quoteDetails = {
            ...restoreData.quoteDetails,
            status: 'pending'  // Reset status to pending when restored
          };
        }
      }

      // Add back to messages collection
      const restoredDoc = await addDoc(collection(db, targetCollection), restoreData);
      console.log('Restored document with ID:', restoredDoc.id);
      
      // Delete from archived collection
      await deleteDoc(archivedRef);

      // Update local state
      setArchivedQuotes(prev => prev.filter(i => i.id !== item.id));

      toast.success(`Quote restored successfully`);
    } catch (error) {
      console.error('Error restoring item:', error);
      toast.error(`Failed to restore quote: ${error.message}`);
    }
  };

  // Function to permanently delete archived items
  const handleDeleteItem = async (item, type) => {
    console.log('Attempting to delete item:', item);
    
    if (!item || !item.id) {
      console.error('Invalid item data:', item);
      toast.error('Invalid item data');
      return;
    }

    if (!window.confirm('Are you sure you want to permanently delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      // Get reference to the archived document
      const docRef = doc(db, 'archived_quotes', item.id);
      console.log('Document reference created:', docRef);
      
      // Check if document exists
      const docSnap = await getDoc(docRef);
      console.log('Document snapshot:', docSnap.exists());
      
      if (!docSnap.exists()) {
        throw new Error('Archived item not found');
      }

      // Delete the document
      await deleteDoc(docRef);
      console.log('Document deleted successfully');
      
      // Update local state to remove the deleted item
      setArchivedQuotes(prev => {
        const newQuotes = prev.filter(quote => quote.id !== item.id);
        console.log('Updated archived quotes:', newQuotes);
        return newQuotes;
      });
      
      toast.success('Item deleted successfully');
      
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Error deleting item: ${error.message}`);
    }
  };

  // Fetch archived items when the history tab is active
  useEffect(() => {
    if (activeTab !== 'history') return;

    const fetchArchivedItems = async () => {
      try {
        // Fetch archived quotes
        try {
          const quotesRef = collection(db, 'archived_quotes');
          const q = query(quotesRef, where('archivedBy', '==', user.uid));
          const quotesSnapshot = await getDocs(q);
          const quotesData = quotesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log('Fetched archived quotes:', quotesData);
          setArchivedQuotes(quotesData);
        } catch (error) {
          console.error('Error fetching archived quotes:', error);
          setArchivedQuotes([]);
        }

        // Fetch archived orders
        try {
          const ordersSnapshot = await getDocs(collection(db, 'archived_orders'));
          setArchivedOrders(ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error('Error fetching archived orders:', error);
          setArchivedOrders([]);
        }

        // Fetch archived files
        try {
          const filesSnapshot = await getDocs(collection(db, 'archived_files'));
          setArchivedFiles(filesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error('Error fetching archived files:', error);
          setArchivedFiles([]);
        }

        // Fetch archived messages
        try {
          const messagesSnapshot = await getDocs(collection(db, 'archived_messages'));
          setArchivedMessages(messagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
          console.error('Error fetching archived messages:', error);
          setArchivedMessages([]);
        }
      } catch (error) {
        console.error('Error in fetchArchivedItems:', error);
        setArchivedQuotes([]);
        setArchivedOrders([]);
        setArchivedFiles([]);
        setArchivedMessages([]);
      }
    };

    // Add a small delay to ensure Firestore rules are loaded
    const timer = setTimeout(() => {
      fetchArchivedItems();
    }, 100);

    return () => clearTimeout(timer);
  }, [activeTab, user?.uid]);

  const handleArchiveOrder = async (orderId) => {
    try {
      // Get the order to archive
      const orderToArchive = orders.find(order => order.id === orderId);
      if (!orderToArchive) {
        console.error('Order not found');
        return;
      }

      // Create archived order document
      const archivedOrder = {
        ...orderToArchive,
        originalOrderId: orderId,
        archivedAt: serverTimestamp(),
        archivedBy: user.uid,
        archivedByName: userProfile.companyName
      };

      // Add to archived_orders collection
      await addDoc(collection(db, 'archived_orders'), archivedOrder);

      // Delete the original order
      await deleteDoc(doc(db, 'orders', orderId));

      // If the order was from a message, also archive the message
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('type', '==', 'order'), where('order.orderNumber', '==', orderToArchive.orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const messageDoc = querySnapshot.docs[0];
        const messageData = messageDoc.data();
        
        // Archive the message
        await addDoc(collection(db, 'archived_messages'), {
          ...messageData,
          originalMessageId: messageDoc.id,
          archivedAt: serverTimestamp(),
          archivedBy: user.uid,
          archivedByName: userProfile.companyName
        });
        
        // Delete the original message
        await deleteDoc(doc(db, 'messages', messageDoc.id));
      }

      // Update local state
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      toast.success('Order archived successfully');
    } catch (error) {
      console.error('Error archiving order:', error);
      toast.error('Failed to archive order');
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }

    try {
      // Get the order to delete
      const orderToDelete = orders.find(order => order.id === orderId);
      if (!orderToDelete) {
        console.error('Order not found');
        return;
      }

      // Delete the order
      await deleteDoc(doc(db, 'orders', orderId));

      // If the order was from a message, also delete the message
      const messagesRef = collection(db, 'messages');
      const q = query(messagesRef, where('type', '==', 'order'), where('order.orderNumber', '==', orderToDelete.orderNumber));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const messageDoc = querySnapshot.docs[0];
        await deleteDoc(doc(db, 'messages', messageDoc.id));
      }

      // Update local state
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      
      toast.success('Order deleted successfully');
    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error('Failed to delete order');
    }
  };

  const handleArchiveQuote = async (quoteId) => {
    try {
      // Get the quote document from messages collection
      const quoteRef = doc(db, 'messages', quoteId);
      const quoteSnap = await getDoc(quoteRef);
      
      if (!quoteSnap.exists()) {
        console.error('Quote not found');
        return;
      }

      const quoteData = quoteSnap.data();
      
      // Check if already archived
      const archivedQuotesRef = collection(db, 'archived_quotes');
      const q = query(archivedQuotesRef, where('originalQuoteId', '==', quoteId));
      const archivedQuoteSnap = await getDocs(q);
      
      if (!archivedQuoteSnap.empty) {
        console.log('Quote already archived');
        return;
      }

      // Create archived quote document
      const archivedQuote = {
        ...quoteData,
        originalQuoteId: quoteId,
        archivedAt: serverTimestamp(),
        archivedBy: user.uid,
        archivedByName: userProfile.companyName,
        status: 'archived'
      };

      // Add to archived_quotes collection
      await addDoc(collection(db, 'archived_quotes'), archivedQuote);

      // Delete the original quote from messages collection
      await deleteDoc(quoteRef);

      // Update local state
      setQuoteRequests(prevQuotes => prevQuotes.filter(quote => quote.id !== quoteId));
      
      toast.success('Quote archived successfully');
    } catch (error) {
      console.error('Error archiving quote:', error);
      toast.error('Failed to archive quote');
    }
  };

  const handleDeleteQuote = async (quoteId) => {
    if (window.confirm('Are you sure you want to delete this quote? This action cannot be undone.')) {
      try {
        // Delete from Firestore
        await deleteDoc(doc(db, 'messages', quoteId));
        
        // Update local state
        setQuoteRequests(prevQuotes => prevQuotes.filter(quote => quote.id !== quoteId));
        
        toast.success('Quote deleted successfully');
      } catch (error) {
        console.error('Error deleting quote:', error);
        toast.error('Failed to delete quote');
      }
    }
  };

  // Real-time updates for new customer interactions
  useEffect(() => {
    if (!user?.uid || !isVendor) return;
    
    const unsubscribers = [];
    
    console.log("Setting up real-time listeners for vendor:", user.uid);
    
    // Listen for new messages
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(
      messagesRef,
      where('recipientId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const message = change.doc.data();
          
          if (message.senderId && message.senderId !== user.uid) {
            // Check if this brand is already in our customers list
            setCustomers(prevCustomers => {
              const existingCustomer = prevCustomers.find(c => c.id === message.senderId);
              
              if (existingCustomer) {
                // Customer exists - don't need to update anything for simple message
                return prevCustomers;
              } else {
                // New customer
                const newCustomer = {
                  id: message.senderId,
                  name: message.senderName || 'Unknown Brand',
                  location: message.senderLocation || '',
                  quotes: 0,
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                };
                
                return [newCustomer, ...prevCustomers];
              }
            });
          }
        }
      });
    }, error => {
      console.error("Error listening for new messages:", error);
    });
    
    unsubscribers.push(messagesUnsubscribe);
    
    // Listen for new quotes
    const quotesRef = collection(db, 'quoteRequests');
    const quotesQuery = query(
      quotesRef,
      where('vendorId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const quotesUnsubscribe = onSnapshot(quotesQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const quote = change.doc.data();
          console.log("New quote request received:", quote);
          
          if (quote.brandId && quote.brandId !== user.uid) {
            // Update customers list
            setCustomers(prevCustomers => {
              const existingCustomerIndex = prevCustomers.findIndex(c => c.id === quote.brandId);
              
              if (existingCustomerIndex >= 0) {
                // Update existing customer
                const updatedCustomers = [...prevCustomers];
                updatedCustomers[existingCustomerIndex] = {
                  ...updatedCustomers[existingCustomerIndex],
                  quotes: (updatedCustomers[existingCustomerIndex].quotes || 0) + 1,
                  lastInteraction: normalizeTimestamp(quote.createdAt || new Date())
                };
                
                // Re-sort by most recent interaction
                return updatedCustomers.sort((a, b) => {
                  if (!a.lastInteraction) return 1;
                  if (!b.lastInteraction) return -1;
                  
                  // Safely handle different types of lastInteraction
                  try {
                    if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                      return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
                    } else {
                      // Convert to JavaScript Date objects and compare
                      const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                      const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                      return dateB - dateA;
                    }
                  } catch (error) {
                    console.warn("Error comparing dates:", error);
                    return 0;
                  }
                });
              } else {
                // New customer
                const newCustomer = {
                  id: quote.brandId,
                  name: quote.brandName || 'Unknown Brand',
                  location: quote.brandLocation || '',
                  quotes: 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(quote.createdAt || new Date())
                };
                
                console.log("Adding new customer from quote request:", newCustomer);
                return [newCustomer, ...prevCustomers];
              }
            });
          }
        }
      });
    }, error => {
      console.error("Error listening for new quote requests:", error);
    });
    
    unsubscribers.push(quotesUnsubscribe);
    
    // Listen for quote-type messages
    const quoteMessagesRef = collection(db, 'messages');
    const quoteMessagesQuery = query(
      quoteMessagesRef,
      where('recipientId', '==', user.uid),
      where('type', '==', 'quote'),
      orderBy('timestamp', 'desc')
    );
    
    const quoteMessagesUnsubscribe = onSnapshot(quoteMessagesQuery, (snapshot) => {
      console.log("Real-time quote message update received");
      
      // Track unique conversation IDs to avoid double counting quotes
      const processedConversations = new Set();
      
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const message = change.doc.data();
          console.log("New quote message detected:", message);
          
          if (message.senderId && message.senderId !== user.uid && message.conversationId) {
            setCustomers(prevCustomers => {
              const existingIndex = prevCustomers.findIndex(c => c.id === message.senderId);
              
              if (existingIndex >= 0) {
                // Only update if this is a new conversation we haven't processed
                if (!message.replyTo && !processedConversations.has(message.conversationId)) {
                  processedConversations.add(message.conversationId);
                  
                  // Update existing customer
                  const updatedCustomers = [...prevCustomers];
                  // Don't increment, just ensure we have the correct count
                  const currentQuotes = updatedCustomers[existingIndex].quotes || 0;
                  updatedCustomers[existingIndex] = {
                    ...updatedCustomers[existingIndex],
                    quotes: currentQuotes,
                    lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                  };
                  console.log(`Updated existing customer in real-time from quote message: ${updatedCustomers[existingIndex].name}`);
                  
                  // Re-sort by most recent interaction
                  return updatedCustomers.sort((a, b) => {
                    if (!a.lastInteraction) return 1;
                    if (!b.lastInteraction) return -1;
                    
                    // Safely handle different types of lastInteraction
                    try {
                      if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                        return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
                      } else {
                        // Convert to JavaScript Date objects and compare
                        const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                        const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                        return dateB - dateA;
                      }
                    } catch (error) {
                      console.warn("Error comparing dates:", error);
                      return 0;
                    }
                  });
                }
                return prevCustomers;
              } else if (!processedConversations.has(message.conversationId)) {
                processedConversations.add(message.conversationId);
                // New customer
                const newCustomer = {
                  id: message.senderId,
                  name: message.senderName || 'Unknown Brand',
                  location: message.senderLocation || '',
                  quotes: message.replyTo ? 0 : 1,
                  orders: 0,
                  spent: 0,
                  lastInteraction: normalizeTimestamp(message.timestamp || new Date())
                };
                console.log(`Added new customer in real-time from quote message: ${newCustomer.name}`);
                
                return [newCustomer, ...prevCustomers];
              }
              return prevCustomers;
            });
          }
        }
      });
    }, error => {
      console.error("Error listening for new quote messages:", error);
    });
    
    unsubscribers.push(quoteMessagesUnsubscribe);
    
    // Listen for new orders
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(
      ordersRef,
      where('vendorId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    
    const ordersUnsubscribe = onSnapshot(ordersQuery, (snapshot) => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const order = change.doc.data();
          
          if (order.brandId && order.brandId !== user.uid) {
            // Calculate total spent for this order
            let orderTotal = 0;
            if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
              orderTotal = parseFloat(order.totals.total);
            } 
            else if (order.total && !isNaN(parseFloat(order.total))) {
              orderTotal = parseFloat(order.total);
            }
            else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
              orderTotal = parseFloat(order.order.totals.total);
            }
            else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
              orderTotal = parseFloat(order.order.total);
            }
            else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              orderTotal = order.items.reduce((sum, item) => {
                const itemPrice = parseFloat(item.price || item.rate || 0);
                const quantity = parseInt(item.quantity || 1, 10);
                return sum + (itemPrice * quantity);
              }, 0);
            }
            
            setCustomers(prevCustomers => {
              const existingIndex = prevCustomers.findIndex(c => c.id === order.brandId);
              
              if (existingIndex >= 0) {
                // Update existing customer
                const updatedCustomers = [...prevCustomers];
                updatedCustomers[existingIndex] = {
                  ...updatedCustomers[existingIndex],
                  orders: (updatedCustomers[existingIndex].orders || 0) + 1,
                  spent: (updatedCustomers[existingIndex].spent || 0) + orderTotal,
                  lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                };
                
                // Re-sort by most recent interaction
                return updatedCustomers.sort((a, b) => {
                  if (!a.lastInteraction) return 1;
                  if (!b.lastInteraction) return -1;
                  
                  // Safely handle different types of lastInteraction
                  try {
                    if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                      return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
                    } else {
                      // Convert to JavaScript Date objects and compare
                      const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                      const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                      return dateB - dateA;
                    }
                  } catch (error) {
                    console.warn("Error comparing dates:", error);
                    return 0;
                  }
                });
              } else {
                // New customer
                const newCustomer = {
                  id: order.brandId,
                  name: order.brandName || 'Unknown Brand',
                  location: order.brandLocation || '',
                  quotes: 0,
                  orders: 1,
                  spent: orderTotal,
                  lastInteraction: normalizeTimestamp(order.timestamp || new Date())
                };
                
                return [newCustomer, ...prevCustomers];
              }
            });
          }
        }
      });
    }, error => {
      console.error("Error listening for new orders:", error);
    });
    
    unsubscribers.push(ordersUnsubscribe);
    
    // Clean up listeners
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [user, isVendor]);

  // Enable history tab

  // Immediately trigger a refresh when the customers tab becomes active
  useEffect(() => {
    if (activeTab === 'customers') {
      console.log("Customers tab activated, triggering refresh");
      refreshCustomers();
    }
  }, [activeTab, refreshCustomers]);

  useEffect(() => {
    // Use an AbortController to manage clean shutdown
    const controller = new AbortController();
    return () => controller.abort();
  }, []);

  // Add a new useEffect to directly populate customers from existing data
  useEffect(() => {
    if (activeTab === 'customers' && user?.uid) {
      console.log(`Processing data for ${isVendor ? 'customers' : 'vendors'} tab`);
      
      const customersMap = new Map();
      
      if (isVendor) {
        // Process data for vendors viewing customers
        orders.forEach(order => {
          // Extract brandId - check multiple possible locations
          const customerId = order.brandId || 
                           (order.order && order.order.brandId);
          
          // Make sure we have a valid customer ID, it's not the vendor themselves, and the order belongs to this vendor
          const orderVendorId = order.vendorId || (order.order && order.order.vendorId);
          if (!customerId || customerId === user.uid || orderVendorId !== user.uid) return;
          
          const customerName = order.brandName || 
                             (order.order && order.order.brandName) ||
                             'Unknown Customer';
          
          let orderTotal = 0;
          // Use comprehensive approach for order total calculation
          if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
            orderTotal = parseFloat(order.totals.total);
          } 
          else if (order.total && !isNaN(parseFloat(order.total))) {
            orderTotal = parseFloat(order.total);
          }
          else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
            orderTotal = parseFloat(order.order.totals.total);
          }
          else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
            orderTotal = parseFloat(order.order.total);
          }
          else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            orderTotal = order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
          }
          else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
            orderTotal = order.order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
          }
          else if (order.payment?.amount) {
            orderTotal = parseFloat(order.payment.amount);
          } 
          else if (order.order?.payment?.amount) {
            orderTotal = parseFloat(order.order.payment.amount);
          }
          
          if (customersMap.has(customerId)) {
            const customer = customersMap.get(customerId);
            customer.orders += 1;
            customer.spent += orderTotal;
          } else {
            customersMap.set(customerId, {
              id: customerId,
              name: customerName,
              location: order.brandLocation || (order.order && order.order.brandLocation) || '',
              quotes: 0,
              orders: 1,
              spent: orderTotal,
              lastInteraction: normalizeTimestamp(order.createdAt || order.timestamp || order.updatedAt || new Date())
            });
            console.log(`SIMPLE DEBUG: Added customer from order: ${customerName}, ID: ${customerId}`);
          }
        });
        
        // Process quote requests
        quoteRequests.forEach(quote => {
          const brandId = quote.senderId || 
                       (quote.quoteDetails && quote.quoteDetails.brandId) ||
                       quote.brandId;
          
          // Make sure we have a valid brand ID, it's not the vendor themselves, and the quote belongs to this vendor
          const quoteVendorId = quote.recipientId || quote.vendorId || (quote.quoteDetails && quote.quoteDetails.vendorId);
          if (!brandId || brandId === user.uid || quoteVendorId !== user.uid) return;
          
          const brandName = quote.senderName || 
                         (quote.quoteDetails && quote.quoteDetails.brandName) ||
                         quote.brandName ||
                         'Unknown Brand';
          
          if (customersMap.has(brandId)) {
            const customer = customersMap.get(brandId);
            customer.quotes += 1;
          } else {
            customersMap.set(brandId, {
              id: brandId,
              name: brandName,
              location: '',
              quotes: 1,
              orders: 0,
              spent: 0,
              lastInteraction: normalizeTimestamp(quote.timestamp || quote.createdAt || new Date())
            });
            console.log(`SIMPLE DEBUG: Added customer from quote: ${brandName}, ID: ${brandId}`);
          }
        });
      } else {
        // Process data for brands viewing vendors
        orders.forEach(order => {
          // Extract vendorId
          const vendorId = order.vendorId || 
                        (order.order && order.order.vendorId);
          if (!vendorId || vendorId === user.uid) return;
          
          // Detailed logging of order structure
          console.log("DEBUG - Processing vendor order:", {
            vendorId,
            orderId: order.id,
            directTotal: order.total,
            directTotalType: typeof order.total,
            hasTotalsObj: !!order.totals,
            totalsTotal: order.totals?.total,
            totalsTotalType: typeof order.totals?.total,
            hasNestedOrder: !!order.order,
            nestedTotal: order.order?.total,
            nestedTotalType: typeof order.order?.total,
            hasNestedTotals: !!order.order?.totals,
            nestedTotalsTotal: order.order?.totals?.total,
            items: order.items || order.order?.items,
            paymentInfo: order.payment || order.order?.payment,
            quoteDetails: order.quoteDetails,
          });
          
          const vendorName = order.vendorName || 
                          (order.order && order.order.vendorName) ||
                          'Unknown Vendor';
          
          // Check both order.total and order.totals.total for complete amount tracking
          let orderTotal = 0;
          
          // First check if we have a totals object with a total property
          if (order.totals?.total && !isNaN(parseFloat(order.totals.total))) {
            orderTotal = parseFloat(order.totals.total);
            console.log(`DEBUG - Using order.totals.total: ${orderTotal}`);
          } 
          // Then check if there's a direct total property
          else if (order.total && !isNaN(parseFloat(order.total))) {
            orderTotal = parseFloat(order.total);
            console.log(`DEBUG - Using order.total: ${orderTotal}`);
          }
          // Then check if there's a nested order object with either format
          else if (order.order?.totals?.total && !isNaN(parseFloat(order.order.totals.total))) {
            orderTotal = parseFloat(order.order.totals.total);
            console.log(`DEBUG - Using order.order.totals.total: ${orderTotal}`);
          }
          else if (order.order?.total && !isNaN(parseFloat(order.order.total))) {
            orderTotal = parseFloat(order.order.total);
            console.log(`DEBUG - Using order.order.total: ${orderTotal}`);
          }
          // Try calculating from items if available
          else if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            orderTotal = order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
            console.log(`DEBUG - Calculated total from items: ${orderTotal}`);
          }
          // Try calculating from nested items if available
          else if (order.order?.items && Array.isArray(order.order.items) && order.order.items.length > 0) {
            orderTotal = order.order.items.reduce((sum, item) => {
              const price = parseFloat(item.price || item.rate || 0);
              const quantity = parseInt(item.quantity || 1, 10);
              return sum + (price * quantity);
            }, 0);
            console.log(`DEBUG - Calculated total from nested items: ${orderTotal}`);
          }
          else {
            console.log(`DEBUG - No valid total found in order for vendor ${vendorId}`);
            // Check if there's payment info that might have amount
            if (order.payment?.amount) {
              orderTotal = parseFloat(order.payment.amount);
              console.log(`DEBUG - Using payment amount: ${orderTotal}`);
            } else if (order.order?.payment?.amount) {
              orderTotal = parseFloat(order.order.payment.amount);
              console.log(`DEBUG - Using nested payment amount: ${orderTotal}`);
            }
          }
          
          if (customersMap.has(vendorId)) {
            const vendor = customersMap.get(vendorId);
            vendor.orders += 1;
            vendor.spent += orderTotal;
            console.log(`DEBUG - Updated vendor ${vendorName} spent to: ${vendor.spent}`);
          } else {
            customersMap.set(vendorId, {
              id: vendorId,
              name: vendorName,
              location: order.vendorLocation || (order.order && order.order.vendorLocation) || '',
              quotes: 0,
              orders: 1,
              spent: orderTotal,
              lastInteraction: normalizeTimestamp(order.createdAt || order.timestamp || order.updatedAt || new Date())
            });
            console.log(`DEBUG - Created vendor ${vendorName} with spent: ${orderTotal}`);
            console.log(`SIMPLE DEBUG: Added vendor from order: ${vendorName}, ID: ${vendorId}`);
          }
        });
        
        // Process quote requests for vendors
        quoteRequests.forEach(quote => {
          const vendorId = quote.recipientId || 
                       quote.vendorId ||
                       (quote.quoteDetails && quote.quoteDetails.vendorId);
          if (!vendorId || vendorId === user.uid) return;
          
          const vendorName = quote.recipientName || 
                         quote.vendorName ||
                         (quote.quoteDetails && quote.quoteDetails.vendorName) ||
                         'Unknown Vendor';
          
          if (customersMap.has(vendorId)) {
            const vendor = customersMap.get(vendorId);
            vendor.quotes += 1;
          } else {
            customersMap.set(vendorId, {
              id: vendorId,
              name: vendorName,
              location: '',
              quotes: 1,
              orders: 0,
              spent: 0,
              lastInteraction: normalizeTimestamp(quote.timestamp || quote.createdAt || new Date())
            });
            console.log(`SIMPLE DEBUG: Added vendor from quote: ${vendorName}, ID: ${vendorId}`);
          }
        });
      }
      
      if (customersMap.size > 0) {
        const customersArray = Array.from(customersMap.values())
          .sort((a, b) => {
            if (!a.lastInteraction) return 1;
            if (!b.lastInteraction) return -1;
            
            // Safely handle different types of lastInteraction
            try {
              if (a.lastInteraction.toMillis && b.lastInteraction.toMillis) {
                return b.lastInteraction.toMillis() - a.lastInteraction.toMillis();
              } else {
                // Convert to JavaScript Date objects and compare
                const dateA = a.lastInteraction instanceof Date ? a.lastInteraction : new Date(a.lastInteraction);
                const dateB = b.lastInteraction instanceof Date ? b.lastInteraction : new Date(b.lastInteraction);
                return dateB - dateA;
              }
            } catch (error) {
              console.warn("Error comparing dates:", error);
              return 0;
            }
          });
        
        console.log(`SIMPLE DEBUG: Setting ${customersArray.length} ${isVendor ? 'customers' : 'vendors'} from state data`);
        
        // Only update if we actually found some data and we're on customers tab
        if (customersArray.length > 0 && activeTab === 'customers') {
          setDisplayCustomers(customersArray);
          setCustomers(customersArray);
          customerDataCache.current = customersArray;
          saveCustomersToStorage(customersArray);
        }
      }
    }
  }, [activeTab, orders, quoteRequests, user?.uid, isVendor]);

  // Add this state outside the renderCustomerTable function, near other state declarations
  const [hoveredCustomerId, setHoveredCustomerId] = useState(null);

  // Also fix the customers table rendering to ensure it shows data
  const renderCustomerTable = () => {
    console.log(`RENDER DEBUG: displayCustomers length: ${displayCustomers.length}`);
    
    // Filter customers based on search term
    const filteredCustomers = displayCustomers.filter(customer => 
      customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (loading && displayCustomers.length === 0) {
      return (
        <tr>
          <td colSpan="6" className="empty-table-message">
            Loading...
          </td>
        </tr>
      );
    } else if (displayCustomers.length === 0) {
      return (
        <tr>
          <td colSpan="6" className="empty-table-message">
            {isVendor 
              ? "No customers yet. When brands interact with you through quotes or orders, they'll appear here." 
              : "No vendors yet. When you request quotes or place orders with vendors, they'll appear here."}
          </td>
        </tr>
      );
    } else if (filteredCustomers.length > 0) {
      return filteredCustomers.map(customer => {
        return (
          <tr 
            key={customer.id}
            style={{ backgroundColor: hoveredCustomerId === customer.id ? '#f5f5f5' : 'transparent' }}
            onMouseEnter={() => setHoveredCustomerId(customer.id)}
            onMouseLeave={() => setHoveredCustomerId(null)}
          >
            <td><input type="checkbox" /></td>
            <td>{customer.name}</td>
            <td>{customer.location}</td>
            <td>{customer.quotes === 1 ? '1 quote' : `${customer.quotes || 0} quotes`}</td>
            <td>{customer.orders === 1 ? '1 order' : `${customer.orders || 0} orders`}</td>
            <td>${(customer.spent || 0).toFixed(2)}</td>
          </tr>
        );
      });
    } else {
      return (
        <tr>
          <td colSpan="6" className="empty-table-message">
            No {!isVendor ? 'vendors' : 'customers'} found matching your search
          </td>
        </tr>
      );
    }
  };

  // Clean up cached vendors for brands when there are no real interactions
  useEffect(() => {
    if (activeTab === 'customers' && !isVendor && user?.uid) {
      // Check if there are any real interactions for this brand
      const hasInteractions = orders.length > 0 || quoteRequests.length > 0;
      
      if (!hasInteractions && displayCustomers.length > 0) {
        console.log("No real vendor interactions found but cached vendors exist, clearing vendors data");
        setDisplayCustomers([]);
        setCustomers([]);
        customerDataCache.current = [];
        localStorage.removeItem('cached_customers');
      }
    }
  }, [activeTab, isVendor, user?.uid, orders, quoteRequests, displayCustomers.length]);

  // Emergency fallback - add hardcoded customers based on logs
  useEffect(() => {
    if (activeTab === 'customers' && displayCustomers.length === 0) {
      console.log("EMERGENCY: No customer data available");
      
      // Don't show any hardcoded vendors for brands regardless of interactions
      // This ensures only real interactions will populate the vendors table
      if (!isVendor) {
        console.log("No vendor interactions found for this brand, keeping table empty");
        return;
      }
    }
  }, [activeTab, displayCustomers.length, isVendor]);

  // Add a utility function for consistent date handling (near the top of the file, before useEffect hooks)
  const normalizeTimestamp = (timestamp) => {
    if (!timestamp) return new Date();
    
    // Handle Firebase Timestamps (with toDate method)
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Handle objects with toMillis (another Firebase Timestamp format)
    if (timestamp.toMillis && typeof timestamp.toMillis === 'function') {
      try {
        return new Date(timestamp.toMillis());
      } catch (e) {
        console.warn("Error converting timestamp with toMillis:", e);
        return new Date();
      }
    }
    
    // Handle Date objects
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Try to parse as string or number
    try {
      return new Date(timestamp);
    } catch (e) {
      console.warn("Error parsing timestamp:", e);
      return new Date();
    }
  };

  useEffect(() => {
    // Debug function to inspect orders
    const debugOrdersData = () => {
      console.log("DEBUG - ANALYZING ALL ORDERS:", orders.length);
      orders.forEach((order, index) => {
        console.log(`DEBUG - ORDER ${index}:`, {
          orderId: order.id,
          vendorId: order.vendorId || order.order?.vendorId,
          vendorName: order.vendorName || order.order?.vendorName,
          total: order.total,
          totalType: typeof order.total,
          hasTotalsObj: !!order.totals,
          totalsTotal: order.totals?.total,
          totalsTotalType: typeof order.totals?.total,
          hasNestedOrder: !!order.order,
          orderTotal: order.order?.total,
          orderTotalType: typeof order.order?.total,
          orderTotalsObj: !!order.order?.totals,
          orderTotalsTotal: order.order?.totals?.total,
          orderItems: order.items || order.order?.items,
          quoteDetails: order.quoteDetails,
          complete: JSON.stringify(order).substring(0, 500) + "..."
        });
      });
    };
    
    // Run debug when on vendors tab
    if (activeTab === 'customers' && !isVendor && user?.uid) {
      debugOrdersData();
    }
  }, [activeTab, isVendor, user?.uid, orders]);

  return (
    <div className="dashboard">
      <div className="dashboard-sidebar">
        <div className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleTabChange('home')}
          >
            <FaChartLine /> Home
          </button>
          <button 
            className={`menu-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => handleTabChange('orders')}
          >
            <FaBox /> Orders
          </button>
          <button 
            className={`menu-item ${activeTab === 'messages' ? 'active' : ''}`}
            onClick={() => handleTabChange('messages')}
          >
            <FaEnvelope /> Messages
          </button>
          <button 
            className={`menu-item ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => handleTabChange('customers')}
          >
            <FaUsers /> {!isVendor ? 'Vendors' : 'Customers'}
          </button>
          <button 
            className={`menu-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => handleTabChange('profile')}
          >
            <FaUserCircle /> Profile
          </button>
          <button 
            className={`menu-item ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => handleTabChange('history')}
          >
            <FaHistory /> History
          </button>
          <div className="menu-divider"></div>
          <button 
            className={`menu-item ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => handleTabChange('notifications')}
          >
            <FaBell /> Notifications
          </button>
          <button 
            className={`menu-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleTabChange('settings')}
          >
            <FaCog /> Settings
          </button>
        </div>
      </div>

      <div className="dashboard-main">
        <div className="dashboard-container">
          {activeTab === 'profile' ? (
            <Profile hideNavigation={true} />
          ) : activeTab === 'customers' ? (
            <div className="customers-content">
              <div className="customers-header">
                <h2>{!isVendor ? 'Vendors' : 'Customers'}</h2>
                <div className="customers-actions">
                  <button className="secondary-button">Export</button>
                  <button className="secondary-button">Import</button>
                  <button className="gradient-button">Add {!isVendor ? 'vendor' : 'customer'}</button>
                </div>
              </div>
              
              <div className="customers-stats">
                <span className="customers-count">{displayCustomers.length} {!isVendor ? 'vendors' : 'customers'}</span>
                <span className="customers-base">100% of your {!isVendor ? 'vendor' : 'customer'} base</span>
                <div className="filter-container">
                  <button className="filter-button">
                    Add filter <FaChevronDown />
                  </button>
                </div>
              </div>
              
              <div className="customers-table-container">
                <div className="search-container">
                  <div className="search-input-container">
                    <FaSearch className="search-icon" />
                    <input 
                      type="text" 
                      className="search-input" 
                      placeholder={`Search ${!isVendor ? 'vendors' : 'customers'}`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button className="refresh-button" onClick={refreshCustomers}>
                    <FaSyncAlt />
                  </button>
                </div>
                
                {loading && (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <p>Loading {!isVendor ? 'vendor' : 'customer'} data...</p>
                  </div>
                )}
                
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th className="checkbox-column">
                        <input type="checkbox" />
                      </th>
                      <th>{!isVendor ? 'Vendor name' : 'Customer name'}</th>
                      <th>Location</th>
                      <th>Quotes</th>
                      <th>Orders</th>
                      <th>Amount spent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderCustomerTable()}
                  </tbody>
                </table>
                
                <div className="pagination">
                  <span>
                    {(() => {
                      const filteredCount = displayCustomers.filter(customer => 
                        customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        customer.location?.toLowerCase().includes(searchTerm.toLowerCase())
                      ).length;
                      
                      if (displayCustomers.length === 0) {
                        return `No ${!isVendor ? 'vendors' : 'customers'}`;
                      } else if (filteredCount === 0) {
                        return `No matching ${!isVendor ? 'vendors' : 'customers'}`;
                      } else {
                        return `1-${filteredCount} of ${filteredCount}`;
                      }
                    })()}
                  </span>
                  <div className="pagination-controls">
                    <button disabled><FaChevronLeft /></button>
                    <button disabled><FaChevronRight /></button>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'home' ? (
            <div className="home-content">
              <div className="home-top-section">
                <div className="utility-buttons">
                  <button 
                    className={`utility-btn active`}
                    onClick={() => setCenterContent('metrics')}
                  >
                    <FaChartLine /> Metrics
                  </button>
                </div>

                <div className="metrics-card">
                  {centerContent === 'metrics' && (
                    <>
                      <div className="metrics-header">
                        <div className="metric-toggles">
                          <button 
                            className={`metric-toggle ${activeMetric === 'orders' ? 'active' : ''}`}
                            onClick={() => setActiveMetric('orders')}
                          >
                            <FaBox /> Orders
                          </button>
                          <button 
                            className={`metric-toggle ${activeMetric === 'sales' ? 'active' : ''}`}
                            onClick={() => setActiveMetric('sales')}
                          >
                            <FaDollarSign /> Total Sales
                          </button>
                        </div>
                        <div className="date-range-selector">
                          <select 
                            value={dateRange} 
                            onChange={(e) => setDateRange(e.target.value)}
                            className="date-select"
                          >
                            <option value="7d">Last 7 days</option>
                            <option value="30d">Last 30 days</option>
                            <option value="90d">Last 90 days</option>
                            <option value="ytd">Year to date</option>
                            <option value="12m">Last 12 months</option>
                          </select>
                        </div>
                      </div>
                      <div className="metrics-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', textAlign: 'center' }}>
                          {activeMetric === 'orders' ? (
                            metricsData.orders[dateRange]
                          ) : (
                            `$${metricsData.sales[dateRange].toFixed(2)}`
                          )}
                        </div>
                        <div style={{ flex: 1, minHeight: '300px' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={metricsData.dailyData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={(date) => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              />
                              <YAxis />
                              <Tooltip
                                formatter={(value, name) => {
                                  if (name === 'sales') return `$${value.toFixed(2)}`;
                                  return value;
                                }}
                                labelFormatter={(date) => new Date(date).toLocaleDateString()}
                              />
                              <Line
                                type="monotone"
                                dataKey={activeMetric}
                                stroke="#FF69B4"
                                strokeWidth={2}
                                dot={{ r: 4 }}
                                activeDot={{ r: 8 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div style={{ color: '#666', fontSize: '1.1rem', textAlign: 'center', marginTop: '1rem' }}>
                          {activeMetric === 'orders' ? 'Total Orders' : 'Total Sales'} - {
                            dateRange === '7d' ? 'Last 7 days' :
                            dateRange === '30d' ? 'Last 30 days' :
                            dateRange === '90d' ? 'Last 90 days' :
                            dateRange === 'ytd' ? 'Year to date' :
                            'Last 12 months'
                          }
                        </div>
                      </div>
                    </>
                  )}
                  
                  {centerContent === 'calendar' && (
                    <>
                      <div className={`calendar-container ${isCalendarExpanded ? 'expanded' : ''}`}>
                        <div className="calendar-header">
                          <div className="calendar-title">
                            <h2>Calendar</h2>
                            <span className="current-date">
                              {format(currentDate, 'MMMM yyyy')}
                            </span>
                          </div>
                          <div className="calendar-controls">
                            <div className="calendar-nav">
                              <button onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                                <FaChevronLeft />
                              </button>
                              <h2>{format(currentDate, 'MMMM yyyy')}</h2>
                              <button onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                                <FaChevronRight />
                              </button>
                            </div>
                            <div className="calendar-actions">
                              <button 
                                className="add-event-btn"
                                onClick={() => {
                                  setSelectedEvent(null);
                                  setEventFormData({
                                    title: '',
                                    description: '',
                                    start: format(currentDate, "yyyy-MM-dd'T'HH:mm"),
                                    end: format(addDays(currentDate, 1), "yyyy-MM-dd'T'HH:mm"),
                                    location: '',
                                    color: '#FF69B4'
                                  });
                                  setShowEventModal(true);
                                }}
                              >
                                <FaPlus /> Add Event
                              </button>
                              <select 
                                value={calendarView} 
                                onChange={(e) => setCalendarView(e.target.value)}
                              >
                                <option value="month">Month</option>
                                <option value="week">Week</option>
                                <option value="day">Day</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="calendar-grid">
                          {calendarView === 'month' && renderMonthView()}
                          {calendarView === 'week' && renderWeekView()}
                          {calendarView === 'day' && renderDayView()}
                        </div>
                      </div>
                      {isCalendarExpanded && (
                        <div 
                          className="calendar-overlay"
                          onClick={() => setIsCalendarExpanded(false)}
                        />
                      )}
                    </>
                  )}

                  {centerContent === 'todo' && renderTodoSection()}
                </div>

                <div className="notification-panel">
                  <div className="notification-header">
                    <h2><FaBell /> Notifications</h2>
                  </div>
                  <div className="notification-categories">
                    <div className="notification-category">
                      <div className="category-header">
                        <span className="category-title">
                          <FaFileAlt /> Quotes
                        </span>
                        {/* Only show badge if there are notifications */}
                        {quotesCount > 0 && (
                          <span className="notification-badge" data-count={quotesCount}>
                            {quotesCount}
                          </span>
                        )}
                      </div>
                      <div className="category-content">
                        {quotesCount > 0 ? `${quotesCount} new quote notifications` : 'No new quote notifications'}
                      </div>
                    </div>

                    <div className="notification-category">
                      <div className="category-header">
                        <span className="category-title">
                          <FaBox /> Orders
                        </span>
                        {ordersCount > 0 && (
                          <span className="notification-badge" data-count={ordersCount}>
                            {ordersCount}
                          </span>
                        )}
                      </div>
                      <div className="category-content">
                        {ordersCount > 0 ? `${ordersCount} new order notifications` : 'No new order notifications'}
                      </div>
                    </div>

                    <div className="notification-category">
                      <div className="category-header">
                        <span className="category-title">
                          <FaEnvelope /> Messages
                        </span>
                        {messagesCount > 0 && (
                          <span className="notification-badge" data-count={messagesCount}>
                            {messagesCount}
                          </span>
                        )}
                      </div>
                      <div className="category-content">
                        {messagesCount > 0 ? `${messagesCount} new messages` : 'No new messages'}
                      </div>
                    </div>

                    <div className="notification-category">
                      <div className="category-header">
                        <span className="category-title">
                          <FaBell /> Alerts
                        </span>
                        {alertsCount > 0 && (
                          <span className="notification-badge" data-count={alertsCount}>
                            {alertsCount}
                          </span>
                        )}
                      </div>
                      <div className="category-content">
                        {alertsCount > 0 ? `${alertsCount} new alerts` : 'No new alerts'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="current-orders-section">
                <div className="section-header" 
                  onClick={() => setIsCurrentOrdersOpen(!isCurrentOrdersOpen)}
                  style={{ 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    marginBottom: isCurrentOrdersOpen ? '16px' : '0',
                    gap: '8px'
                  }}
                >
                  <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Current Orders
                    <span style={{ 
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#FF69B4',
                      color: 'white',
                      fontSize: '14px',
                      transform: isCurrentOrdersOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.3s ease'
                    }}>▼</span>
                  </h2>
                </div>
                {isCurrentOrdersOpen && (
                  <div className="order-cards-grid">
                    {orders.map(order => {
                      // Calculate progress based on fulfillment status
                      const progress = order.fulfillmentStatus === 'fulfilled' ? 100 : 
                                     order.fulfillmentStatus === 'unfulfilled' ? 0 : 50;
                      
                      return (
                        <div key={order.id} className="order-progress-card">
                          <div className="order-card-header">
                            <div className="order-info">
                              <h3>Order #{order.orderNumber}</h3>
                              <span className="order-date">
                                {new Date(order.date).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="status-badges">
                              <span className={`status-badge ${order.paymentStatus}`}>
                                {order.paymentStatus}
                              </span>
                              <span className={`status-badge ${order.fulfillmentStatus}`}>
                                {order.fulfillmentStatus}
                              </span>
                            </div>
                          </div>
                          
                          <div className="order-card-details">
                            <div className="detail-item">
                              <span className="label">Customer:</span>
                              <span className="value">{order.customerName}</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Items:</span>
                              <span className="value">{order.items} items</span>
                            </div>
                            <div className="detail-item">
                              <span className="label">Total:</span>
                              <span className="value">${order.total.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="progress-tracker">
                            <div className="progress-bar">
                              <div 
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="progress-text">{progress}% Complete</span>
                          </div>

                          <button 
                            className="view-order-btn"
                            onClick={() => handleOrderClick(order)}
                          >
                            View Order
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'orders' ? (
            <>
              {/* Stats Section */}
              <div className="stats-section">
                <StatsCard 
                  title="Total Orders"
                  value={stats.totalOrders}
                  icon={<FaBox />}
                  color="#FF69B4"
                />
                <StatsCard 
                  title="Fulfilled Orders"
                  value={stats.fulfilledOrders}
                  icon={<FaCheckCircle />}
                  color="#4CAF50"
                />
                <StatsCard 
                  title="Pending Orders"
                  value={stats.pendingOrders}
                  icon={<FaShippingFast />}
                  color="#FFA726"
                />
                <StatsCard 
                  title="Total Quotes"
                  value={stats.totalQuotes}
                  icon={<FaFileContract />}
                  color="#7B68EE"
                />
              </div>

              {/* Quote Requests Section */}
              <div className="orders-section">
                <div className="orders-header" style={{ background: 'white', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer' 
                        }}
                        onClick={() => setIsQuoteRequestsOpen(!isQuoteRequestsOpen)}
                      >
                        <h2 style={{ margin: 0, fontSize: '18px', marginRight: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Quote Requests
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#FF69B4',
                            color: 'white',
                            fontSize: '14px',
                            transform: isQuoteRequestsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }}>▼</span>
                        </h2>
                      </div>
                      {isQuoteRequestsOpen && (
                        <div style={{ flex: 1, maxWidth: '300px' }}>
                          <input
                            type="text"
                            placeholder="Search quotes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div style={{ marginLeft: 'auto' }}>
                      <button
                        className="create-order-btn"
                        onClick={() => {
                          if (userProfile?.userType === 'vendor') {
                            navigate('/create-order');
                          } else {
                            setShowQuoteForm(true);
                          }
                        }}
                        style={{
                          backgroundColor: '#FF69B4',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontSize: '14px'
                        }}
                      >
                        {userProfile?.userType === 'vendor' ? 'Create Order' : '+ New Quote Request'}
                      </button>
                    </div>
                  </div>
                </div>

                {isQuoteRequestsOpen && (
                  <div className="orders-table">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Service Required</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>{userProfile?.userType === 'vendor' ? 'Customer' : 'Vendor'}</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Quantity</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Timeline</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                              Loading quote requests...
                            </td>
                          </tr>
                        ) : getFilteredQuotes().length === 0 ? (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', padding: '20px' }}>
                              No quote requests found
                            </td>
                          </tr>
                        ) : (
                          getFilteredQuotes().map(quote => {
                            const totalQuantity = quote.quoteDetails?.quantity || 
                              (quote.quoteDetails?.quantities 
                                ? Object.values(quote.quoteDetails.quantities).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0)
                                : 0);

                            return (
                              <tr 
                                key={quote.id} 
                                onClick={() => setSelectedQuote(quote)}
                                style={{ 
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                  backgroundColor: 'white'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                              >
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  {new Date(quote.quoteDetails?.date).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  {quote.quoteDetails?.serviceRequired || 'N/A'}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  {userProfile?.userType === 'vendor' 
                                    ? (quote.senderName || 'Loading...') 
                                    : (quote.recipientName || quote.vendorName || 'Loading...')}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  {totalQuantity}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  {quote.quoteDetails?.timeline || 'Standard'}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  <span style={{
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    backgroundColor: quote.quoteDetails?.status === 'accepted' ? '#e6f4ea' : '#fff3e0',
                                    color: quote.quoteDetails?.status === 'accepted' ? '#1e8e3e' : '#ff9800'
                                  }}>
                                    {quote.quoteDetails?.status || 'pending'}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleArchiveQuote(quote.id);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        borderRadius: '6px',
                                        color: '#666'
                                      }}
                                      title="Archive quote"
                                    >
                                      <FaArchive />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteQuote(quote.id);
                                      }}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        padding: '8px',
                                        cursor: 'pointer',
                                        borderRadius: '6px',
                                        color: '#dc3545'
                                      }}
                                      title="Delete quote"
                                    >
                                      <FaTrash />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Orders Table Section */}
              <div className="orders-section" style={{ marginTop: '20px' }}>
                <div className="orders-header" style={{ background: 'white', padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer' 
                        }}
                        onClick={() => setIsOrdersTableOpen(!isOrdersTableOpen)}
                      >
                        <h2 style={{ margin: 0, fontSize: '18px', marginRight: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          Orders
                          <span style={{ 
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#FF69B4',
                            color: 'white',
                            fontSize: '14px',
                            transform: isOrdersTableOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.3s ease'
                          }}>▼</span>
                        </h2>
                      </div>
                      {isOrdersTableOpen && (
                        <div style={{ flex: 1, maxWidth: '300px' }}>
                          <input
                            type="text"
                            placeholder="Search orders..."
                            value={filterValue}
                            onChange={(e) => setFilterValue(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '8px 12px',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              fontSize: '14px'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isOrdersTableOpen && (
                  <div className="orders-table" style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    marginTop: '16px',
                    padding: '16px',
                    overflowX: 'auto'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f8f9fa' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Order #</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>{userProfile?.userType === 'vendor' ? 'Customer' : 'Vendor'}</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Items</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Total</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Payment</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Delivery</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', borderBottom: '1px solid #ddd', fontSize: '14px', fontWeight: '600' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                              Loading orders...
                            </td>
                          </tr>
                        ) : getFilteredOrders().length === 0 ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '20px' }}>
                              No orders found
                            </td>
                          </tr>
                        ) : (
                          getFilteredOrders().map(order => (
                            <tr 
                              key={order.id} 
                              onClick={() => handleOrderClick(order)}
                              style={{ 
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                backgroundColor: 'white'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                #{order.orderNumber}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                {new Date(order.date).toLocaleDateString()}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                {userProfile?.userType === 'vendor' 
                                  ? order.customerName 
                                  : (order.vendorName || 'Unknown Vendor')}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                {order.items}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                ${order.total.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  backgroundColor: order.paymentStatus === 'paid' ? '#e6f4ea' : '#fff3e0',
                                  color: order.paymentStatus === 'paid' ? '#1e8e3e' : '#ff9800'
                                }}>
                                  {order.paymentStatus}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  backgroundColor: order.fulfillmentStatus === 'fulfilled' ? '#e6f4ea' : '#fff3e0',
                                  color: order.fulfillmentStatus === 'fulfilled' ? '#1e8e3e' : '#ff9800'
                                }}>
                                  {order.fulfillmentStatus}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                {order.deliveryMethod}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveOrder(order.id);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '8px',
                                      cursor: 'pointer',
                                      borderRadius: '6px',
                                      color: '#666'
                                    }}
                                    title="Archive order"
                                  >
                                    <FaArchive />
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteOrder(order.id);
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      padding: '8px',
                                      cursor: 'pointer',
                                      borderRadius: '6px',
                                      color: '#dc3545'
                                    }}
                                    title="Delete order"
                                  >
                                    <FaTrash />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : activeTab === 'messages' ? (
            <Messages 
              key={`${selectedChatId}-${shouldOpenThread}`}
              initialChatId={selectedChatId}
              openThread={shouldOpenThread}
            />
          ) : activeTab === 'history' ? (
            <div className="history-content">
              <div className="history-header">
                <h2>History & Archives</h2>
                <p>View and manage your archived items</p>
              </div>
              
              <div className="history-sections">
                <div className="history-section">
                  <div className="section-header">
                    <h3><FaBox /> Archived Orders</h3>
                    <span className="item-count">{archivedOrders?.length || 0} items</span>
                  </div>
                  <div className="archived-items">
                    {archivedOrders?.length > 0 ? (
                      archivedOrders.map(order => (
                        <div key={order.id} className="archived-item">
                          <div className="item-info">
                            <span className="item-title">Order #{order.orderNumber}</span>
                            <span className="item-date">{new Date(order.archivedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="item-actions">
                            <button onClick={() => handleRestoreItem('orders', order)}>Restore</button>
                            <button onClick={() => handleDeleteItem('orders', order)} className="delete">Delete</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-items">No archived orders</div>
                    )}
                  </div>
                </div>

                <div className="history-section">
                  <div className="section-header">
                    <h3><FaFileContract /> Archived Quotes</h3>
                    <span className="item-count">{archivedQuotes?.length || 0} items</span>
                  </div>
                  <div className="archived-items">
                    {archivedQuotes?.length > 0 ? (
                      archivedQuotes.map(quote => (
                        <div key={`archived-quote-${quote.id}-${quote.archivedAt?.seconds || Date.now()}`} className="archived-item">
                          <div className="item-info">
                            <span className="item-title">{quote.quoteDetails?.serviceRequired || 'Quote Request'}</span>
                            <span className="item-date">{quote.archivedAt ? new Date(quote.archivedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                          </div>
                          <div className="item-actions">
                            <button onClick={() => handleRestoreItem('quotes', quote)}>Restore</button>
                            <button onClick={() => handleDeleteItem('quotes', quote)} className="delete">Delete</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-items">No archived quotes</div>
                    )}
                  </div>
                </div>

                <div className="history-section">
                  <div className="section-header">
                    <h3><FaFile /> Archived Files</h3>
                    <span className="item-count">{archivedFiles?.length || 0} items</span>
                  </div>
                  <div className="archived-items">
                    {archivedFiles?.length > 0 ? (
                      archivedFiles.map(file => (
                        <div key={file.id} className="archived-item">
                          <div className="item-info">
                            <span className="item-title">{file.fileName}</span>
                            <span className="item-date">{new Date(file.archivedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="item-actions">
                            <button onClick={() => handleRestoreItem('files', file)}>Restore</button>
                            <button onClick={() => handleDeleteItem('files', file)} className="delete">Delete</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-items">No archived files</div>
                    )}
                  </div>
                </div>

                <div className="history-section">
                  <div className="section-header">
                    <h3><FaEnvelope /> Archived Messages</h3>
                    <span className="item-count">{archivedMessages?.length || 0} items</span>
                  </div>
                  <div className="archived-items">
                    {archivedMessages?.length > 0 ? (
                      archivedMessages.map(message => (
                        <div key={message.id} className="archived-item">
                          <div className="item-info">
                            <span className="item-title">{message.subject || 'Message'}</span>
                            <span className="item-date">{new Date(message.archivedAt).toLocaleDateString()}</span>
                          </div>
                          <div className="item-actions">
                            <button onClick={() => handleRestoreItem('messages', message)}>Restore</button>
                            <button onClick={() => handleDeleteItem('messages', message)} className="delete">Delete</button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-items">No archived messages</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
        />
      )}

      {/* Quote Request Form Modal */}
      {showQuoteForm && (
        <QuoteRequestModal
          onClose={() => setShowQuoteForm(false)}
          onSubmit={handleQuoteSubmit}
        />
      )}

      {/* Order Creation Form Modal */}
      {showOrderForm && (
        <CreateOrder
          onClose={() => setShowOrderForm(false)}
          onSubmit={(orderData) => {
            // Handle order submission here
            setShowOrderForm(false);
          }}
        />
      )}

      {/* Order Overview Modal */}
      {showOrderOverview && selectedOrderData && (
        <OrderOverviewModal
          message={selectedOrderData}
          onClose={() => setShowOrderOverview(false)}
          onShowInvoice={(orderData) => {
            setShowOrderOverview(false);
            // Calculate totals from items
            const items = selectedOrderData.order?.items || [];
            const subtotal = items.reduce((sum, item) => {
              const rate = parseFloat(item.rate || item.price || 0);
              const quantity = parseInt(item.quantity || 0);
              return sum + (rate * quantity);
            }, 0);
            const tax = subtotal * 0.0875; // 8.75% tax rate
            const shipping = selectedOrderData.order?.shipping?.cost || 0;
            const total = subtotal + tax + shipping;

            setSelectedOrder({
              ...orderData, // Use the passed orderData which includes conversationId
              items: items,
              totals: {
                subtotal: subtotal,
                tax: tax,
                shipping: shipping,
                total: total
              },
              status: selectedOrderData.order?.status || {
                payment: 'pending',
                fulfillment: 'unfulfilled'
              }
            });
          }}
        />
      )}

      {/* Invoice Modal */}
      {selectedOrder && (
        <OrderInvoiceModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
        />
      )}

      {/* Event Modal */}
      {showEventModal && (
        <div className="modal-overlay">
          <div className="event-modal">
            <div className="event-modal-header">
              <h3>{selectedEvent ? 'Edit Event' : 'Add New Event'}</h3>
              <button 
                className="close-modal-btn"
                onClick={() => {
                  setShowEventModal(false);
                  setSelectedEvent(null);
                  setEventFormData({
                    title: '',
                    description: '',
                    start: '',
                    end: '',
                    location: '',
                    color: '#FF69B4'
                  });
                }}
              >
                ×
              </button>
            </div>
            <div className="event-form">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Event title"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Event description"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start</label>
                  <input
                    type="datetime-local"
                    value={eventFormData.start}
                    onChange={(e) => setEventFormData(prev => ({ ...prev, start: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input
                    type="datetime-local"
                    value={eventFormData.end}
                    onChange={(e) => setEventFormData(prev => ({ ...prev, end: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={eventFormData.location}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Event location"
                />
              </div>
              <div className="form-group">
                <label>Color</label>
                <input
                  type="color"
                  value={eventFormData.color}
                  onChange={(e) => setEventFormData(prev => ({ ...prev, color: e.target.value }))}
                />
              </div>
              <div className="form-actions">
                {selectedEvent && (
                  <button 
                    className="delete-btn"
                    onClick={() => {
                      handleDeleteEvent(selectedEvent.id);
                      setShowEventModal(false);
                      setSelectedEvent(null);
                    }}
                  >
                    Delete
                  </button>
                )}
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowEventModal(false);
                    setSelectedEvent(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={selectedEvent ? handleEditEvent : handleAddEvent}
                >
                  {selectedEvent ? 'Save Changes' : 'Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <QuoteDetailsModal
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
        />
      )}
    </div>
  );
};

export default Dashboard; 