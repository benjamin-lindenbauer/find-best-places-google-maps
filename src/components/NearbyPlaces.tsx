import { useState, useEffect, useCallback, useMemo } from 'react';
import MapComponent from './MapComponent'; // Import the new MapComponent

// Access the API key from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

// Updated interface for Text Search results
interface Place {
    id: string; // Text Search might not return place_id by default
    displayName: { // Text Search uses displayName
        text: string;
        languageCode: string;
    };
    location: { // Text Search uses location
        latitude: number;
        longitude: number;
    };
    editorialSummary?: { // Text Search uses editorialSummary
        text: string;
        languageCode: string;
    };
    primaryType?: string; // Text Search uses primaryType
    primaryTypeDisplayName?: {
        text: string;
        languageCode: string;
    };
    formattedAddress?: string; // Text Search uses formattedAddress
    rating?: number; // Add rating back
    userRatingCount?: number; // Add user rating count back (note: name differs slightly from Nearby Search)
    // vicinity?: string; // Nearby Search field
    // types?: string[]; // Nearby Search field
    // Add other relevant properties from Text Search if needed
    // e.g., priceLevel, rating (different structure potentially)
}

// Updated interface for Text Search API response
interface PlacesApiResponse {
    places: Place[]; // Text Search returns 'places'
    // results: Place[]; // Nearby Search field
    // status: string; // Nearby Search field
    // error_message?: string; // Nearby Search field
    // Add potential error fields from Text Search if needed
}

// Define the types for the dropdown (can remain the same conceptually)
const placeTypes = [
    'scenic_spot',
    'attraction',
    'museum',
    'viewpoint',
    'observation deck',
    'lake',
    'beach',
    'mountain_peak',
    'hiking area',
    'park',
    'place_of_worship',
    'church',
    'point_of_interest',
    'atm',
    'parking',
    'campground',
    'landmark',
    'gym',
    'university',
    'groceries',
    'supermarket',
    'bus stop',
    'train_station',
    'lodging',
    'hotel',
    'takeaway',
    'cafe',
    'food',
    'fast food',
    'restaurant',
    'pharmacy',
];

// Define coordinates for Vienna as fallback
const viennaCenter = {
  lat: 48.2082,
  lng: 16.3738
};

