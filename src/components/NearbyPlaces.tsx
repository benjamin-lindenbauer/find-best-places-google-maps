import { useState, useEffect, useCallback } from 'react';
import MapComponent from './MapComponent'; // Import the new MapComponent

// Access the API key from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

interface Place {
    place_id: string;
    name: string;
    vicinity?: string;
    rating?: number;
    user_ratings_total?: number;
    types?: string[]; // Add types array to the interface
    // Add other relevant properties from the API response if needed
}

interface PlacesApiResponse {
    results: Place[];
    status: string;
    error_message?: string;
}

// Define the types for the dropdown
const placeTypes = [
    'food',
    'natural_feature',
    'place_of_worship',
    'point_of_interest',
    'atm',
    'campground',
    'landmark',
    'gym',
    'university',
    'supermarket',
    'train_station',
    'park',
    'meal_takeaway',
    'lodging',
    'restaurant'
];

// Define coordinates for Vienna as fallback
const viennaCenter = {
  lat: 48.2082,
  lng: 16.3738
};

function NearbyPlaces() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [error, setError] = useState<string | null>(null);
    // State for map's current viewport center and radius
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [radiusMeters, setRadiusMeters] = useState<number | null>(null);
    // Initialize mapCenter to null until geolocation attempt completes
    const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
    const [selectedType, setSelectedType] = useState<string>(''); // State for selected type filter

    // --- API Fetching --- 
    // Modified fetchNearbyPlaces to accept parameters
    const fetchNearbyPlaces = useCallback(async (lat: number, lng: number, radius: number) => {
        if (!GOOGLE_MAPS_API_KEY) {
            setError('API key is missing. Please add it to the .env file.');
            return;
        }
        if (lat === null || lng === null || radius === null) {
             // Don't fetch if map hasn't provided valid viewport yet
            return;
        }

        setError(null);

        // Use the Vite proxy path for development to avoid CORS
        let apiUrl = `/api/googlemaps/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&rankby=prominence&key=${GOOGLE_MAPS_API_KEY}`;

        // Append type if selected
        if (selectedType) {
            apiUrl += `&type=${selectedType}`;
        }

        try {
            const response = await fetch(apiUrl);
            const data: PlacesApiResponse = await response.json();

            if (data.status === 'OK') {
                setPlaces(data.results || []);
            } else if (data.status === 'ZERO_RESULTS') {
                setPlaces([]); // Clear places if no results
                // Optional: setError('No places found matching your criteria in this area.');
            } else {
                console.error('Google Places API Error:', data.status, data.error_message);
                setError(`API Error: ${data.error_message || data.status}`);
                setPlaces([]); // Clear places on error
            }
        } catch (err) {
            console.error('Network or Fetch Error:', err);
            setError(`An unexpected error occurred.`);
            setPlaces([]); // Clear places on error
        }
    }, [selectedType]); // Depend only on selectedType for *refetching* with same location

    // Effect to fetch places when selectedType changes (using current map viewport)
    useEffect(() => {
        if (latitude !== null && longitude !== null && radiusMeters !== null) {
            fetchNearbyPlaces(latitude, longitude, radiusMeters);
        }
        // This effect runs when selectedType changes, OR when the initial valid viewport is set
    }, [selectedType, latitude, longitude, radiusMeters, fetchNearbyPlaces]);


    // Effect to determine initial map center (Geolocation or Fallback)
    useEffect(() => {
        if (!navigator.geolocation) {
            console.log('Geolocation not supported, defaulting to Vienna.');
            setMapCenter(viennaCenter);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('Geolocation success, using device location.');
                setMapCenter({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                });
            },
            (err) => {
                console.warn(`Geolocation failed (${err.message}), defaulting to Vienna.`);
                setMapCenter(viennaCenter);
            }
        );
    }, []); // Run only once on mount

    // --- Callback for MapComponent --- 
    const handleMapViewportChange = useCallback((lat: number, lng: number, radius: number) => {
        // Update state with the new viewport details from the map
        setLatitude(lat);
        setLongitude(lng);
        setRadiusMeters(radius);
        setMapCenter({ lat, lng }); // Optionally update map center state if needed elsewhere
        
        // Trigger fetch with the new map viewport
        // fetchNearbyPlaces is already called by the useEffect above when lat/lng/radius change
        // No need to call it directly here unless the useEffect dependencies are different

    }, []); // No dependencies needed here, it just sets state

    // Filter places by selected type
    const filteredPlaces = places.filter(place => !selectedType || place.types?.includes(selectedType));

    return (
        // Make the main container full height
        <div className="nearby-places-container w-full h-screen flex flex-col">
            {/* Top Section: Title and Filters */}
            <div className='flex flex-row items-center justify-between w-full gap-4 p-4'>
                <h1>Top Prominent Places</h1>
                <select 
                    id="placeType"
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="rounded-md dark:bg-gray-800 dark:text-white shadow-sm focus:ring-indigo-500 text-sm py-1.5 pl-2 pr-8"
                >
                    <option value="">All Types</option>
                    {placeTypes.map(type => (
                        <option key={type} value={type}>
                            {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} {/* Format for display */}
                        </option>
                    ))}
                </select>
            </div>

            {/* Main Content Area: Two Columns */}
            <div className="flex flex-row flex-grow overflow-hidden"> {/* flex-grow makes this fill remaining height */}
                {/* Left Column: Map */}
                <div className="w-2/3 h-full p-2"> {/* Map column takes 2/3 width */}
                    {/* Render Map Component only after initial center is determined */} 
                    {mapCenter && GOOGLE_MAPS_API_KEY ? (
                        <MapComponent 
                            apiKey={GOOGLE_MAPS_API_KEY} 
                            initialCenter={mapCenter} 
                            onViewportChange={handleMapViewportChange} 
                        />
                    ) : (
                         !GOOGLE_MAPS_API_KEY ? (
                            <div className="text-red-500 dark:text-red-400 p-4 border border-red-500 dark:border-red-400 rounded-md mb-4 flex items-center justify-center h-full">
                                Map cannot be displayed: Google Maps API Key is missing. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file.
                            </div>
                         ) : (
                            <div className="flex items-center justify-center h-full">Determining initial map location...</div> // Show message while waiting for geolocation
                         )
                    )}
                </div>

                {/* Right Column: Place List */}
                <div className="w-1/3 h-full overflow-y-auto p-2"> {/* List column takes 1/3 width, scrolls vertically */} 
                    {/* Display Loading/Error specific to API fetch */} 
                    {error && <div style={{ color: 'red', marginBottom: '1rem' }}>Error fetching places: {error}</div>}
                    {/* You might want a dedicated loading state for the API call triggered by map changes */} 
                    {/* {isFetchingPlaces && <div>Loading places for map area...</div>} */} 

                    {/* Display List */} 
                    {filteredPlaces.length > 0 ? (
                        <ul className="nearby-places-list list-none p-0">
                            {filteredPlaces.sort((a, b) => (b.user_ratings_total || 0) - (a.user_ratings_total || 0))
                            .map((place) => {
                                // Construct Google Maps URL
                                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}&query_place_id=${place.place_id}`;
                                
                                const handleClick = () => {
                                    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                                };

                                return (
                                    <li 
                                        key={place.place_id} 
                                        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-4 hover:shadow-lg transition-shadow duration-200 ease-in-out cursor-pointer"
                                        onClick={handleClick}
                                    >
                                        <strong className="block font-bold text-lg text-gray-900 dark:text-white mb-1">{place.name}</strong>
                                        {place.vicinity && <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{place.vicinity}</p>}
                                        {/* Render Types as Tags */} 
                                        {place.types && place.types.length > 0 && (
                                            <div className="flex flex-wrap w-full justify-center gap-1 mb-2">
                                                {place.types.map(type => (
                                                    <span 
                                                        key={type} 
                                                        className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-medium px-2 py-0.5 rounded cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-700 transition-colors duration-150"
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent card click event
                                                            // Only set type if it's one of the allowed types in our dropdown list
                                                            if (placeTypes.includes(type)) {
                                                              setSelectedType(type); 
                                                            }
                                                        }}
                                                    >
                                                        {type.replace(/_/g, ' ')} {/* Simple formatting */}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {place.rating && (
                                            <p className="text-sm mb-1">
                                                <span className="text-yellow-500">★ {place.rating.toFixed(1)}</span> 
                                                <span className="text-xs text-gray-500 dark:text-gray-300 ml-2">({place.user_ratings_total} reviews)</span>
                                            </p>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                         !error && latitude && longitude && (
                             <p className="text-gray-500 dark:text-gray-400 text-center p-4">No places found matching your criteria in the current map area.</p>
                         )
                         // Don't show 'No places' if there's an error or location is not ready
                    )}
                </div>
            </div>
        </div>
    );
}

export default NearbyPlaces;
