import { GoogleMap, InfoWindow, Marker } from '@react-google-maps/api';

const Map = ({ 
  mapRef, 
  onMapLoad, 
  mapError, 
  isLoading, 
  filteredVendors, 
  selectedVendor, 
  setSelectedVendor,
  getMarkerIcon,
}) => {
  const defaultCenter = {
    lat: 34.0356,
    lng: -118.2529
  };

  const MAP_STYLES = [
    {
      featureType: "poi",
      elementType: "labels",
      stylers: [{ visibility: "off" }]
    }
  ];

  if (mapError) {
    return <div className="map-error">Error loading map. Please try again later.</div>;
  }

  console.log('Map received vendors:', filteredVendors.map(v => ({
    id: v.id,
    location: v.location,
    name: v.companyName
  })));

  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      zoom={13}
      center={defaultCenter}
      options={{
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: MAP_STYLES
      }}
      onLoad={onMapLoad}
    >
      {!isLoading && filteredVendors.map((vendor) => {
        console.log('Rendering marker for:', vendor.companyName, vendor.location);
        return (
          <Marker
            key={vendor.id}
            position={{
              lat: vendor.location?.lat || defaultCenter.lat,
              lng: vendor.location?.lng || defaultCenter.lng
            }}
            onClick={() => {
              setSelectedVendor(vendor);
              const card = document.querySelector(`[data-vendor-id="${vendor.id}"]`);
              if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }}
            icon={getMarkerIcon(vendor.categories)}
            title={vendor.companyName}
          />
        );
      })}
      
      {selectedVendor && (
        <InfoWindow
          position={{
            lat: selectedVendor.location?.lat || defaultCenter.lat,
            lng: selectedVendor.location?.lng || defaultCenter.lng
          }}
          onCloseClick={() => setSelectedVendor(null)}
        >
          <div className="info-window">
            <h3>{selectedVendor.companyName}</h3>
            <p>{selectedVendor.categories.join(', ')}</p>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
};

export default Map; 