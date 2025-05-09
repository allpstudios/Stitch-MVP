import React from 'react';
import './Resources.css';
import { FaBookReader, FaCompass, FaPencilRuler } from 'react-icons/fa';

const RESOURCE_CATEGORIES = [
  {
    id: 'learn',
    title: 'Learn',
    description: 'Articles, industry insights, and expert tips for fashion brands and manufacturers',
    icon: <FaBookReader className="category-icon" />,
    color: '#FF69B4'
  },
  {
    id: 'guides',
    title: 'Guides',
    description: 'Step-by-step tutorials, how-tos, and best practices for production and manufacturing',
    icon: <FaCompass className="category-icon" />,
    color: '#9B5DE5'
  },
  {
    id: 'mockups',
    title: 'Mockup Packs',
    description: 'Professional design tools, mockup templates, and creative resources',
    icon: <FaPencilRuler className="category-icon" />,
    color: '#00BBF9'
  }
];

const Resources = () => {
  return (
    <div className="resources-page">
      <div className="resources-header">
        <h1>Resources</h1>
        <p>Everything you need to grow your fashion brand</p>
      </div>

      <div className="category-cards">
        {RESOURCE_CATEGORIES.map(category => (
          <div 
            key={category.id} 
            className="category-card"
            style={{ '--category-color': category.color }}
          >
            <div className="category-icon-wrapper">
              {category.icon}
            </div>
            <h2>{category.title}</h2>
            <p>{category.description}</p>
            <button className="explore-btn">
              Explore {category.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Resources; 