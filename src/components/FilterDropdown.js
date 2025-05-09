import React from 'react';
import './FilterDropdown.css';

const FilterDropdown = ({ selectedTypes, onTypeChange, types }) => {
  return (
    <div className="filter-buttons">
      {types.map((type, index) => (
        <button
          key={index}
          className={`filter-button ${selectedTypes.includes(type) ? 'active' : ''}`}
          onClick={() => onTypeChange(type)}
        >
          {type}
        </button>
      ))}
    </div>
  );
};

export default FilterDropdown; 