function NearbyPlaces() {
    const [places, setPlaces] = useState<Place[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [bounds, setBounds] = useState<google.maps.LatLngBoundsLiteral | null>(null);
    const [mapCenter, setMapCenter] = useState<google.maps.LatLngLiteral | null>(null);
    const [textQuery, setTextQuery] = useState<string>(''); // State for the *submitted* search query
    const [inputValue, setInputValue] = useState<string>(''); // State for the current input field value

    // --- API Fetching --- 
    // Modified fetchNearbyPlaces for Text Search
    const fetchNearbyPlaces = useCallback(async (currentBounds: google.maps.LatLngBoundsLiteral, currentTextQuery: string) => {
        if (!GOOGLE_MAPS_API_KEY) {
            setError('API key is missing. Please add it to the .env file.');
            return;
        }
        if (!currentBounds) {
            // Don't fetch if map hasn't provided valid bounds yet
            return;
        }

        setError(null);

        const apiUrl = 'https://places.googleapis.com/v1/places:searchText';
        
        // Use the textQuery state directly
        if (!currentTextQuery.trim()) {
            // Should not happen if useEffect check is working, but safety check
            setPlaces([]);
            return;
        }

        // Define the request body
        const requestBody = {
            textQuery: currentTextQuery.trim(), // Use state directly
            locationRestriction: {
                rectangle: {
                    low: {
                        latitude: currentBounds.south,
                        longitude: currentBounds.west
                    },
                    high: {
                        latitude: currentBounds.north,
                        longitude: currentBounds.east
                    }
                }
            }
        };
        
        // Define headers
        const headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
            // Specify desired fields using FieldMask
            'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.userRatingCount,places.editorialSummary,places.primaryType,places.primaryTypeDisplayName'
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Handle HTTP errors (e.g., 4xx, 5xx)
                const errorData = await response.json().catch(() => ({})); // Try to parse error JSON
                console.error('Google Places API HTTP Error:', response.status, errorData);
                setError(`API Error: ${response.status} - ${errorData?.error?.message || 'Failed to fetch'}`);
                setPlaces([]);
                return;
            }

            const data: PlacesApiResponse = await response.json();

            // Text Search returns places array directly
            if (data.places && data.places.length > 0) {
                setPlaces(data.places);
            } else {
                setPlaces([]); // Clear places if no results or empty array
                // Optional: setError('No places found matching your criteria in this area.');
            }

        } catch (err: unknown) { // Catch unknown error type
            console.error('Network or Fetch Error:', err);
            // Type check before accessing properties
            const errorMessage = err instanceof Error ? err.message : String(err);
            setError(`An unexpected error occurred: ${errorMessage}`);
            setPlaces([]); // Clear places on error
        }
    }, []); // Removed selectedType dependency, query is passed as argument

    // Effect to fetch places when bounds or textQuery change
    useEffect(() => {
        if (bounds && textQuery.trim()) { // Only fetch if bounds exist and query is not empty
            fetchNearbyPlaces(bounds, textQuery);
        } else {
            setPlaces([]); // Clear places if query is empty or bounds are null
        }
        // This effect runs when bounds OR textQuery changes
    }, [bounds, textQuery, fetchNearbyPlaces]);

    // Derived state for filtered and sorted places using useMemo for efficiency
    const filteredSortedPlaces = useMemo(() => {
        return places
            .filter(place => (place.rating || 0) > 3 && (place.userRatingCount || 0) > 10 && place.displayName)
            .sort((a, b) => ((b.userRatingCount || 0) * (b.rating || 0)) - ((a.userRatingCount || 0) * (a.rating || 0)));
    }, [places]); // Recompute only when 'places' state changes

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
    }, []);

    // Handle Enter key press in the input field
    const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent potential form submission
            setTextQuery(inputValue.trim()); // Set the main query state to trigger fetch
        }
    };

    const handleMapViewportChange = useCallback((newBounds: google.maps.LatLngBoundsLiteral | null) => {
        setBounds(newBounds);
    }, []);

    return (
        // Make the main container full height
        <div className="nearby-places-container w-full h-screen flex flex-col">
            {/* Top Section: Title and Filters */} 
            <div className='flex flex-row items-center w-full gap-4 p-4 pt-2'>
                <div className='flex flex-col gap-2'>
                    <h1 className='flex text-2xl font-semibold flex-nowrap'>Find the best places</h1>
                    <div className="flex items-center gap-2">
                        <input 
                            type="text"
                            value={inputValue} // Controlled by inputValue state
                            onChange={(e) => setInputValue(e.target.value)} // Update inputValue on change
                            onKeyDown={handleInputKeyDown} // Handle Enter key press
                            placeholder="Search for places (e.g., 'park') or press Enter"
                            className="w-36 px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        />
                        <button 
                            onClick={() => {
                                setInputValue('');
                                setTextQuery('');
                                setPlaces([]);
                            }}
                            className="px-3 py-2 text-gray-500 bg-gray-100 rounded-md dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {/* Clickable Preset Type Chips */}
                <div className="flex flex-1 flex-wrap justify-center gap-1 mt-2">
                    {placeTypes.map(type => {
                        const formattedType = type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return (
                            <span 
                                key={type} 
                                onClick={() => {
                                    const formatted = formattedType.toLowerCase().trim();
                                    setInputValue(formatted); // Update input box
                                    setTextQuery(formatted); // Set query immediately
                                }}
                                className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-150"
                            >
                                {formattedType}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area: Two Columns */}
            <div className="flex flex-row flex-grow overflow-hidden"> {/* flex-grow makes this fill remaining height */}
                {/* Left Column: Map */}
                <div className="w-full h-full">
                    {/* Render Map Component only after initial center is determined */} 
                    {mapCenter && GOOGLE_MAPS_API_KEY ? (
                        <MapComponent 
                            apiKey={GOOGLE_MAPS_API_KEY} 
                            initialCenter={mapCenter} 
                            onViewportChange={handleMapViewportChange} 
                            places={filteredSortedPlaces} // Pass filtered & sorted places
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
                <div className="w-[32rem] h-full overflow-y-auto"> {/* List column takes 1/3 width, scrolls vertically */} 
                    {/* Display Loading/Error specific to API fetch */} 
                    {error && <div style={{ color: 'red', marginBottom: '1rem' }}>Error fetching places: {error}</div>}
                    {/* You might want a dedicated loading state for the API call triggered by map changes */} 
                    {/* {isFetchingPlaces && <div>Loading places for map area...</div>} */} 

                    {/* Display List - Updated for Text Search fields */} 
                    {filteredSortedPlaces.length > 0 ? (
                        <ul>
                            {filteredSortedPlaces.map((place) => (
                                // Wrap list item in a link to Google Maps
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName?.text || '')}&query_place_id=${place.id}`}
                                    key={place.id} // Use place.id as key for the link
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block p-3 border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150"
                                >
                                    {/* List Item Content */}
                                    <h3 className="text-lg font-semibold mb-1 text-gray-900 dark:text-white">{place.displayName?.text || 'N/A'}</h3>
                                    
                                    {/* Rating Line */} 
                                    {(place.rating && place.userRatingCount) && (
                                        <div className="flex items-center mb-1 text-sm text-gray-600 dark:text-gray-400">
                                            <span className="mr-1">{place.rating.toFixed(1)}</span>
                                            <span className="text-yellow-500 mr-1">{'⭐'.repeat(Math.round(place.rating))}{'☆'.repeat(5 - Math.round(place.rating))}</span>
                                            <span>({place.userRatingCount.toLocaleString()})</span>
                                        </div>
                                    )}

                                    {/* Primary Type */}
                                    {place.primaryTypeDisplayName && (
                                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                                            <span 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // Prevent link navigation
                                                    e.preventDefault(); // Prevent link navigation (extra safety)
                                                    const typeText = place.primaryTypeDisplayName?.text.toLowerCase().trim() || '';
                                                    setInputValue(typeText); // Update input box
                                                    setTextQuery(typeText); // Set query immediately
                                                }}
                                                className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-150"
                                                title={`Search for ${place.primaryTypeDisplayName.text}`}
                                            >
                                                {place.primaryTypeDisplayName.text}
                                            </span>
                                        </p>
                                    )}

                                    {/* Editorial Summary */}
                                    {place.editorialSummary && (
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {place.editorialSummary.text}
                                        </p>
                                    )}
                                </a>
                            ))}
                        </ul>
                    ) : (
                        !error && bounds && textQuery.trim() ?
                        <p className="p-4">No places found matching '{textQuery}' in this map area. Try a different search or zoom level.</p>
                        :
                        <p className="p-4">Select a place type</p>

                    )}
                </div>
            </div>
        </div>
    );
}

export default NearbyPlaces;
