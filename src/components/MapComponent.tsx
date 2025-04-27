import React, { useCallback, useState, useRef } from 'react';
import { GoogleMap, useJsApiLoader, LoadScriptProps, Circle } from '@react-google-maps/api';

// Define map container style
const containerStyle: React.CSSProperties = {
  width: '100%',
  height: '100%', // Use 100% to fill parent container
  minHeight: '300px', // Ensure a minimum height
};

// Define the types for the props expected by MapComponent
interface MapComponentProps {
  apiKey: string;
  initialCenter: google.maps.LatLngLiteral; // e.g. { lat: 37.7749, lng: -122.4194 }
  initialZoom?: number;
  onViewportChange: (latitude: number, longitude: number, radiusMeters: number) => void;
}

// Specify geometry library for radius calculation
const libraries: LoadScriptProps['libraries'] = ['geometry'];

// Define options for the circle overlay
const circleOptions = {
  strokeColor: '#FF0000',
  strokeOpacity: 0.8,
  strokeWeight: 2,
  fillColor: '#FF0000',
  fillOpacity: 0.15,
  clickable: false,
  draggable: false,
  editable: false,
  visible: true,
  zIndex: 1
};

// Maximum radius allowed by Google Places API
const MAX_RADIUS_METERS = 50000;

function MapComponent({ 
  apiKey, 
  initialCenter, 
  initialZoom = 13, 
  onViewportChange 
}: MapComponentProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: libraries,
  });

  // State to hold the map instance
  const [map, setMap] = useState<google.maps.Map | null>(null);
  // Ref to hold the Circle instance
  const circleRef = useRef<google.maps.Circle | null>(null);

  // State to track the last reported viewport values to prevent loops
  const [lastReportedCenter, setLastReportedCenter] = useState<google.maps.LatLngLiteral | null>(null);
  const [lastReportedRadius, setLastReportedRadius] = useState<number | null>(null);

  // Function to calculate radius based on map bounds
  const calculateRadius = useCallback((currentMap: google.maps.Map | null): number => {
    if (!currentMap || !currentMap.getBounds() || !currentMap.getCenter()) {
      console.log("calculateRadius: Map, Bounds or Center not ready");
      return 0;
    }
    const bounds = currentMap.getBounds() as google.maps.LatLngBounds;
    const center = currentMap.getCenter() as google.maps.LatLng; 

    // Calculate distance from center to the middle of the top edge
    const ne = bounds.getNorthEast();
    const topCenter = new google.maps.LatLng(ne.lat(), center.lng());
    const radius = google.maps.geometry.spherical.computeDistanceBetween(center, topCenter);
    
    // console.log(`calculateRadius: Raw Radius = ${radius}`); // Keep commented for now
    
    // Clamp the radius to the maximum allowed
    const cappedRadius = Math.min(radius, MAX_RADIUS_METERS);
    // console.log(`calculateRadius: Capped Radius = ${cappedRadius}`); // Keep commented for now
    return cappedRadius;
  }, []);

  // Callback when the map instance is ready
  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Callback when the map finishes moving (pan or zoom)
  const onIdle = useCallback(() => {
    const currentMapCenter = map?.getCenter(); 
    if (!map || !currentMapCenter) return; 
 
    const newLat = currentMapCenter.lat();
    const newLng = currentMapCenter.lng();
    const newRadius = calculateRadius(map); // This is already capped

    // Define a small tolerance for radius comparison
    const RADIUS_TOLERANCE_METERS = 1; // Only update if radius changes by more than 1 meter

    // Check if center or radius has changed significantly compared to the last reported values
    const centerChanged = !lastReportedCenter || lastReportedCenter.lat !== newLat || lastReportedCenter.lng !== newLng;
    const radiusChanged = !lastReportedRadius || Math.abs(lastReportedRadius - newRadius) > RADIUS_TOLERANCE_METERS;

    if (centerChanged || radiusChanged) {
      console.log(`Map Idle: Change detected. Updating Circle and Parent. Center: ${newLat},${newLng}, Radius: ${newRadius}`); // DEBUG LOG
      // Directly update the circle instance if it exists
      if (circleRef.current) {
        circleRef.current.setCenter({ lat: newLat, lng: newLng });
        circleRef.current.setRadius(newRadius);
      }

      // Update the state tracking the last reported values
      setLastReportedCenter({ lat: newLat, lng: newLng });
      setLastReportedRadius(newRadius);

      // Call the parent component's callback with the new viewport details
      onViewportChange(newLat, newLng, newRadius);
    } else {
      console.log("Map Idle: No significant change detected. Skipping update."); // DEBUG LOG
    }
  }, [map, onViewportChange, calculateRadius, lastReportedCenter, lastReportedRadius]); // Add state dependencies

  const onUnmount = useCallback(() => {
    setMap(null); // Clear the map instance on unmount
  }, []);

  // Simplified callbacks for direct Circle component
  const handleCircleLoad = useCallback((circle: google.maps.Circle) => {
    console.log("Circle onLoad triggered"); // DEBUG LOG
    circleRef.current = circle; 
    // Initialize last reported state when circle loads to allow first update
    if (map) {
      const center = map.getCenter();
      if (center) {
        const initialRadius = calculateRadius(map);
        setLastReportedCenter(center.toJSON()); 
        setLastReportedRadius(initialRadius);
        // Optionally trigger parent update immediately on load too
        // onViewportChange(center.lat(), center.lng(), initialRadius);
      } 
    }
  }, [map, calculateRadius]); // Add map dependency

  const handleCircleUnmount = useCallback(() => {
    console.log("Circle onUnmount triggered"); // DEBUG LOG
    circleRef.current = null;
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
      {/* Render the Circle overlay - managed by ref now */}
      {map && isLoaded && ( // Render Circle directly again
         <Circle
           onLoad={handleCircleLoad}
           onUnmount={handleCircleUnmount}
           center={initialCenter} // Static initial center
           radius={0} // Start with 0 radius, onIdle will set it
           options={circleOptions} // Static options
         />
      )}
      {/* Children components, like markers, can go here */}
    </GoogleMap>
  );
}

export default MapComponent;
