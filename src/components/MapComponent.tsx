import React, { useCallback, useState } from 'react';
import { GoogleMap, useJsApiLoader, LoadScriptProps, MarkerF } from '@react-google-maps/api';

// Define map container style
const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%', // Use 100% to fill parent container
  minHeight: '300px', // Ensure a minimum height
};

// Define the types for the props expected by MapComponent
interface Place {
  id: string;
  displayName: {
    text: string;
  };
  location: {
    latitude: number;
    longitude: number;
  };
}

interface MapComponentProps {
  apiKey: string;
  initialCenter: google.maps.LatLngLiteral; // e.g. { lat: 37.7749, lng: -122.4194 }
  initialZoom?: number;
  onViewportChange: (bounds: google.maps.LatLngBoundsLiteral | null) => void;
  places: Place[];
  hoveredPlaceId: string | null;
  userLocation: google.maps.LatLngLiteral | null;
}

// Specify geometry library (no longer needed for radius)
const libraries: LoadScriptProps['libraries'] = [];

function MapComponent({ 
  apiKey, 
  initialCenter, 
  initialZoom = 13, 
  onViewportChange, 
  places,
  hoveredPlaceId,
  userLocation // Destructure userLocation
}: MapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  // State to hold the map instance
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // State to track the last reported viewport values to prevent loops
  const [lastReportedBounds, setLastReportedBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null);

  // Callback when the map instance is ready
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Callback when the map finishes moving (pan or zoom)
  const onIdle = useCallback(() => {
    const currentMapBounds = map?.getBounds();
    if (!map || !currentMapBounds) return;

    const newBoundsLiteral = currentMapBounds.toJSON(); // Get bounds as literal

    // Check if bounds have changed significantly compared to the last reported values
    // Simple object comparison (adjust if deeper comparison needed for edge cases)
    const boundsChanged = JSON.stringify(lastReportedBounds) !== JSON.stringify(newBoundsLiteral);

    if (boundsChanged) {
      // Update the state tracking the last reported values
      setLastReportedBounds(newBoundsLiteral);

      // Call the parent component's callback with the new viewport bounds
      onViewportChange(newBoundsLiteral);
    }
  }, [map, onViewportChange, lastReportedBounds]); // Update dependencies

  const onUnmount = useCallback(() => {
    setMap(null); // Clear the map instance on unmount
  }, []);

  // Handler to re-center the map on user's location
  const handleCenterOnUser = useCallback(() => {
    if (map && userLocation) {
      map.panTo(userLocation);
      // Optional: set zoom level as well if needed
      // map.setZoom(15);
    }
  }, [map, userLocation]);

  if (loadError) {
    return <div>Error loading maps: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  // Define a simple blue dot SVG icon for the user's location
  const userLocationIcon = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: '#4285F4', // Google Blue
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 8, // Adjust size as needed
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GoogleMap
        mapContainerStyle={containerStyle} // Use style that fills the relative parent
        center={initialCenter} // Use initialCenter for the first load
        zoom={initialZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={onIdle} // Trigger updates when map movement stops
        options={{ 
          // gestureHandling: 'greedy' 
        }}
      >
        {/* Markers for places */}
        {places.map((place) => (
          <MarkerF
            key={place.id}
            position={{ lat: place.location.latitude, lng: place.location.longitude }}
            title={place.displayName.text}
            zIndex={place.id === hoveredPlaceId ? 100 : 1}
            animation={place.id === hoveredPlaceId && window.google ? window.google.maps.Animation.BOUNCE : undefined}
          />
        ))}

        {/* Marker for User's Location */}
        {userLocation && (
          <MarkerF
            position={userLocation}
            title="Your Location"
            icon={userLocationIcon} // Use the custom blue dot icon
            zIndex={10} // Ensure user marker is potentially above place markers if overlapping
          />
        )}
      </GoogleMap>

      {/* Button to center on user location */} 
      {userLocation && (
          <button
              onClick={handleCenterOnUser}
              title="Center on my location"
              style={{
                  position: 'absolute',
                  top: '60px',
                  right: '10px',
                  zIndex: 10, // Ensure button is above map tiles
                  backgroundColor: 'white',
                  border: '2px solid rgba(0,0,0,0.2)',
                  borderRadius: '50%', // Make it circular
                  padding: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
              }}
          >
              {/* Simple SVG My Location Icon */} 
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 8C9.79 8 8 9.79 8 12C8 14.21 9.79 16 12 16C14.21 16 16 14.21 16 12C16 9.79 14.21 8 12 8ZM20.94 11C20.48 6.83 17.17 3.52 13 3.06V1H11V3.06C6.83 3.52 3.52 6.83 3.06 11H1V13H3.06C3.52 17.17 6.83 20.48 11 20.94V23H13V20.94C17.17 20.48 20.48 17.17 20.94 13H23V11H20.94ZM12 19C8.13 19 5 15.87 5 12C5 8.13 8.13 5 12 5C15.87 5 19 8.13 19 12C19 15.87 15.87 19 12 19Z" fill="#555"/>
              </svg>
          </button>
      )}
    </div>
  );
}

export default MapComponent;
