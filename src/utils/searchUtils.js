export const generateSearchKeywords = (profileData) => {
  const keywords = new Set();

  // Add company name words
  profileData.companyName.toLowerCase().split(/\s+/).forEach(word => {
    if (word) keywords.add(word);
  });

  // Add categories
  profileData.categories.forEach(category => {
    keywords.add(category.toLowerCase());
    // Add individual words from category
    category.toLowerCase().split(/\s+/).forEach(word => {
      if (word) keywords.add(word);
    });
  });

  // Add words from description
  if (profileData.description) {
    profileData.description.toLowerCase().split(/\s+/).forEach(word => {
      if (word) keywords.add(word);
    });
  }

  // Add services/specialties keywords
  const serviceKeywords = [
    'printing', 'embroidery', 'manufacturing', 'wholesale',
    'custom', 'blank', 'apparel', 'clothing', 'fabric',
    'textile', 'production', 'supplier', 'vendor'
  ];

  serviceKeywords.forEach(keyword => {
    if (profileData.description?.toLowerCase().includes(keyword)) {
      keywords.add(keyword);
    }
  });

  return Array.from(keywords);
}; 