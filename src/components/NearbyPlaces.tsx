import { useState, useEffect, useCallback, useMemo } from 'react';
import MapComponent from './MapComponent'; // Import the new MapComponent

// Define the key used in localStorage
const LOCAL_STORAGE_API_KEY = 'find_best_places.maps_api_key';

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
    // Natural features
    'Point of Interest',
    'Scenic Spot',
    'Attraction',
    'Viewpoint',
    'Observation Deck',
    'Lake',
    'Beach',
    'Mountain Peak',
    'Mountain Pass',
    'Cave',
    'National Park',
    'Park',
    
    // Outdoor activities
    'Rock Climbing',
    'Hiking Area',
    'Campground',
    
    // Religious places
    'Place of Worship',
    'Temple',
    'Church',
    'Mosque',
    'Synagogue',
    
    // Landmarks
    'Landmark',
    'Bridge',
    'Notable Street',
    
    // Cultural/educational
    'Museum',
    'University',
    'Library',
    
    // Transportation
    'Bus Stop',
    'Train Station',
    'Subway Station',
    'Parking',
    'Gas Station',
    
    // Food/dining
    'Takeaway',
    'Cafe',
    'Bakery',
    'Food',
    'Fast Food',
    'Restaurant',
    'Bar',
    
    // Shopping/services
    'ATM',
    'Pharmacy',
    'Groceries',
    'Supermarket',
    'Shopping Mall',
    
    // Accommodation
    'Lodging',
    'Hotel',
    'Gym',
    'Swimming Pool',
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
    const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null); // State for user's current location
    const [locationInputValue, setLocationInputValue] = useState<string>(''); // State for the location input field value
    const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
    const [filtered, setFiltered] = useState<boolean>(true);

    // State for managing API Key from localStorage
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isApiKeySet, setIsApiKeySet] = useState<boolean>(false);
    const [inputApiKey, setInputApiKey] = useState<string>(''); // For the API key input form

    // Effect to check localStorage for API key on initial load
    useEffect(() => {
        const storedApiKey = localStorage.getItem(LOCAL_STORAGE_API_KEY);
        if (storedApiKey) {
            setApiKey(storedApiKey);
            setIsApiKeySet(true);
        } else {
            setIsApiKeySet(false); // Explicitly set to false if not found
        }
    }, []); // Run only once on mount

    // --- API Fetching --- 
    // Modified fetchNearbyPlaces for Text Search
    const fetchNearbyPlaces = useCallback(async (currentBounds: google.maps.LatLngBoundsLiteral, currentTextQuery: string) => {
        // Check if API key is set in state
        if (!apiKey) {
            setError('API key is missing. Please enter it below.'); // Update error message
            setPlaces([]); // Clear places if no key
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
        
        // Define headers using the apiKey from state
        const headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey, // Use the apiKey from state
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
                // Check for specific API key related errors
                if (response.status === 403 || (errorData?.error?.message && errorData.error.message.includes('API key'))) {
                    setError('Invalid API Key provided. Please check and re-enter.');
                    // Optionally clear the invalid key and force re-entry
                    // localStorage.removeItem(LOCAL_STORAGE_API_KEY);
                    // setApiKey(null);
                    // setIsApiKeySet(false);
                } else {
                    setError(`API Error: ${response.status} - ${errorData?.error?.message || 'Failed to fetch'}`);
                }
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
    }, [apiKey]); // Add apiKey as a dependency

    // Effect to fetch places when bounds or textQuery change (and API key is set)
    useEffect(() => {
        if (isApiKeySet && apiKey && bounds && textQuery.trim()) { // Only fetch if API key is set, bounds exist and query is not empty
            fetchNearbyPlaces(bounds, textQuery);
        } else if (!isApiKeySet) {
            // Don't fetch if API key is not set, clear places/error related to fetching
            setPlaces([]);
            if (error !== 'API key is missing. Please enter it below.') { // Avoid resetting the initial prompt
                 setError(null);
            }
        } else if (!textQuery.trim()) {
            setPlaces([]); // Clear places if query is empty
        }
        // This effect runs when bounds, textQuery, isApiKeySet, or fetchNearbyPlaces changes
    }, [bounds, textQuery, isApiKeySet, apiKey, fetchNearbyPlaces, error]); // Include apiKey, isApiKeySet, and error

    // Derived state for filtered and sorted places using useMemo for efficiency
    const filteredSortedPlaces = useMemo(() => {
        return places
            .filter(place => filtered ? (place.rating || 0) >= 3 && (place.userRatingCount || 0) >= 10 && place.displayName : true)
            .sort((a, b) => ((b.userRatingCount || 0) * (b.rating || 0)) - ((a.userRatingCount || 0) * (a.rating || 0)))
            .slice(0, 20);
    }, [places, filtered]);

    // Effect to determine initial map center (Geolocation or Fallback)
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const currentLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    setMapCenter(currentLocation);
                    setUserLocation(currentLocation); // Store user location
                },
                () => {
                    // Handle geolocation error (e.g., user denied permission)
                    console.warn('Geolocation failed or permission denied. Falling back to default.');
                    setMapCenter(viennaCenter); // Fallback to default
                    // setUserLocation(null); // Explicitly set userLocation to null if failed
                }
            );
        } else {
            // Browser doesn't support Geolocation
            console.warn('Geolocation not supported by this browser. Falling back to default.');
            setMapCenter(viennaCenter); // Fallback to default
        }
    }, []); // Run only once on mount

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

    // Handler to save the API key from the form
    const handleSaveApiKey = () => {
        if (inputApiKey.trim()) {
            localStorage.setItem(LOCAL_STORAGE_API_KEY, inputApiKey.trim());
            setApiKey(inputApiKey.trim());
            setIsApiKeySet(true);
            setError(null); // Clear any previous errors
            setInputApiKey(''); // Clear the input field
        } else {
            setError("API Key cannot be empty.");
        }
    };

    // Handle submission for the new location input
    const handleLocationSearchSubmit = async () => {
        if (!locationInputValue.trim()) {
            return;
        }

        const locationQuery = locationInputValue.trim();
        setError(null); 

        // Check if API key exists before making the call
        if (!apiKey) {
            setError("API key is missing. Please configure it first.");
            return;
        }

        try {
            const apiUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
            const params = {
                address: locationQuery,
                key: apiKey,
            };
            const response = await fetch(`${apiUrl}?${new URLSearchParams(params).toString()}`);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error_message || `API request failed with status ${response.status}`);
            }

            const data = await response.json(); 

            if (data.results && data.results.length > 0 && data.results[0].geometry && data.results[0].geometry.location) {
                const { lat, lng } = data.results[0].geometry.location;
                setMapCenter({ lat, lng });
                setLocationInputValue('');
            } else {
                setError("Could not find location data for the entered place.");
            }

        } catch (err: unknown) { // Use unknown instead of any
            console.error("Error searching for location:", err);
            // Type check before accessing properties
            let errorMessage = "An error occurred while searching for the location.";
            if (err instanceof Error) {
                errorMessage = err.message;
            }
            setError(errorMessage);
        }
    };

    // Render API Key input form if key is not set
    if (!isApiKeySet) {
        return (
            <div style={{ padding: '20px', maxWidth: '400px', margin: 'auto', textAlign: 'center' }}>
                <h2>Enter Google Maps API Key</h2>
                <p>A Google Maps API key with Places API enabled is required to use this application.</p>
                <input 
                    type="password" 
                    value={inputApiKey}
                    onChange={(e) => setInputApiKey(e.target.value)}
                    placeholder="Paste your API Key here"
                    style={{ width: '100%', padding: '10px', marginBottom: '10px', boxSizing: 'border-box' }}
                />
                <button 
                    onClick={handleSaveApiKey}
                    style={{ padding: '10px 20px', cursor: 'pointer' }}
                >
                    Save and Load Map
                </button>
                {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
                 <p style={{marginTop: '20px', fontSize: '0.9em', color: '#666'}}>
                    Your API key will be stored locally in your browser's localStorage.<br/>
                    <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer">How to get an API Key</a>
                </p>
            </div>
        );
    }

    // Render map and places list if API key IS set
    return (
        <div className="nearby-places-container w-full md:h-screen flex flex-col">
            {/* Top Section: Title and Filters */} 
            <div className='flex flex-col md:flex-row md:items-center w-full gap-4 p-2 md:px-4'>
                {/* Left Column: Inputs */}
                <div className='flex flex-col w-full md:w-[20rem] flex-shrink-0'>
                    <div className='flex flex-row items-center justify-between gap-2'>
                        <h1 className='flex text-xl font-semibold flex-nowrap mr-2'>Find the best places</h1>
                        <div className='flex flex-row items-center gap-2'>
                            <input type="checkbox" checked={filtered} onChange={(e) => setFiltered(e.target.checked)} />
                            <label>Filter</label>
                        </div>
                    </div>
                    {/* New Location Search Form */}
                    <form 
                        onSubmit={(e) => { 
                            e.preventDefault(); // Prevent page reload on submit
                            handleLocationSearchSubmit(); 
                        }}
                        className="flex items-center gap-2 mt-2"
                    > 
                        <input 
                            type="text"
                            value={locationInputValue}
                            onChange={(e) => setLocationInputValue(e.target.value)}
                            placeholder="Go to city (eg. London)"
                            className="w-full px-3 h-9 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        />
                        <button 
                            type="submit"
                            className="min-w-20 h-9 px-3 flex items-center justify-center text-gray-500 bg-gray-100 rounded-md dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Go
                        </button>
                    </form>
                    {/* Existing Place Search Input */}
                    <div className="flex items-center gap-2 mt-2">
                        <input 
                            type="text"
                            value={inputValue} // Controlled by inputValue state
                            onChange={(e) => setInputValue(e.target.value)} // Update inputValue on change
                            onKeyDown={handleInputKeyDown} // Handle Enter key press for place search
                            placeholder="Search for places (eg. park)"
                            className="w-full px-3 h-9 border border-gray-300 rounded-md dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        />
                        <button 
                            onClick={() => {
                                setInputValue('');
                                setTextQuery('');
                                setPlaces([]);
                            }}
                            className="min-w-20 h-9 px-3 flex items-center justify-center text-gray-500 bg-gray-100 rounded-md dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                {/* Right Column: Clickable Preset Type Chips */}
                <div className="flex flex-row flex-wrap justify-center gap-1 flex-grow">
                    {placeTypes.map(type => {
                        const formattedType = type.toLowerCase().trim();
                        return (
                            <span 
                                key={type} 
                                onClick={() => {
                                    setInputValue(formattedType); // Update input box
                                    setTextQuery(formattedType); // Set query immediately
                                }}
                                className="inline-block bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium px-2.5 py-1 rounded-full cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-150"
                            >
                                {type}
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Main Content Area: Two Columns */}
            <div className="flex flex-col md:flex-row flex-grow overflow-hidden"> {/* flex-grow makes this fill remaining height */}
                {/* Left Column: Map */}
                <div className="w-full h-[50vh] md:h-full">
                    {apiKey ? (
                        <MapComponent 
                            apiKey={apiKey} 
                            initialCenter={mapCenter || viennaCenter} 
                            onViewportChange={handleMapViewportChange} 
                            places={filteredSortedPlaces}
                            hoveredPlaceId={hoveredPlaceId}
                            userLocation={userLocation}
                        />
                    ) : (
                        <div className="text-red-500 dark:text-red-400 p-4 border border-red-500 dark:border-red-400 rounded-md mb-4 flex items-center justify-center h-full">
                            Map cannot be displayed: Google Maps API Key is missing. Please set it in the input form below.
                        </div>
                    )}
                </div>

                {/* Right Column: Place List */}
                <div className="w-full md:w-[32rem] md:h-full overflow-y-auto"> {/* List column takes 1/3 width, scrolls vertically */} 
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
                                    onMouseEnter={() => setHoveredPlaceId(place.id)}
                                    onMouseLeave={() => setHoveredPlaceId(null)}
                                >
                                    <li className="list-none">
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
                                    </li>
                                </a>
                            ))}
                        </ul>
                    ) : (
                        !error && bounds && textQuery.trim() ?
                        <p className="p-4">No places found matching '{textQuery}' in this map area. Try a different search or zoom level.</p>
                        :
                        <p className="p-4">Select a place type to start</p>

                    )}
                </div>
            </div>
        </div>
    );
}

export default NearbyPlaces;
