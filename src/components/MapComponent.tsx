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
  places: Place[]; // Add places prop
}

// Specify geometry library (no longer needed for radius)
const libraries: LoadScriptProps['libraries'] = [];

function MapComponent({ 
  apiKey, 
  initialCenter, 
  initialZoom = 13, 
  onViewportChange, 
  places 
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
    } else {
      console.log("Map Idle: No significant bounds change detected. Skipping update."); // DEBUG LOG
    }
  }, [map, onViewportChange, lastReportedBounds]); // Update dependencies

  const onUnmount = useCallback(() => {
    setMap(null); // Clear the map instance on unmount
  }, []);

  if (loadError) {
    return <div>Error loading maps: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <div>Loading Map...</div>;
  }

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={initialCenter} // Use initialCenter prop
      zoom={initialZoom}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onIdle={onIdle} // Trigger updates when map movement stops
      options={{ 
        // gestureHandling: 'greedy' 
      }}
    >
      {places.map((place) => (
        <MarkerF
          key={place.id}
          position={{ lat: place.location.latitude, lng: place.location.longitude }}
          title={place.displayName.text} 
        />
      ))}
    </GoogleMap>
  );
}

export default MapComponent;
