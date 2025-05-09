export const colorMap = {
  'Army Green': '#4b5320',
  'Vintage Black': '#2f2f2f',
  'Beige': '#f5f5dc',
  'White': '#ffffff',
  'Black': '#000000',
  'Navy': '#000080',
  'Royal': '#4169e1',
  'Red': '#8b0000',
  'Gold': '#ffd700',
  'Grey': '#808080'
  // Add more color mappings as needed
};

export const getColorValue = (colorName) => {
  // First try exact match
  if (colorMap[colorName]) {
    return colorMap[colorName];
  }
  
  // Try case-insensitive match
  const normalizedName = colorName.toLowerCase();
  const foundColor = Object.entries(colorMap).find(([key]) => 
    key.toLowerCase() === normalizedName
  );
  
  return foundColor ? foundColor[1] : '#ddd'; // Return a default color if no match
}; 