import screenPrinterIcon from '../assets/markers/screen-printer.svg';

export const getMarkerIcon = (categories) => {
  if (!categories || categories.length === 0) {
    return null;
  }

  // Map category to a specific color
  const categoryColors = {
    'Screen Printer': '#FF5A5F',          // Red
    'Fabric Vendor': '#00A699',           // Teal
    'Dye House': '#7B0051',               // Purple
    'Cut & Sew Manufacturer': '#FC642D',  // Orange
    'Supplies & Hardware': '#FFAA91',     // Light Orange
    'Blank Vendors': '#FF9A5B',           // Peach
    'Embroidery': '#8CE071',              // Light Green
    'DTG Printer': '#00D1C1',             // Turquoise
    'DTF Transfers': '#374B92',           // Blue
    '3PL Fullfilment': '#5658DD',         // Indigo
    'Hat Vendor': '#6E7582',              // Gray
    'Rhinestone Vendor': '#F8526C',       // Pink
    'Patch Vendor': '#C2B280',            // Tan
    'Photo Studios': '#5F9EA0'            // Cadet Blue
  };

  // If it's a screen printer and we have the SVG icon, use it
  if (categories.includes('Screen Printer') && screenPrinterIcon) {
    return {
      url: screenPrinterIcon,
      scaledSize: { width: 40, height: 40 },
      anchor: { x: 20, y: 40 },
      labelOrigin: { x: 20, y: -10 }
    };
  }

  // Otherwise, find the first matching category with a defined color
  for (const category of categories) {
    if (categoryColors[category]) {
      // Return a colored SVG marker
      return {
        path: 'M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z',
        fillColor: categoryColors[category],
        fillOpacity: 1,
        strokeWeight: 1,
        strokeColor: '#000000',
        rotation: 0,
        scale: 1.5,
        anchor: { x: 12, y: 22 },
        labelOrigin: { x: 12, y: 0 }
      };
    }
  }

  // Default marker for other categories (gray)
  return {
    path: 'M12,2C8.13,2 5,5.13 5,9c0,5.25 7,13 7,13s7,-7.75 7,-13c0,-3.87 -3.13,-7 -7,-7zM12,11.5c-1.38,0 -2.5,-1.12 -2.5,-2.5s1.12,-2.5 2.5,-2.5 2.5,1.12 2.5,2.5 -1.12,2.5 -2.5,2.5z',
    fillColor: '#9E9E9E',
    fillOpacity: 1,
    strokeWeight: 1,
    strokeColor: '#000000',
    rotation: 0,
    scale: 1.5,
    anchor: { x: 12, y: 22 },
    labelOrigin: { x: 12, y: 0 }
  };
}; 