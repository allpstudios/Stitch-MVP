import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const SAMPLE_PRODUCTS = [
  {
    name: "Premium Blank Hoodie",
    vendor: "LA Apparel Co",
    price: 24.99,
    moq: 24,
    category: "Blanks",
    image: "https://firebasestorage.googleapis.com/v0/b/your-project/o/products%2Fhoodie.jpg",
    description: "350 GSM French Terry, Pre-shrunk, 100% Cotton",
    tags: ["hoodies", "blanks", "wholesale"]
  },
  // ... rest of your sample products
];

export const setupProducts = async () => {
  try {
    const productsRef = collection(db, 'products');
    
    for (const product of SAMPLE_PRODUCTS) {
      await addDoc(productsRef, {
        ...product,
        createdAt: new Date().toISOString(),
        isActive: true
      });
    }
    
    console.log('Products added successfully!');
  } catch (error) {
    console.error('Error adding products:', error);
  }
}; 