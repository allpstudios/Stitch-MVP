import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getProduct } from '../utils/shopifyClient';
import './ProductDetail.css';
import { useCart } from '../context/CartContext';

const ProductDetail = ({ product }) => {
  const { id } = useParams();
  const [productData, setProductData] = useState(null);
  const [mainImage, setMainImage] = useState('');

  // Add this fixed array of sizes
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  
  // Update the quantities state to handle color-size combinations
  const [quantities, setQuantities] = useState({});

  // Add a price mapping for different sizes (you can adjust these values)
  const SIZE_PRICES = {
    'XS': 11.90,
    'S': 11.90,
    'M': 11.90,
    'L': 11.90,
    'XL': 13.90,
    '2XL': 15.90,
    '3XL': 15.90
  };

  // Add new state for active tab
  const [activeTab, setActiveTab] = useState('description');

  // Add sample specs (you'll want to get this from your product data)
  const productSpecs = {
    Material: "100% Cotton",
    Weight: "14 oz",
    Fabric: "Garment-Dyed Heavyweight",
    Fit: "Classic Fit",
    Care: "Machine wash cold, tumble dry low"
  };

  const { addToCart } = useCart();

  useEffect(() => {
    const fetchProduct = async () => {
      console.log('Fetching product with ID:', id);
      try {
        // Construct the full Shopify GID
        const fullGid = `gid://shopify/Product/${id}`;
        const productData = await getProduct(fullGid);
        console.log('Fetched product data:', productData);
        setProductData(productData);
        if (productData?.images?.edges?.[0]?.node?.url) {
          setMainImage(productData.images.edges[0].node.url);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      }
    };
    fetchProduct();
  }, [id]);

  if (!productData) {
    return <div className="product-detail-container">Loading...</div>;
  }

  // Extract available colors from variants
  const colors = [...new Set(productData.variants.edges.map(
    edge => edge.node.selectedOptions.find(opt => opt.name === 'Color')?.value
  ).filter(Boolean))];

  // Create a grid of sizes and prices per color
  const SizeQuantityGrid = () => {
    // Get all variants from Shopify data
    const variants = productData.variants.edges.map(({ node }) => ({
      color: node.selectedOptions.find(opt => opt.name === 'Color')?.value,
      size: node.selectedOptions.find(opt => opt.name === 'Size')?.value,
      price: parseFloat(node.price.amount),
      quantity: node.quantityAvailable
    }));

    // Get unique colors and sizes
    const colors = [...new Set(variants.map(v => v.color))];
    const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    
    // Create price mapping
    const sizePriceMap = {};
    variants.forEach(variant => {
      if (!sizePriceMap[variant.size]) {
        sizePriceMap[variant.size] = variant.price;
      }
    });

    return (
      <div className="size-quantity-grid">
        <div className="grid-header">
          <div>Color</div>
          {sizeOrder.map(size => (
            <div key={size} className="size-column">
              <div className="size-label">{size}</div>
              <div className="price-label">${sizePriceMap[size]?.toFixed(2) || '0.00'}</div>
            </div>
          ))}
        </div>
        
        {colors.map(color => (
          <div key={color} className="grid-row">
            <div className="color-cell">
              <div 
                className="color-indicator" 
                style={{ 
                  backgroundColor: 
                    color === 'Army Green' ? '#4b5320' :
                    color === 'Vintage Black' ? '#808080' :
                    color === 'White' ? '#ffffff' :
                    color === 'Beige' ? '#f5f5dc' : '#ddd',
                  border: color === 'White' ? '1px solid #ddd' : '1px solid rgba(0,0,0,0.1)'
                }}
              />
              {color}
            </div>
            {sizeOrder.map(size => {
              const variant = variants.find(v => v.color === color && v.size === size);
              return (
                <div key={size} className="quantity-column">
                  <input
                    type="number"
                    value={quantities[`${color}-${size}`] || 0}
                    onChange={(e) => setQuantities({
                      ...quantities,
                      [`${color}-${size}`]: parseInt(e.target.value) || 0
                    })}
                    min="0"
                    max={variant?.quantity || 0}
                  />
                  <div className="quantity-available">
                    {variant?.quantity || 0} available
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="product-detail-container">
      <div className="product-content">
        <div className="product-gallery">
          <div className="main-image">
            <img 
              src={mainImage || productData.images.edges[0].node.url} 
              alt={productData.title} 
            />
          </div>
          <div className="thumbnail-gallery">
            {productData.images.edges.map((image, index) => (
              <div 
                key={index} 
                className="thumbnail"
                onClick={() => setMainImage(image.node.url)}
              >
                <img src={image.node.url} alt={`${productData.title} view ${index + 1}`} />
              </div>
            ))}
          </div>
        </div>

        <div className="product-info">
          <div className="product-header">
            <h1>{productData.title}</h1>
            <div className="sustainable-tag">Sustainable Style</div>
          </div>

          <div className="size-quantity-section">
            <SizeQuantityGrid />
            
            <div className="action-buttons">
              <button 
                className="add-to-cart"
                onClick={() => {
                  addToCart(productData, quantities);
                  alert('Added to cart!');
                }}
              >
                Add to Cart
              </button>
            </div>

            <div className="product-tabs">
              <div className="tab-buttons">
                <button 
                  className={`tab-button ${activeTab === 'description' ? 'active' : ''}`}
                  onClick={() => setActiveTab('description')}
                >
                  Description
                </button>
                <button 
                  className={`tab-button ${activeTab === 'specs' ? 'active' : ''}`}
                  onClick={() => setActiveTab('specs')}
                >
                  Specs
                </button>
              </div>
              
              <div className="tab-content">
                {activeTab === 'description' ? (
                  <div className="description-content">
                    {productData.description}
                  </div>
                ) : (
                  <div className="specs-content">
                    {Object.entries(productSpecs).map(([key, value]) => (
                      <div key={key} className="spec-row">
                        <div className="spec-label">{key}</div>
                        <div className="spec-value">{value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail; 