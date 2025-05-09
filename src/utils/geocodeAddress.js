/**
 * Geocodes an address using Google Maps Geocoding API
 * @param {string} address - The address to geocode
 * @returns {Promise<{lat: number, lng: number, address: string}>}
 */
export const geocodeAddress = async (address) => {
  try {
    if (!address || typeof address !== 'string') {
      console.error('Invalid address provided:', address);
      return null;
    }

    // Clean up the address string
    const cleanAddress = address.trim().replace(/\s+/g, ' ');
    
    const GOOGLE_MAPS_API_KEY = 'AIzaSyDEDfD9jbuYtbBYZoi_Cm0fO_ogI3csuKk';

    console.log('Starting geocoding for:', cleanAddress);
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        cleanAddress
      )}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    const data = await response.json();
    console.log('Geocoding response:', data);

    if (data.status === 'OK' && data.results && data.results[0]) {
      const result = data.results[0];
      const location = result.geometry.location;
      
      // Check if the result is too imprecise (like just a city or country)
      const isImprecise = !result.types.some(type => 
        ['street_address', 'premise', 'subpremise', 'route'].includes(type)
      );

      if (isImprecise) {
        console.warn('Geocoding result may be imprecise:', result.formatted_address);
      }

      return {
        lat: location.lat,
        lng: location.lng,
        address: result.formatted_address
      };
    }

    if (data.status === 'ZERO_RESULTS') {
      console.warn('No results found for address:', cleanAddress);
      return null;
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('Google Maps API request denied:', data.error_message);
      return null;
    }

    console.warn(`Geocoding failed with status: ${data.status}`);
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}; 