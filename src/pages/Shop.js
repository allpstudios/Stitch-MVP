import React, { useState, useEffect } from 'react';
import { getProducts } from '../utils/shopifyClient';
import './Shop.css';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

const CATEGORIES = [
  { id: 'all', label: 'All Products' },
  { 
    id: 'TOPS', 
    label: 'Tops',
    submenu: ['T-Shirts', 'HOODIE', 'SWEATER']
  },
  { 
    id: 'BOTTOMS', 
    label: 'Bottoms',
    submenu: ['SHORTS', 'SWEATPANTS', 'JEANS']
  },
  { 
    id: 'HEADWEAR', 
    label: 'Headwear',
    submenu: ['DAD-CAP', 'TRUCKER-CAP', 'BEANIE']
  },
  { 
    id: 'BAGS', 
    label: 'Bags',
    submenu: ['TOTE-BAG', 'DUFFEL-BAG']
  },
  { 
    id: 'SUPPLIES', 
    label: 'Supplies',
    submenu: ['HARDWARE', 'PACKAGING']
  }
];

const SIDEBAR_MENUS = {
  'Hoodies': [
    'Pullover',
    'Zip-up',
    'Oversized',
    'Cropped'
  ],
  'Pants': [
    'Sweatpants',
    'Joggers',
    'Cargo',
    'Athletic'
  ],
  'T-shirt': [
    'Crew Neck',
    'V-Neck',
    'Oversized',
    'Fitted'
  ],
  'Hat': [
    'Snapback',
    'Fitted',
    'Dad Hat',
    'Beanie'
  ]
};

const Shop = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      console.log('Fetching products...');
      try {
        const fetchedProducts = await getProducts();
        console.log('Products fetched with types:', fetchedProducts.map(p => ({
          title: p.title,
          type: p.productType,
          tags: p.tags
        })));
        setProducts(fetchedProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      }
      setLoading(false);
    };

    fetchProducts();
  }, []);

  // Add debug log for category changes
  useEffect(() => {
    console.log('Active category changed to:', activeCategory);
  }, [activeCategory]);

  const filteredProducts = activeCategory === 'all' 
    ? products 
    : products.filter(product => {
        // Handle null/undefined productType
        if (!product.productType) {
          console.log(`Product ${product.title} has no type`);
          return false;
        }
        
        const productType = product.productType;  // Keep original case
        const productTags = product.tags || [];   // Keep original case
        
        console.log('Checking product:', {
          title: product.title,
          type: productType,
          tags: productTags,
          activeCategory
        });

        // If the activeCategory contains a hyphen, it's a submenu item
        if (activeCategory.includes('-')) {
          const [mainCategory, ...subCategoryParts] = activeCategory.split('-');
          const subCategory = subCategoryParts.join('-'); // Join back parts in case of multiple hyphens
          
          console.log(`Filtering for main category: ${mainCategory}, subcategory: ${subCategory}`);
          
          // For T-Shirts category
          if (subCategory === 'T-Shirts') {
            // Check for various T-shirt type formats
            const isMatch = ['T-Shirts', 'T-SHIRT', 'T-SHIRTS', 'TSHIRT', 'T SHIRT'].some(type => 
              productType.toUpperCase() === type.toUpperCase() || productTags.some(tag => tag.toUpperCase() === type.toUpperCase())
            );
            console.log(`${product.title} T-Shirts match:`, {
              productType,
              productTags,
              subCategory,
              isMatch
            });
            return isMatch;
          }
          
          // For HOODIE category
          if (subCategory === 'HOODIE') {
            const isMatch = ['HOODIE', 'Hoodie', 'HOODIES'].some(type => 
              productType.toUpperCase() === type.toUpperCase() || productTags.some(tag => tag.toUpperCase() === type.toUpperCase())
            );
            return isMatch;
          }
          
          // For other categories - case insensitive comparison
          const matchesType = productType.toUpperCase() === subCategory.toUpperCase();
          const matchesTags = productTags.some(tag => tag.toUpperCase() === subCategory.toUpperCase());
          const matches = matchesType || matchesTags;
          
          console.log(`${product.title} category match:`, {
            mainCategory,
            subCategory,
            productType,
            matchesType,
            matchesTags,
            matches
          });
          
          return matches;
        }
        
        // For main categories
        const matches = productType === activeCategory || productTags.includes(activeCategory);
        console.log(`${product.title} main category match:`, {
          category: activeCategory,
          productType,
          matches
        });
        return matches;
      });

  // If you want to search by name as well
  const searchedProducts = filteredProducts.filter(product => {
    if (!searchTerm) return true;
    return product.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const ColorSwatches = ({ colors }) => {
    // Filter out any null/undefined values and get unique colors
    const uniqueColors = [...new Set(colors.filter(Boolean))];
    
    // If 4 or fewer colors, show them all
    if (uniqueColors.length <= 4) {
      return (
        <div className="color-swatches">
          {uniqueColors.map((color, index) => (
            <div
              key={index}
              className="color-swatch"
              style={{ backgroundColor: color.toLowerCase() }}
            />
          ))}
        </div>
      );
    }

    // If more than 4 colors, show first 4 plus count
    return (
      <div className="color-swatches">
        {uniqueColors.slice(0, 4).map((color, index) => (
          <div
            key={index}
            className="color-swatch"
            style={{ backgroundColor: color.toLowerCase() }}
          />
        ))}
        <span className="remaining-colors">+{uniqueColors.length - 4}</span>
      </div>
    );
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="shop-container">
      <div className="shop-header">
        <h1>Shop Apparel & Supplies</h1>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <nav className="category-nav">
          {CATEGORIES.map(category => (
            <div key={category.id} className="category-item">
              <button
                className={`category-button ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
              </button>
              {category.submenu && (
                <div className="category-dropdown">
                  {category.submenu.map(item => (
                    <button
                      key={item}
                      className="dropdown-item"
                      onClick={() => {
                        const newCategory = `${category.id}-${item}`;
                        console.log('Setting category to:', newCategory);
                        setActiveCategory(newCategory);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <div className="products-grid">
          {searchedProducts.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Shop; 