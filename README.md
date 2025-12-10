# Find the Best Places

Interactive map app to discover highly rated places within the current map view. It uses the Google Maps JavaScript API and the Places API (Text Search) to show markers and a ranked list of results. The app stores your API key locally, so you can run it without a backend.

## Features

- **Map-based search**: Results are restricted to the visible map bounds.
- **Text queries and presets**: Type any query (e.g., `park`, `cafe`) or click preset chips in the header.
- **Go to city**: Jump the map center to a city by name (geocoding).
- **Advanced filtering**: Dual range sliders for minimum average rating (0.0-5.0) and minimum number of ratings (0-1000), with real-time updates.
- **Smart ranking**: Places are sorted by rating × review count to prioritize popular, highly-rated locations.
- **Responsive layout**: Fixed filter panel with scrollable results list; right column takes 1/4 width with 28rem minimum on desktop.
- **Rich list + markers**: Hover a list item to highlight its marker; click an item to open it in Google Maps.
- **Enhanced UI**: Primary type tags inline with place names, thin scrollbars, dark mode support.
- **Your location**: If permitted, shows a blue dot and a button to re-center.
- **Local storage API key**: Paste your Google Maps API key once; it's saved in `localStorage` under `find_best_places.maps_api_key`.

## Tech Stack

- **React 19 + TypeScript** with **Vite**
- **Google Maps** via `@react-google-maps/api`
- **Tailwind CSS 4** (via `@tailwindcss/vite`) for styling

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- A Google Cloud project with the following APIs enabled:
  - Maps JavaScript API
  - Places API (Places API v1 for Text Search)
  - Geocoding API (for the "Go to city" feature)
- A Google API key with the above APIs enabled and HTTP referrer restrictions set for local development if desired.

### Install and run

```bash
npm install
npm run dev
```

Open the printed local URL in your browser. On first load, you will be prompted to paste your API key.

### Providing or changing the API key

- On first run, the app shows an input to paste the API key and stores it in `localStorage` under the key `find_best_places.maps_api_key`.
- To change/reset it later:
  - Use your browser devtools → Application/Storage → Local Storage, and delete the key `find_best_places.maps_api_key`, then reload; or
  - Modify code to expose a reset UI if preferred.

## Usage

- **Search places**: Type a query (e.g., "museum") and press Enter.
- **Use presets**: Click any chip (e.g., "Park", "Cafe") in the header.
- **Go to city**: Enter a city name (e.g., "London") in the top input and press Go.
- **Filter results**: Use the range sliders in the right panel to set minimum average rating (0.0-5.0) and minimum number of ratings (0-1000).
- **Interact**: Hover an item to bounce its marker; click an item to open it in Google Maps; click type tags to search for that specific category.

## Project Structure

- `index.html` – App mount point and Vite entry.
- `src/main.tsx` – React root and global styles import.
- `src/App.tsx` – Renders the `NearbyPlaces` feature.
- `src/components/NearbyPlaces.tsx` – Main UI and data flow: inputs, fetching Places Text Search, list rendering.
- `src/components/MapComponent.tsx` – Google Map, markers, viewport change reporting, "center on me" control.

## Scripts

- `npm run dev` – Start the dev server (Vite)
- `npm run build` – Type-check and build for production
- `npm run preview` – Preview the production build
- `npm run lint` – ESLint

## How it works

- The map emits viewport changes via `onIdle` in `src/components/MapComponent.tsx`, which calls `onViewportChange` with the current bounds.
- `src/components/NearbyPlaces.tsx` listens for bounds and the current search query, then calls the Places API Text Search endpoint:
  - Endpoint: `https://places.googleapis.com/v1/places:searchText`
  - Method: POST with `textQuery` and `locationRestriction.rectangle` derived from map bounds
  - Headers include `X-Goog-Api-Key` and a FieldMask for the fields used in the UI
- Results are processed through a real-time filtering system:
  - Dual range sliders control minimum average rating (default 3.5) and minimum number of ratings (default 10)
  - Places are sorted by rating × review count to prioritize popular, highly-rated locations
  - Top 20 results are displayed with inline type tags for quick category searches
- Clicking list items opens Google Maps; clicking type tags triggers new searches for that category.

## Troubleshooting

- **Map not loading**: Check the browser console for Google Maps API errors. Verify your API key and enabled APIs.
- **Invalid API key**: You’ll see a clear error. Reset the localStorage key and paste a valid key.
- **No results**: Zoom out, pan to a different area, or change the query. Some queries may have few results within the visible bounds.

## Notes

- API key is stored locally in the browser only; there's no backend.
- Tailwind is used via utility classes; custom thin scrollbar styling is applied globally in `src/index.css`.
- The layout uses responsive design with a fixed filter panel and scrollable results for optimal desktop experience.
- Dark mode is supported throughout the application with appropriate color schemes.
