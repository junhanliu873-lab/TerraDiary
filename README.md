# TerraDiary

## Start the prototype

Open `Start-TerraDiary.ps1` in PowerShell (or right-click and choose **Run with PowerShell**). Keep its window open, then visit <http://localhost:8000/>. The map first tries Esri World Street Map, then automatically falls back to OpenStreetMap if Esri tiles fail. Leaflet also has a second CDN address if its first one is unavailable. Both map sources and place search require an internet connection.

If you start it manually, run `python -m http.server 8000 --bind 127.0.0.1` from this folder. Open `http://localhost:8000/` afterward. OpenStreetMap requires a valid page referrer, so do not open `index.html` directly as a `file://` URL.

## Local data and photos

Journeys, profile details, and memories are stored in this browser. Uploaded photos and journey covers are stored in IndexedDB on this device and remain after logging out and back in with the same browser profile. Clearing browser site data removes them. This prototype does not sync across devices or provide server-based authentication.

Place searches go to OpenStreetMap's Nominatim service. Your notes and photos are not sent to the map providers.
