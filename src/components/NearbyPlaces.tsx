import { useState, useEffect } from 'react';

// IMPORTANT: Replace with your actual Google Maps API key
// Also ensure the Places API is enabled in your Google Cloud Console project.
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
    'gym',
    'university',
    'supermarket',
    'train_station',
    'park',
    'meal_takeaway',
    'lodging',
    'restaurant'
];

function NearbyPlaces() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [error, setError] = useState<string | null>(null);
    // State for user's location
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    // State for filtering
    const [minRating, setMinRating] = useState<number>(4.0);
    const [minReviews, setMinReviews] = useState<number>(100);
    const [selectedType, setSelectedType] = useState<string>(''); // State for selected type filter
    const [radiusKm, setRadiusKm] = useState<number>(100); // State for radius in KM

    // 1. Effect to get user's location on mount
    useEffect(() => {
        setLocationError(null);
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
            },
            (err) => {
                setLocationError(`Failed to get location: ${err.message}. Please ensure location services are enabled and permission is granted.`);
            }
        );
    }, []); // Runs once on mount

    // 2. Effect to fetch places *after* location is obtained
    useEffect(() => {
        // Only fetch if we have coordinates and a valid API key
        if (latitude === null || longitude === null || !GOOGLE_MAPS_API_KEY) {
            // Set error if API key is missing and location is available
            if (latitude !== null && longitude !== null && !GOOGLE_MAPS_API_KEY) {
                 setError('API key is missing. Please add it to the .env file.');
            }
            // Do not fetch if location is not yet available or key is missing
            return;
        }

        const fetchNearbyPlaces = async () => {
            setError(null);
            setLocationError(null); // Clear location error if we proceed to fetch

            // Calculate radius in meters for the API
            const radiusMeters = radiusKm * 1000;

            // Use the Vite proxy path for development to avoid CORS
            let apiUrl = `/api/googlemaps/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radiusMeters}&rankby=prominence&key=${GOOGLE_MAPS_API_KEY}`;

            // Append type if selected
            if (selectedType) {
                apiUrl += `&type=${selectedType}`;
            }

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    // Attempt to parse Google's error response if available
                    let googleError = '';
                    try {
                        const errorData = await response.json();
                        googleError = `${errorData.status}${errorData.error_message ? ` - ${errorData.error_message}` : ''}`;
                    } catch { /* Ignore parsing error */ }
                    throw new Error(`HTTP error! status: ${response.status}${googleError ? ` (${googleError})` : ''}`);
                }
                const data: PlacesApiResponse = await response.json();

                if (data.status === 'OK') {
                    setPlaces(data.results);
                } else if (data.status === 'ZERO_RESULTS') {
                    setPlaces([]);
                } else {
                    setError(`Google Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
                }
            } catch (e: unknown) {
                 if (e instanceof Error) {
                    setError(`Failed to fetch nearby places: ${e.message}`);
                } else {
                     setError(`An unexpected error occurred.`);
                }
            }
        };

        fetchNearbyPlaces();
        // Depend on latitude, longitude, selectedType, AND radiusKm to refetch
    }, [latitude, longitude, selectedType, radiusKm]);

    // --- Filter Logic --- 
    const filteredPlaces = places.filter(place => {
        const rating = place.rating ?? 0; // Default to 0 if undefined
        const reviews = place.user_ratings_total ?? 0; // Default to 0 if undefined
        // Check if place meets minimum criteria
        return rating >= minRating && reviews >= minReviews;
    });

    // --- Render Logic --- 

    // Handle location fetching/errors first
    if (locationError) {
        return <div style={{ color: 'orange' }}>Location Error: {locationError}</div>;
    }

    if (latitude === null || longitude === null) {
        return <div>Getting your location... Please grant permission if prompted.</div>;
    }

    if (error) {
        // Provide more user-friendly error messages if needed
        return <div style={{ color: 'red' }}>Error: {error}</div>;
    }

    return (
        <div className="nearby-places-container">
            {/* Filter Inputs - Styled with Tailwind */} 
            <div className="filters bg-gray-100 dark:bg-gray-700 p-4 rounded-md my-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div>
                    <label htmlFor="minRating" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Rating:</label>
                    <input 
                        type="number"
                        id="minRating"
                        value={minRating}
                        onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)} 
                        min="0"
                        max="5"
                        step="0.1"
                        className="w-20 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5"
                    />
                </div>
                <div>
                    <label htmlFor="minReviews" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Min Reviews:</label>
                    <input 
                        type="number"
                        id="minReviews"
                        value={minReviews}
                        onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)} 
                        min="0"
                        step="100"
                        className="w-24 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5"
                    />
                </div>
                <div>
                    <label htmlFor="radiusKm" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Radius (km):</label>
                    <input 
                        type="number"
                        id="radiusKm"
                        value={radiusKm}
                        onChange={(e) => setRadiusKm(parseInt(e.target.value) || 1)} // Ensure positive radius
                        min="1"
                        step="10"
                        className="w-20 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm p-1.5"
                    />
                </div>
                <div>
                    <label htmlFor="placeType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type:</label>
                    <select 
                        id="placeType"
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-1.5 pl-2 pr-8"
                    >
                        <option value="">All Types</option>
                        {placeTypes.map(type => (
                            <option key={type} value={type}>
                                {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} {/* Format for display */}
                            </option>
                        ))}
                    </select>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 mt-5 sm:mt-0">({filteredPlaces.length} matching places)</span>
            </div>

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
                <div>No places found matching your current filter criteria.</div>
            )}

            <p style={{ fontSize: '0.8em', marginTop: '10px', color: '#666' }}>
                Places data from Google
            </p>
        </div>
    );
}

export default NearbyPlaces;
