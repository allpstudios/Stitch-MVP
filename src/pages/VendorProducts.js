import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import './VendorProducts.css';

const VendorProducts = () => {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    moq: '',
    category: 'Blanks',
    description: '',
    tags: '',
  });

  useEffect(() => {
    if (user) {
      fetchVendorProducts();
    }
  }, [user]);

  const fetchVendorProducts = async () => {
    try {
      const q = query(
        collection(db, 'products'), 
        where('vendorId', '==', user.uid)
      );
      const snapshot = await getDocs(q);
      const productList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productList);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const productData = {
        ...newProduct,
        vendorId: user.uid,
        price: parseFloat(newProduct.price),
        moq: parseInt(newProduct.moq) || 0,
        tags: newProduct.tags.split(',').map(tag => tag.trim()),
        createdAt: new Date().toISOString(),
        isActive: true
      };

      await addDoc(collection(db, 'products'), productData);
      setIsAddingProduct(false);
      setNewProduct({
        name: '',
        price: '',
        moq: '',
        category: 'Blanks',
        description: '',
        tags: '',
      });
      fetchVendorProducts();
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  return (
    <div className="vendor-products">
      <div className="header">
        <h1>My Products</h1>
        <button 
          className="add-product-btn"
          onClick={() => setIsAddingProduct(true)}
        >
          Add New Product
        </button>
      </div>

      {isAddingProduct && (
        <div className="add-product-form">
          <h2>Add New Product</h2>
          <form onSubmit={handleAddProduct}>
            <div className="form-group">
              <label>Product Name</label>
              <input
                type="text"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Price</label>
              <input
                type="number"
                step="0.01"
                value={newProduct.price}
                onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Minimum Order Quantity</label>
              <input
                type="number"
                value={newProduct.moq}
                onChange={(e) => setNewProduct({...newProduct, moq: e.target.value})}
              />
            </div>

            <div className="form-group">
              <label>Category</label>
              <select
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
              >
                <option value="Blanks">Blanks</option>
                <option value="Supplies">Supplies</option>
                <option value="Equipment">Equipment</option>
              </select>
            </div>

            <div className="form-group">
              <label>Description</label>
              <textarea
                value={newProduct.description}
                onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input
                type="text"
                value={newProduct.tags}
                onChange={(e) => setNewProduct({...newProduct, tags: e.target.value})}
                placeholder="e.g., wholesale, blanks, cotton"
              />
            </div>

            <div className="form-buttons">
              <button type="submit">Add Product</button>
              <button 
                type="button" 
                onClick={() => setIsAddingProduct(false)}
                className="cancel"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="products-list">
        {products.map(product => (
          <div key={product.id} className="product-item">
            <div className="product-info">
              <h3>{product.name}</h3>
              <p className="price">${product.price}</p>
              {product.moq && <p className="moq">MOQ: {product.moq}</p>}
              <p className="category">{product.category}</p>
            </div>
            <div className="product-actions">
              <button className="edit">Edit</button>
              <button className="delete">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VendorProducts; 