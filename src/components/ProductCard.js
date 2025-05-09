import React from 'react';
import { Link } from 'react-router-dom';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  // Get variants from Shopify data
  const variants = product.variants.edges.map(edge => ({
    id: edge.node.id,
    title: edge.node.title,
    price: parseFloat(edge.node.price.amount),
    color: edge.node.selectedOptions.find(opt => opt.name === 'Color')?.value,
    size: edge.node.selectedOptions.find(opt => opt.name === 'Size')?.value,
  }));

  // Get unique colors
  const colors = [...new Set(variants.map(v => v.color))].filter(Boolean);

  // Get size range
  const sizes = [...new Set(variants.map(v => v.size))].filter(Boolean)
    .sort((a, b) => {
      const sizeOrder = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
      return sizeOrder.indexOf(a) - sizeOrder.indexOf(b);
    });
  const sizeRange = `${sizes[0]} - ${sizes[sizes.length - 1]}`;

  // Get starting price
  const startingPrice = parseFloat(product.priceRange.minVariantPrice.amount);

  const ColorSwatches = () => {
    return (
      <div className="color-swatches">
        {colors.map(color => (
          <div
            key={color}
            className="color-swatch"
            style={{ 
              backgroundColor: 
                color === 'Army Green' ? '#4b5320' :
                color === 'Vintage Black' ? '#808080' :
                color === 'White' ? '#ffffff' :
                color === 'Beige' ? '#f5f5dc' : '#ddd',
              border: (color === 'White' || color === 'Beige') ? '1px solid #ddd' : '1px solid rgba(0,0,0,0.1)'
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <Link to={`/product/${product.id.split('/').pop()}`} className="product-card">
      <div className="product-image">
        {product.images?.edges[0]?.node.url && (
          <img 
            src={product.images.edges[0].node.url} 
            alt={product.title} 
          />
        )}
      </div>
      <div className="product-info">
        <div className="price">Starting at ${startingPrice.toFixed(2)}</div>
        <h3 className="product-title">{product.title}</h3>
        <div className="product-variants">
          <ColorSwatches />
          <div className="size-range">{sizeRange}</div>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard; 