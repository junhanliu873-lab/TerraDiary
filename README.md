# TerraDiary

## Start the prototype

Open `Start-TerraDiary.ps1` in PowerShell (or right-click and choose **Run with PowerShell**). Keep its window open, then visit <http://localhost:8000/>. The map first tries Esri World Street Map, then automatically falls back to OpenStreetMap if Esri tiles fail. Leaflet also has a second CDN address if its first one is unavailable. Both map sources and place search require an internet connection.

If you start it manually, run `python -m http.server 8000 --bind 127.0.0.1` from this folder. Open `http://localhost:8000/` afterward. OpenStreetMap requires a valid page referrer, so do not open `index.html` directly as a `file://` URL.

## Local data and photos

Each email address has its own local archive in this browser. Creating a new archive starts empty; signing in with an existing email and password opens only that archive. A password verifier is stored locally, but there is no server-side account or authentication, and the archive does not sync across devices. This is an account separation feature for the app UI, not protection against someone who can inspect this browser profile or its storage. Clearing browser site data removes the archives. Uploaded photos and journey covers are stored in IndexedDB on this device.

Place searches go to OpenStreetMap's Nominatim service. Your notes and photos are not sent to the map providers.
