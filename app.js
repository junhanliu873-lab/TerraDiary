const seedJourneys = [
  { id: 'japan', name: 'Japan, slowly', description: 'A summer of small discoveries, long walks and neon evenings.', date: 'JUL — AUG 2026', folder: '', coverKey: '', locations: [
    { name: 'Tokyo Tower', area: 'Minato City, Tokyo', lat: 35.6586, lon: 139.7454, x: 59, y: 37, memories: 3, note: 'The first night walking through Tokyo. The city felt endless.', date: '05 JUL 2026', mood: 'Excited', photos: [] },
    { name: 'Kyoto', area: 'Kyoto, Japan', lat: 35.0116, lon: 135.7681, x: 35, y: 59, memories: 8, note: 'We took the long way back, past a little shrine tucked between two streets.', date: '11 JUL 2026', mood: 'Curious', photos: [] },
    { name: 'Hiroshima', area: 'Hiroshima, Japan', lat: 34.3853, lon: 132.4553, x: 24, y: 73, memories: 4, note: 'A quiet morning I want to hold onto.', date: '18 JUL 2026', mood: 'Peaceful', photos: [] }
  ], chapters: [{ title: 'Arrival', place: 'TOKYO · 05 JUL', note: 'First night in my new city.' }, { title: 'Finding my place', place: 'KYOTO · 11 JUL', note: 'Somewhere between the station and the river, I stopped feeling like a visitor.' }, { title: 'Looking back', place: 'HIROSHIMA · 18 JUL', note: 'A slow morning, with nowhere else to be.' }] },
  { id: 'europe', name: 'Europe, by train', description: 'A few weeks following the rails, with no particular hurry.', date: 'SEP — OCT 2025', folder: '', coverKey: '', locations: [
    { name: 'Paris', area: 'Paris, France', lat: 48.8584, lon: 2.2945, x: 43, y: 37, memories: 5, note: 'The rain stopped right as we reached the river.', date: '16 SEP 2025', mood: 'Peaceful', photos: [] },
    { name: 'Lisbon', area: 'Lisbon, Portugal', lat: 38.7223, lon: -9.1393, x: 28, y: 67, memories: 7, note: 'Warm bread, tiled walls, and a view I kept coming back to.', date: '23 SEP 2025', mood: 'Grateful', photos: [] }
  ], chapters: [{ title: 'Before I left', place: 'PARIS · 16 SEP', note: 'The first morning with nowhere I had to be.' }, { title: 'New streets', place: 'LISBON · 23 SEP', note: 'We missed our stop and found the best little café.' }] }
];

const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem('terra-' + key)) ?? fallback; } catch { return fallback; } };
const $ = sel => document.querySelector(sel), $$ = sel => [...document.querySelectorAll(sel)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let journeys = read('journeys', seedJourneys), folders = read('folders', []), user = read('user', { name: 'Traveler', email: '' });
let jid = journeys[0]?.id, lid = 0, mid = 0, filterFolder = '', cursorColor = read('cursorColor', '#facc15'), cursorShape = read('cursorShape', 'circle'); if (cursorShape === 'dot') cursorShape = 'circle';
let tripMap = null, markerLayer = null, routeLayer = null, mapPickMode = false, lastSearchAt = 0, searchContext = null, objectUrls = [], journeyView = 'story';
let baseTileLayer = null, baseTileProvider = 0;
let longformOpen = false, longformMemoryId = '', journalFullscreen = false, journalHome = null;
let worldNodes = [], worldScale = 1, worldFocus = null;
let worldRotation = 0, worldTilt = 0, worldPointers = new Map(), worldDrag = null, worldPinch = null;
let worldGl = null, worldGlProgram = null, worldGlUniforms = null, worldGlTexture = null, worldGlReady = false, worldResizeObserver = null;
function setJournalFullscreen(value) {
  journalFullscreen = value;
  const panel = $('#memoryWritingView');
  if (panel) {
    if (value && panel.parentElement !== document.body) { journalHome = { parent: panel.parentElement, next: panel.nextSibling }; document.body.append(panel); }
    if (!value && panel.parentElement === document.body && journalHome) { journalHome.parent.insertBefore(panel, journalHome.next?.parentNode === journalHome.parent ? journalHome.next : null); journalHome = null; }
    panel.classList.toggle('journal-fullscreen', value);
  }
  document.documentElement.style.overflow = value ? 'hidden' : '';
  $('#cursor')?.classList.toggle('journal-cursor', value);
  const button = $('#expandJournal'); if (!button) return;
  button.setAttribute('aria-label', value ? 'Exit fullscreen journal' : 'Expand journal to fullscreen');
  button.title = value ? 'Exit fullscreen' : 'Expand to fullscreen';
  button.innerHTML = value
    ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3v5H3M16 3v5h5M3 16h5v5M21 16h-5v5"/></svg>'
    : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>';
}
const currentTrip = () => journeys.find(j => j.id === jid) || journeys[0];
const currentPlace = () => currentTrip()?.locations?.[lid];
const currentMemory = () => currentPlace()?.entries?.[mid];
function persist() { localStorage.setItem('terra-journeys', JSON.stringify(journeys)); localStorage.setItem('terra-folders', JSON.stringify(folders)); }
function notify(text) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = text; document.body.append(el); setTimeout(() => el.remove(), 2800); }
const placeMenu = document.createElement('div');
placeMenu.id = 'placeContextMenu'; placeMenu.className = 'place-context-menu hidden'; placeMenu.setAttribute('role', 'menu'); placeMenu.innerHTML = '<button type="button" role="menuitem">⌫ &nbsp; Delete place</button>'; document.body.append(placeMenu);
let contextPlaceIndex = -1;
function hidePlaceMenu() { placeMenu.classList.add('hidden'); contextPlaceIndex = -1; }
function showPlaceMenu(event, index) {
  event.preventDefault(); contextPlaceIndex = index;
  const width = 190, height = 46, left = Math.min(event.clientX || 12, window.innerWidth - width - 10), top = Math.min(event.clientY || 12, window.innerHeight - height - 10);
  placeMenu.style.left = `${Math.max(10, left)}px`; placeMenu.style.top = `${Math.max(10, top)}px`; placeMenu.classList.remove('hidden');
}
placeMenu.querySelector('button').onclick = async () => { const index = contextPlaceIndex; hidePlaceMenu(); if (index >= 0) await deleteJourneyPlace(index); };
document.addEventListener('pointerdown', event => { if (!placeMenu.contains(event.target)) hidePlaceMenu(); });
document.addEventListener('scroll', hidePlaceMenu, true);
document.addEventListener('keydown', event => { if (event.key === 'Escape') hidePlaceMenu(); });
const journeyMenu = document.createElement('div');
journeyMenu.id = 'journeyContextMenu'; journeyMenu.className = 'place-context-menu hidden journey-context-menu'; journeyMenu.setAttribute('role', 'menu'); document.body.append(journeyMenu);
let contextJourneyId = '';
function hideJourneyMenu() { journeyMenu.classList.add('hidden'); contextJourneyId = ''; }
function showJourneyMenu(event, id) {
  event.preventDefault(); contextJourneyId = id;
  const trip = journeys.find(item => item.id === id);
  journeyMenu.innerHTML = `<div class="context-menu-label">ADD TO COLLECTION</div>${folders.length ? folders.map(folder => `<button type="button" role="menuitem" data-assign-folder="${esc(folder)}">＋ &nbsp; ${esc(folder)}${trip?.folder === folder ? ' · ADDED' : ''}</button>`).join('') : '<p class="context-menu-empty">Create a collection first.</p>'}<button type="button" role="menuitem" class="context-new-collection">＋ &nbsp; NEW COLLECTION</button>${trip?.folder ? '<button type="button" role="menuitem" data-assign-folder="">↶ &nbsp; REMOVE FROM COLLECTION</button>' : ''}`;
  const width = 220, height = Math.min(330, 80 + folders.length * 43), left = Math.min(event.clientX || 12, window.innerWidth - width - 10), top = Math.min(event.clientY || 12, window.innerHeight - height - 10);
  journeyMenu.style.left = `${Math.max(10, left)}px`; journeyMenu.style.top = `${Math.max(10, top)}px`; journeyMenu.classList.remove('hidden');
  journeyMenu.querySelectorAll('[data-assign-folder]').forEach(button => button.onclick = () => { const folder = button.dataset.assignFolder, trip = journeys.find(item => item.id === contextJourneyId); if (trip) { trip.folder = folder; persist(); hideJourneyMenu(); renderDashboard(); notify(folder ? `Added to “${folder}”.` : 'Journey removed from its collection.'); } });
  journeyMenu.querySelector('.context-new-collection').onclick = () => { const id = contextJourneyId; hideJourneyMenu(); openModal('folder'); window.collectionForJourney = id; };
}
journeyMenu.addEventListener('click', event => { if (event.target === journeyMenu) hideJourneyMenu(); });
document.addEventListener('pointerdown', event => { if (!journeyMenu.contains(event.target)) hideJourneyMenu(); });
document.addEventListener('scroll', hideJourneyMenu, true);
document.addEventListener('keydown', event => { if (event.key === 'Escape') hideJourneyMenu(); });

// Photo files live in IndexedDB; journey records keep only media keys in localStorage.
const mediaDB = new Promise((resolve, reject) => {
  const req = indexedDB.open('TerraDiaryMedia', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('assets', { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
});
async function putAsset(blob) { const db = await mediaDB, id = crypto.randomUUID(); await new Promise((ok, bad) => { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').put({ id, blob }); tx.oncomplete = ok; tx.onerror = () => bad(tx.error); }); return id; }
async function getAsset(id) { const db = await mediaDB; return new Promise((ok, bad) => { const req = db.transaction('assets').objectStore('assets').get(id); req.onsuccess = () => ok(req.result?.blob || null); req.onerror = () => bad(req.error); }); }
async function readPhotoCoordinates(file) {
  if (!/jpe?g/i.test(file.type) && !/\.jpe?g$/i.test(file.name)) return null;
  try {
    const bytes = new DataView(await file.arrayBuffer());
    if (bytes.getUint16(0) !== 0xffd8) return null;
    let offset = 2, tiff = -1, little = true;
    while (offset + 4 < bytes.byteLength) {
      if (bytes.getUint8(offset++) !== 0xff) break;
      const marker = bytes.getUint8(offset++), length = bytes.getUint16(offset); if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0xe1 && bytes.getUint32(offset + 2) === 0x45786966) { tiff = offset + 8; break; }
      offset += length;
    }
    if (tiff < 0) return null;
    little = bytes.getUint16(tiff) === 0x4949;
    const u16 = at => bytes.getUint16(tiff + at, little), u32 = at => bytes.getUint32(tiff + at, little);
    if (u16(2) !== 42) return null;
    const ifd0 = u32(4), count = u16(ifd0), gpsTag = (() => { for (let i = 0; i < count; i++) { const entry = ifd0 + 2 + i * 12; if (u16(entry) === 0x8825) return u32(entry + 8); } return 0; })();
    if (!gpsTag) return null;
    const gpsCount = u16(gpsTag), tags = {};
    for (let i = 0; i < gpsCount; i++) { const entry = gpsTag + 2 + i * 12; tags[u16(entry)] = { type: u16(entry + 2), count: u32(entry + 4), value: u32(entry + 8), inline: entry + 8 }; }
    const ascii = tag => { const item = tags[tag]; return item ? String.fromCharCode(...Array.from({ length: item.count }, (_, i) => bytes.getUint8(tiff + item.inline + i))).replace(/\0/g, '').trim() : ''; };
    const rationals = tag => { const item = tags[tag]; if (!item || item.type !== 5 || item.count < 3) return null; const at = item.value; return [0, 1, 2].map(i => { const pos = at + i * 8, den = u32(pos + 4); return den ? u32(pos) / den : 0; }); };
    const dmsLat = rationals(2), dmsLon = rationals(4); if (!dmsLat || !dmsLon) return null;
    let lat = dmsLat[0] + dmsLat[1] / 60 + dmsLat[2] / 3600, lon = dmsLon[0] + dmsLon[1] / 60 + dmsLon[2] / 3600;
    if (ascii(1).toUpperCase() === 'S') lat *= -1; if (ascii(3).toUpperCase() === 'W') lon *= -1;
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  } catch { return null; }
}
function distanceKm(a, b) { const rad = value => value * Math.PI / 180, dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon), q = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2; return 6371 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(1 - q)); }
async function reversePhotoPlace(coords) {
  try { const url = new URL('https://nominatim.openstreetmap.org/reverse'); url.search = new URLSearchParams({ format: 'jsonv2', lat: String(coords.lat), lon: String(coords.lon), zoom: '10', addressdetails: '1' }).toString(); const response = await fetch(url); if (!response.ok) return null; const result = await response.json(), a = result.address || {}, name = a.city || a.town || a.village || a.suburb || a.county || result.name || 'Photo location', area = [a.state || a.region, a.country].filter(Boolean).join(', '); return { name, area: area || result.display_name || 'Photo location', ...coords }; } catch { return null; }
}
async function savePhotoFiles(files, memory, sourcePlace) {
  const trip = currentTrip(), additions = new Map(), attachedHere = []; let withoutGps = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const key = await putAsset(file), coords = await readPhotoCoordinates(file);
    if (!coords) { memory.photoKeys ||= []; memory.photoKeys.push(key); attachedHere.push(file.name); withoutGps++; continue; }
    const nearest = trip.locations.map((place, index) => ({ index, distance: Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)) ? distanceKm(coords, { lat: Number(place.lat), lon: Number(place.lon) }) : Infinity })).sort((a, b) => a.distance - b.distance)[0];
    let targetIndex = nearest && nearest.distance <= 8 ? nearest.index : -1;
    if (targetIndex < 0) {
      const place = await reversePhotoPlace(coords) || { name: `Photo · ${coords.lat.toFixed(4)}°, ${coords.lon.toFixed(4)}°`, area: 'GPS location from photograph', ...coords };
      trip.locations.push({ ...place, entries: [], memories: 0 }); targetIndex = trip.locations.length - 1;
    }
    if (trip.locations[targetIndex] === sourcePlace) { memory.photoKeys ||= []; memory.photoKeys.push(key); attachedHere.push(file.name); continue; }
    let photoMemory = additions.get(targetIndex);
    if (!photoMemory) { const place = trip.locations[targetIndex]; place.entries ||= []; photoMemory = { id: crypto.randomUUID(), title: `Photographs from ${place.name}`, note: 'A place remembered through photographs.', with: '', extra: '', date: new Date(file.lastModified || Date.now()).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), mood: '', photoKeys: [] }; place.entries.push(photoMemory); place.memories = place.entries.length; additions.set(targetIndex, photoMemory); }
    photoMemory.photoKeys.push(key);
  }
  persist();
  const routed = [...additions.keys()].length;
  const summary = [`${routed ? `${routed} photo location${routed === 1 ? '' : 's'} matched or added` : 'Photos saved'}`, withoutGps ? `${withoutGps} without GPS kept with this memory` : ''];
  notify(summary.filter(Boolean).join(' · ') + '.');
  return { attachedHere };
}
async function deleteAssets(ids = []) { if (!ids.length) return; const db = await mediaDB; await new Promise((ok, bad) => { const tx = db.transaction('assets', 'readwrite'), store = tx.objectStore('assets'); ids.filter(Boolean).forEach(id => store.delete(id)); tx.oncomplete = ok; tx.onerror = () => bad(tx.error); }); }
function dataUrlBlob(src) { const [meta, body] = src.split(','); const mime = /data:(.*?);/.exec(meta)?.[1] || 'image/jpeg'; const bytes = atob(body); const arr = new Uint8Array(bytes.length); for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i); return new Blob([arr], { type: mime }); }
async function migrateLocalPhotos() {
  let changed = false;
  for (const trip of journeys) {
    if (typeof trip.cover === 'string' && trip.cover.startsWith('data:')) { trip.coverKey = await putAsset(dataUrlBlob(trip.cover)); delete trip.cover; changed = true; }
    for (const place of trip.locations || []) {
      if (Array.isArray(place.entries)) continue;
      const oldImages = Array.isArray(place.photos) ? place.photos : [];
      const photoKeys = [...(place.photoKeys || [])];
      for (const src of oldImages) if (typeof src === 'string' && src.startsWith('data:')) photoKeys.push(await putAsset(dataUrlBlob(src)));
      const count = Array.isArray(place.memories) ? place.memories.length : Number(place.memories) || 0;
      place.entries = count || place.note || photoKeys.length ? [{ id: crypto.randomUUID(), title: (place.note || place.name || 'A moment').split(/[.!?]/)[0], note: place.note || '', with: '', extra: '', date: place.date || '', mood: place.mood || '', photoKeys }] : [];
      delete place.photos; delete place.photoKeys; place.memories = place.entries.length; changed = true;
    }
  }
  if (changed) persist();
}
function clearObjectUrls() { objectUrls.forEach(URL.revokeObjectURL); objectUrls = []; }
function previewUrl(blob) { const url = URL.createObjectURL(blob); objectUrls.push(url); return url; }

function goAuth(mode = 'login') {
  $('#landing').classList.add('zooming');
  setTimeout(() => { $('#landing').classList.add('hidden'); $('#auth').classList.remove('hidden'); $('#landing').classList.remove('zooming'); renderAuth(mode); }, 420);
}
function renderAuth(mode) {
  $('#authTitle').textContent = mode === 'login' ? 'Welcome back' : 'Create your archive';
  $('#authDescription').textContent = mode === 'login' ? 'Step back into the places that made you.' : 'A home for the stories you will make along the way.';
  $('#authForm').innerHTML = `<label>Your name<input name="name" placeholder="How should we address you?" value="${mode === 'login' && user.name !== 'Traveler' ? esc(user.name) : ''}" required autocomplete="name"></label><label>Email address<input name="email" placeholder="you@example.com" type="email" value="${mode === 'login' ? esc(user.email) : ''}" required autocomplete="email"></label><label>Password<input name="password" placeholder="At least 6 characters" type="password" minlength="6" required autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}"></label><button class="auth-submit">${mode === 'login' ? 'ENTER ARCHIVE' : 'CREATE ARCHIVE'} &nbsp; ↗</button>`;
  $('#authSwitch').innerHTML = `${mode === 'login' ? 'Don’t have an archive yet?' : 'Already have an archive?'} <button id="switchAuth">${mode === 'login' ? 'Create one' : 'Log in'}</button>`;
  $('#switchAuth').onclick = () => renderAuth(mode === 'login' ? 'signup' : 'login');
  $('#authForm').onsubmit = async e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); user = { name: data.name.trim() || 'Traveler', email: data.email.trim() }; localStorage.setItem('terra-user', JSON.stringify(user)); $('#auth').classList.add('hidden'); await enterApp(); };
}
function backLanding() { document.body.classList.remove('archive-mode'); $('#auth').classList.add('hidden'); $('#landing').classList.remove('hidden'); }
async function enterApp() {
  await migrateLocalPhotos();
  const transition = $('#transition'); transition.classList.add('on');
  setTimeout(() => { transition.classList.remove('on'); $('#app').style.display = 'block'; showScreen('dashboard'); }, 480);
}
function showScreen(id) {
  document.body.classList.add('archive-mode');
  if (id === 'journey') journeyView = 'story';
  $$('.screen').forEach(el => el.classList.toggle('active', el.id === id)); window.scrollTo({ top: 0, behavior: 'smooth' });
  if (id === 'dashboard') renderDashboard(); if (id === 'journey') renderJourney(); if (id === 'memory') renderMemory();
}
function setJourneyView(view) {
  journeyView = view;
  $('#journeyStoryPanel').classList.toggle('hidden', view !== 'story');
  $('#journeyMapPanel').classList.toggle('hidden', view !== 'map');
  $('#storyViewButton').classList.toggle('active', view === 'story');
  $('#mapViewButton').classList.toggle('active', view === 'map');
  $('#storyViewButton').setAttribute('aria-selected', String(view === 'story'));
  $('#mapViewButton').setAttribute('aria-selected', String(view === 'map'));
  if (view === 'map') drawMap();
}

function journeyCard(trip) {
  return `<button class="revisit-card" data-open="${esc(trip.id)}"><span class="journey-art"></span><span class="journey-info"><span class="journey-date">${esc(trip.date)}${trip.folder ? ' · ' + esc(trip.folder.toUpperCase()) : ''}</span><h3 class="journey-name">${esc(trip.name)}</h3><span class="journey-meta">${trip.locations.length} places &nbsp;·&nbsp; ${trip.locations.reduce((n, p) => n + (p.entries?.length || 0), 0)} moments</span></span><span class="revisit-arrow">↗</span></button>`;
}
const worldPalette = ['#abff46', '#11ffff', '#ffff23', '#fe05bb', '#8cf5ff'];
function chapterPlaceMatches(chapter, place) {
  const token = String(chapter.place || '').split(/[·|,]/)[0].trim().toLowerCase();
  return token && [place.name, place.area].some(value => String(value || '').toLowerCase().includes(token));
}
function buildWorldNodes() {
  const nodes = [];
  journeys.forEach((trip, tripIndex) => (trip.locations || []).forEach((place, locationIndex) => {
    if (!Number.isFinite(Number(place.lat)) || !Number.isFinite(Number(place.lon))) return;
    const chapters = (trip.chapters || []).filter(chapter => chapter.locationIndex === locationIndex || (chapter.memoryId && (place.entries || []).some(memory => memory.id === chapter.memoryId)) || (!Number.isInteger(chapter.locationIndex) && !chapter.memoryId && chapterPlaceMatches(chapter, place)));
    const addNode = (chapter, memory, chapterIndex = -1) => nodes.push({ trip, tripIndex, place, locationIndex, chapter, chapterIndex, memory, title: chapter?.title || memory?.title || place.name, feeling: memory?.mood || chapter?.mood || place.mood || 'Not recorded', color: worldPalette[tripIndex % worldPalette.length] });
    if (chapters.length) chapters.forEach(chapter => addNode(chapter, (place.entries || []).find(memory => memory.id === chapter.memoryId) || (place.entries || []).find(memory => memory.mood) || place.entries?.[0], trip.chapters.indexOf(chapter)));
    else if (place.entries?.length) place.entries.forEach(memory => addNode(null, memory));
    else addNode(null, null);
  }));
  return nodes;
}
function projectWorldPoint(latValue, lonValue) {
  const rad = value => value * Math.PI / 180, lat = rad(Number(latValue)), lon = rad(Number(lonValue)), lat0 = rad(Math.max(-80, Math.min(80, 16 + worldTilt))), lon0 = rad(50 + worldRotation), delta = lon - lon0;
  const visibility = Math.sin(lat0) * Math.sin(lat) + Math.cos(lat0) * Math.cos(lat) * Math.cos(delta);
  const x = Math.cos(lat) * Math.sin(delta), y = Math.cos(lat0) * Math.sin(lat) - Math.sin(lat0) * Math.cos(lat) * Math.cos(delta);
  return visibility <= 0 ? null : { x: 50 + x * 44, y: 50 - y * 44 };
}
function setupWorldGlobe() {
  const canvas = $('#worldCanvas'), stage = $('#worldStage');
  if (!canvas || !stage || canvas.dataset.globeReady) return;
  canvas.dataset.globeReady = 'true';
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) { canvas.classList.add('world-canvas-fallback'); return; }
  const vertexSource = `attribute vec2 a_position; void main(){ gl_Position=vec4(a_position,0.0,1.0); }`;
  const fragmentSource = `precision mediump float;
    uniform sampler2D u_map; uniform vec2 u_size; uniform float u_yaw; uniform float u_center_lat;
    const float PI=3.14159265358979323846;
    void main(){
      vec2 p=(gl_FragCoord.xy-u_size*0.5)/(min(u_size.x,u_size.y)*0.44);
      float r2=dot(p,p); if(r2>1.0) discard;
      float z=sqrt(max(0.0,1.0-r2)); float cl=cos(u_center_lat); float sl=sin(u_center_lat);
      float lat=asin(clamp(p.y*cl+z*sl,-1.0,1.0));
      float east=z*cl-p.y*sl; float delta=atan(p.x,east);
      float lon=PI*(50.0/180.0+u_yaw/180.0)+delta;
      float u=fract(lon/(2.0*PI)+0.5); float v=0.5-lat/PI;
      vec3 color=texture2D(u_map,vec2(u,v)).rgb;
      float limb=0.53+0.47*pow(z,0.34);
      float atmosphere=pow(1.0-z,3.0);
      color=color*limb+vec3(0.055,0.17,0.25)*atmosphere*0.36;
      gl_FragColor=vec4(color,1.0);
    }`;
  const compile = (type, source) => { const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader); if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){ gl.deleteShader(shader); return null; } return shader; };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource), fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) { canvas.classList.add('world-canvas-fallback'); return; }
  const program = gl.createProgram(); gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { canvas.classList.add('world-canvas-fallback'); return; }
  gl.useProgram(program);
  const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'a_position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  worldGl=gl; worldGlProgram=program; worldGlUniforms={map:gl.getUniformLocation(program,'u_map'),size:gl.getUniformLocation(program,'u_size'),yaw:gl.getUniformLocation(program,'u_yaw'),centerLat:gl.getUniformLocation(program,'u_center_lat')}; gl.uniform1i(worldGlUniforms.map,0);
  const image=new Image(); image.onload=()=>{
    const maxSize=Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),4096), scale=Math.min(1,maxSize/image.width), width=Math.round(image.width*scale), height=Math.round(image.height*scale);
    let source=image;
    if(width!==image.width){ const bufferCanvas=document.createElement('canvas'); bufferCanvas.width=width; bufferCanvas.height=height; bufferCanvas.getContext('2d').drawImage(image,0,0,width,height); source=bufferCanvas; }
    const texture=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,source); gl.generateMipmap(gl.TEXTURE_2D); worldGlTexture=texture; worldGlReady=true; resizeWorldGlobe(); drawWorldGlobe();
  };
  image.onerror=()=>canvas.classList.add('world-canvas-fallback'); image.src='assets/earth-texture.jpg';
  if ('ResizeObserver' in window) { worldResizeObserver=new ResizeObserver(resizeWorldGlobe); worldResizeObserver.observe(stage); }
  else window.addEventListener('resize',resizeWorldGlobe);
}
function resizeWorldGlobe() {
  if (!worldGl) return; const canvas=$('#worldCanvas'), rect=canvas.getBoundingClientRect(), dpr=Math.min(2,window.devicePixelRatio||1), width=Math.max(1,Math.round(rect.width*dpr)), height=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;worldGl.viewport(0,0,width,height);drawWorldGlobe();}
}
function drawWorldGlobe() {
  if (!worldGl || !worldGlReady || !worldGlTexture) return;
  worldGl.useProgram(worldGlProgram); worldGl.activeTexture(worldGl.TEXTURE0); worldGl.bindTexture(worldGl.TEXTURE_2D,worldGlTexture);
  worldGl.uniform2f(worldGlUniforms.size,$('#worldCanvas').width,$('#worldCanvas').height); worldGl.uniform1f(worldGlUniforms.yaw,worldRotation); worldGl.uniform1f(worldGlUniforms.centerLat,Math.max(-80,Math.min(80,16+worldTilt))*Math.PI/180); worldGl.drawArrays(worldGl.TRIANGLES,0,6);
}
function updateWorldPins() {
  worldNodes.forEach(node=>{
    const base=projectWorldPoint(node.place.lat,node.place.lon), point=base?{x:base.x+(node.offset?.x||0),y:base.y+(node.offset?.y||0)}:null; node.point=point;
    const pin=$(`[data-world-index="${node.index}"]`); if(!pin)return; pin.style.display=point?'':'none'; if(point){pin.style.left=`${point.x}%`;pin.style.top=`${point.y}%`;}
  });
}
function renderWorldRoutes() {
  if (!$('#worldRoutes')) return;
  const paths=journeys.map((trip,index)=>{
    const visibleSegments=[]; let segment=[];
    for(const place of trip.locations||[]){
      const point=projectWorldPoint(place.lat,place.lon);
      if(point)segment.push(point); else {if(segment.length>1)visibleSegments.push(segment);segment=[];}
    }
    if(segment.length>1)visibleSegments.push(segment);
    return visibleSegments.map(points=>{const d=points.map((point,i)=>`${i?'L':'M'} ${(point.x*10).toFixed(1)} ${(point.y*10).toFixed(1)}`).join(' ');return `<path d="${d}" fill="none" stroke="${worldPalette[index%worldPalette.length]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="7 8" vector-effect="non-scaling-stroke"/>`;}).join('');
  }).join('');
  $('#worldRoutes').innerHTML=`<defs><clipPath id="worldDiscClip"><circle cx="500" cy="500" r="455"/></clipPath></defs><g clip-path="url(#worldDiscClip)">${paths}</g>`;
}
function updateWorldRotation() {
  drawWorldGlobe(); updateWorldPins(); renderWorldRoutes();
  if (worldFocus !== null) applyWorldZoom();
}
function setupWorldInteraction() {
  const stage = $('#worldStage'); if (!stage || stage.dataset.interactionReady) return;
  stage.dataset.interactionReady = 'true';
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { $('#worldView')?.classList.add('world-revealed'); $('#app')?.classList.add('world-revealed'); }
    }, { threshold: .08 });
    observer.observe($('#worldView'));
  } else { $('#worldView')?.classList.add('world-revealed'); $('#app')?.classList.add('world-revealed'); }
  stage.addEventListener('wheel', event => {
    event.preventDefault(); worldFocus = null; worldScale = Math.max(1, Math.min(2.8, worldScale * Math.exp(-event.deltaY * .001)));
    applyWorldZoom();
  }, { passive: false });
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('.world-controls, .world-pin, .world-story-card')) return;
    event.preventDefault();
    stage.setPointerCapture(event.pointerId); worldPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    worldFocus = null;
    if (worldPointers.size >= 2) {
      const [a, b] = [...worldPointers.values()], dx = b.x - a.x, dy = b.y - a.y;
      worldDrag = null; worldPinch = { distance: Math.hypot(dx, dy), angle: Math.atan2(dy, dx), midpointY: (a.y + b.y) / 2, scale: worldScale, rotation: worldRotation, tilt: worldTilt };
    } else worldDrag = { x: event.clientX, y: event.clientY, rotation: worldRotation, tilt: worldTilt };
  });
  stage.addEventListener('pointermove', event => {
    if (!worldPointers.has(event.pointerId)) return;
    worldPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (worldPointers.size >= 2 && worldPinch) {
      const [a, b] = [...worldPointers.values()], dx = b.x - a.x, dy = b.y - a.y;
      worldScale = Math.max(1, Math.min(2.8, worldPinch.scale * Math.hypot(dx, dy) / Math.max(1, worldPinch.distance)));
      worldRotation = worldPinch.rotation - (Math.atan2(dy, dx) - worldPinch.angle) * 180 / Math.PI;
      worldTilt = Math.max(-75, Math.min(75, worldPinch.tilt + ((a.y + b.y) / 2 - worldPinch.midpointY) * .12));
      applyWorldZoom(); updateWorldRotation();
    } else if (worldDrag) {
      worldRotation = worldDrag.rotation - (event.clientX - worldDrag.x) * .35;
      worldTilt = Math.max(-75, Math.min(75, worldDrag.tilt + (event.clientY - worldDrag.y) * .2));
      updateWorldRotation();
    }
  });
  const endPointer = event => {
    worldPointers.delete(event.pointerId); worldPinch = null;
    if (worldPointers.size === 1) { const point = [...worldPointers.values()][0]; worldDrag = { x: point.x, y: point.y, rotation: worldRotation, tilt: worldTilt }; }
    else worldDrag = null;
  };
  stage.addEventListener('pointerup', endPointer); stage.addEventListener('pointercancel', endPointer); stage.addEventListener('lostpointercapture', endPointer);
}
function renderWorld() {
  const stage = $('#worldStage'); if (!stage) return;
  setupWorldGlobe();
  let legend = $('#worldLegend');
  if (!legend) { legend = document.createElement('div'); legend.id = 'worldLegend'; legend.className = 'world-legend'; $('.world-section-heading').append(legend); }
  legend.innerHTML = journeys.map((trip, index) => ({ trip, index })).filter(({ trip }) => (trip.locations || []).some(place => Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)))).map(({ trip, index }) => `<span><i style="--journey-color:${worldPalette[index % worldPalette.length]}"></i>${esc(trip.name)}</span>`).join('');
  worldNodes = buildWorldNodes().map((node, index) => ({ ...node, index, point: projectWorldPoint(node.place.lat, node.place.lon), offset:{x:0,y:0} }));
  const samePlace = new Map();
  for (const node of worldNodes) { const key = `${Number(node.place.lat).toFixed(3)}:${Number(node.place.lon).toFixed(3)}`; if (!samePlace.has(key)) samePlace.set(key, []); samePlace.get(key).push(node); }
  for (const group of samePlace.values()) if (group.length > 1) group.forEach((node, i) => { const angle = -Math.PI / 2 + i * 2 * Math.PI / group.length; node.offset = { x: Math.cos(angle) * 1.8, y: Math.sin(angle) * 1.8 }; });
  $('#worldPins').innerHTML = worldNodes.map(node => `<button type="button" class="world-pin" data-world-index="${node.index}" style="left:${node.point?.x??50}%;top:${node.point?.y??50}%;display:${node.point?'':'none'};--journey-color:${node.color}" aria-label="${esc(node.trip.name)}: ${esc(node.place.name)}, ${esc(node.title)}, feeling ${esc(node.feeling)}" title="${esc(node.trip.name)} · ${esc(node.place.name)} · ${esc(node.title)} · ${esc(node.feeling)}"><span class="world-pin-label">${esc(node.feeling)}</span><i></i></button>`).join('');
  renderWorldRoutes();
  $$('[data-world-index]').forEach(button => button.onclick = () => focusWorldNode(Number(button.dataset.worldIndex)));
  $('#worldEmpty').classList.toggle('hidden', worldNodes.length > 0);
  $('#worldStoryCard').classList.remove('selected');
  $('#worldTripName').textContent = 'SELECT A POINT OF LIGHT'; $('#worldChapterName').textContent = 'Your stories, across the Earth'; $('#worldLocationName').textContent = 'Each point marks a place in one of your journeys.'; $('#worldFeeling').textContent = 'Choose a glowing point on the globe';
  $('#worldOpenChapter').disabled = true;
  $('#worldOpenChapter').onclick = () => {
    const node = worldFocus === null ? null : worldNodes[worldFocus]; if (!node) return;
    jid = node.trip.id; lid = node.locationIndex; mid = 0; journeyView = 'story';
    if (node.chapterIndex >= 0) {
      showScreen('journey');
      requestAnimationFrame(() => document.querySelector(`[data-chapter="${node.chapterIndex}"]`)?.click());
    } else {
      const entryIndex = node.memory ? (node.place.entries || []).findIndex(memory => memory.id === node.memory.id) : -1;
      if (entryIndex >= 0) { mid = entryIndex; showScreen('memory'); }
      else showScreen('journey');
    }
  };
  worldScale = 1; worldFocus = null; applyWorldZoom(); updateWorldRotation(); setupWorldInteraction();
  $('#worldZoomIn').onclick = () => { worldScale = Math.min(2.8, worldScale + .22); applyWorldZoom(); };
  $('#worldZoomOut').onclick = () => { worldScale = Math.max(1, worldScale - .22); if (worldScale === 1) worldFocus = null; applyWorldZoom(); };
  $('#worldReset').onclick = () => { worldScale = 1; worldFocus = null; worldTilt = 0; worldRotation = 0; applyWorldZoom(); updateWorldRotation(); };
}
function applyWorldZoom() {
  const sphere = $('#worldSphere'), stage = $('#worldStage'); if (!sphere || !stage) return;
  const width = stage.clientWidth, height = stage.clientHeight, focus = worldFocus !== null ? worldNodes[worldFocus]?.point : null;
  const tx = focus ? -worldScale * (focus.x / 100 * width - width / 2) : 0, ty = focus ? -worldScale * (focus.y / 100 * height - height / 2) : 0;
  sphere.style.transform = `translate(${tx}px,${ty}px) scale(${worldScale})`;
  $('#worldZoomLevel').textContent = `${Math.round(worldScale * 100)}%`;
}
function focusWorldNode(index) {
  const node = worldNodes[index]; if (!node) return;
  worldFocus = index; worldScale = 1.75; applyWorldZoom();
  $$('[data-world-index]').forEach(pin => pin.classList.toggle('active', Number(pin.dataset.worldIndex) === index));
  $('#worldTripName').textContent = node.trip.name;
  $('#worldLocationName').textContent = `${node.place.name} · ${node.place.area || 'A place along the way'}`;
  $('#worldChapterName').textContent = node.title;
  $('#worldFeeling').textContent = node.feeling;
  $('#worldStoryCard').classList.add('selected');
  $('#worldOpenChapter').disabled = false;
}
async function renderDashboard() {
  $('#userName').textContent = user.name; $('#avatar').textContent = (user.name[0] || 'T').toUpperCase(); clearObjectUrls();
  const unfiled = journeys.filter(t => !t.folder), visibleTrips = filterFolder ? journeys.filter(t => t.folder === filterFolder) : unfiled;
  $('#folderRail').innerHTML = filterFolder ? `<button class="folder-breadcrumb" id="backToCollections" aria-label="Back to all stories"><span class="back-chevron" aria-hidden="true">‹</span><span>Back to all stories</span></button><span class="crumb-separator" aria-hidden="true">·</span><span class="current-folder">${esc(filterFolder)}</span>` : '';
  if (!filterFolder) {
    const storyItems = [];
    const cards = folders.map(f => { const count = journeys.filter(t => t.folder === f).length; return { type: 'folder', html: `<button class="revisit-card collection-card" data-collection="${esc(f)}"><span class="journey-art scrapbook-art"></span><span class="journey-info"><span class="journey-date">PRIVATE COLLECTION</span><h3 class="journey-name">${esc(f)}</h3><span class="journey-meta">${count} ${count === 1 ? 'journey' : 'journeys'} inside</span></span><span class="revisit-arrow">↗</span></button>` }; });
    let fi = 0, ti = 0;
    while (fi < cards.length || ti < unfiled.length) {
      if (fi < cards.length) storyItems.push(cards[fi++].html);
      if (ti < unfiled.length) storyItems.push(journeyCard(unfiled[ti++]));
    }
    $('#journeyList').innerHTML = storyItems.join('');
  } else {
    $('#journeyList').innerHTML = visibleTrips.map(journeyCard).join('') || '<div class="empty-revisit">No journeys in this collection yet.<br><span>Edit a journey to add it here.</span></div>';
    $('#backToCollections')?.addEventListener('click', () => { filterFolder = ''; renderDashboard(); });
  }
  for (const trip of visibleTrips) if (trip.coverKey) { const blob = await getAsset(trip.coverKey); if (blob) { const card = $(`[data-open="${CSS.escape(trip.id)}"] .journey-art`); if (card) { card.style.backgroundImage = `url("${previewUrl(blob)}")`; card.classList.add('user-cover'); } } }
  $('#emptyRevisit').classList.toggle('hidden', !!(folders.length || journeys.length));
  $$('[data-open]').forEach(btn => { btn.onclick = () => { jid = btn.dataset.open; lid = 0; mid = 0; showScreen('journey'); }; btn.oncontextmenu = event => showJourneyMenu(event, btn.dataset.open); });
  $$('[data-collection]').forEach(btn => btn.onclick = () => { filterFolder = btn.dataset.collection; renderDashboard(); });
  renderWorld();
}

function initMap() {
  if (tripMap) return;
  if (!window.L) { showMapStatus('Map library did not load. Start TerraDiary over localhost and check your internet connection.'); return; }
  tripMap = L.map('tripMap', { scrollWheelZoom: false, zoomControl: true }).setView([35.6586, 139.7454], 11);
  mountBaseTiles(0);
  markerLayer = L.layerGroup().addTo(tripMap);
  tripMap.on('click', e => { if (!mapPickMode) return; mapPickMode = false; closeModal(); setTimeout(() => openModal('location', false, { lat: e.latlng.lat, lon: e.latlng.lng }), 120); });
}
function mountBaseTiles(provider) {
  baseTileProvider = provider;
  if (baseTileLayer) tripMap.removeLayer(baseTileLayer);
  let errors = 0, switched = false;
  const options = provider === 0
    ? { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri, HERE, Garmin, Intermap, increment P Corp., GEBCO, USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China, &copy; OpenStreetMap contributors' }
    : { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' };
  baseTileLayer = L.tileLayer(options.url, { maxZoom: 19, attribution: options.attribution }).addTo(tripMap);
  baseTileLayer.on('tileerror', () => {
    errors++;
    if (errors >= 3 && !switched) {
      switched = true;
      if (provider === 0) { showMapStatus('Trying the alternate map source…'); setTimeout(() => mountBaseTiles(1), 350); }
      else showMapStatus('Both map sources are blocked or offline. Pins and your route are still saved; check your network or browser extensions.');
    }
  });
  baseTileLayer.on('load', () => { if (!errors) $('#mapStatus')?.classList.add('hidden'); });
}
function showMapStatus(message) { const status = $('#mapStatus'); if (status) { status.textContent = message; status.classList.remove('hidden'); } }
function drawMap() {
  if (!$('#journey').classList.contains('active') || journeyView !== 'map') return;
  initMap(); if (!tripMap) return;
  requestAnimationFrame(() => {
    tripMap.invalidateSize(); markerLayer.clearLayers(); if (routeLayer) tripMap.removeLayer(routeLayer);
    const places = currentTrip()?.locations || [], points = [];
    places.forEach((p, i) => {
      if (!Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lon))) return;
      const point = [Number(p.lat), Number(p.lon)]; points.push(point);
      const marker = L.circleMarker(point, { radius: i === lid ? 9 : 7, color: '#f6f3e7', weight: 3, fillColor: i === lid ? '#3e6341' : '#cb8b56', fillOpacity: 1 }).addTo(markerLayer);
      const photoCount = (p.entries || []).reduce((count, entry) => count + (entry.photoKeys || []).length, 0);
      marker.bindTooltip(`${esc(p.name)} · ${photoCount} ${photoCount === 1 ? 'PHOTO' : 'PHOTOS'}`, { direction: 'top', offset: [0, -7] });
      marker.on('click', () => { lid = i; renderJourney(); requestAnimationFrame(() => L.popup({ closeButton: false, offset: [0, -8], className: 'photo-count-popup' }).setLatLng(point).setContent(`<strong>${photoCount}</strong> ${photoCount === 1 ? 'PHOTO' : 'PHOTOS'}<br><span>${esc(p.name)}</span>`).openOn(tripMap)); });
    });
    if (points.length > 1) routeLayer = L.polyline(points, { color: '#6e8b62', weight: 2.5, opacity: .74, dashArray: '5 7' }).addTo(tripMap);
    if (points.length > 1) tripMap.fitBounds(points, { padding: [42, 42], maxZoom: 12 }); else if (points.length === 1) tripMap.setView(points[0], 13); else tripMap.setView([35.6586, 139.7454], 11);
  });
}
function renderJourney() {
  const trip = currentTrip(); if (!trip) return;
  $('#journeyTitle').textContent = trip.name; $('#journeyDesc').textContent = trip.description; $('#journeyEyebrow').textContent = `${trip.date} · ${trip.folder ? trip.folder.toUpperCase() + ' · ' : ''}PRIVATE JOURNEY`;
  $('#deleteJourneyDirect').onclick = deleteCurrentJourney;
  const hasStory = !!((trip.chapters || []).length || trip.locations.some(p => (p.entries || []).length));
  const hasPlace = trip.locations.length > 0;
  $('#journeyEmpty').classList.toggle('hidden', hasStory);
  $('#journeyStoryPanel .chapter-section').classList.toggle('hidden', !hasStory);
  $('#journeyEmpty h2').textContent = hasPlace ? 'Your place is ready.' : 'Your journey is ready.';
  $('#journeyEmpty p').textContent = hasPlace ? 'Write a chapter to keep the first moment from this place.' : 'Add your first place to start the map, then write a chapter to keep the moment.';
  $('#journeyFirstPlace').textContent = hasPlace ? '＋ WRITE YOUR FIRST CHAPTER' : '＋ ADD YOUR FIRST PLACE';
  $('#journeyFirstPlace').onclick = () => { if (hasPlace) openModal('chapter'); else { setJourneyView('map'); openModal('location'); } };
  $('#storyViewButton').onclick = () => setJourneyView('story');
  $('#mapViewButton').onclick = () => setJourneyView('map');
  $('#addChapter').onclick = () => { if (!currentPlace()) { setJourneyView('map'); openModal('location'); } else openModal('chapter'); };
  $('#placeCountHeading').textContent = trip.locations[lid]?.name || 'Your places';
  $('#placeList').innerHTML = trip.locations.map((p, i) => { const photos = (p.entries || []).reduce((count, entry) => count + (entry.photoKeys || []).length, 0); return `<button class="place-item ${i === lid ? 'active' : ''}" data-place="${i}" aria-haspopup="menu" aria-label="${esc(p.name)}; right-click for options"><span class="place-num">0${i + 1}</span><span class="place-name">${esc(p.name)}</span><span class="place-count">${p.entries?.length || 0} MOMENTS · ${photos} PHOTOS</span></button>`; }).join('') || '<div class="eyebrow">ADD THE FIRST PLACE TO YOUR MAP</div>';
  $$('[data-place]').forEach(btn => { btn.onclick = () => { lid = Number(btn.dataset.place); mid = 0; renderJourney(); }; btn.oncontextmenu = event => showPlaceMenu(event, Number(btn.dataset.place)); });
  renderSelectedPlace();
  $('#chapterList').innerHTML = (trip.chapters || []).map((c, i) => `<button class="chapter" data-chapter="${i}"><span class="chapter-number">0${i + 1} —</span><span><h3>${esc(c.title)}</h3><p>“${esc(c.note)}”</p></span><span class="chapter-place">${esc(c.place)}</span></button>`).join('') || '';
  $$('[data-chapter]').forEach(btn => btn.onclick = () => {
    const chapter = trip.chapters[Number(btn.dataset.chapter)];
    if (chapter?.memoryId) { lid = chapter.locationIndex ?? 0; mid = (trip.locations[lid]?.entries || []).findIndex(m => m.id === chapter.memoryId); if (mid >= 0) showScreen('memory'); }
    else if (trip.locations.length) { lid = Math.min(Number(btn.dataset.chapter), trip.locations.length - 1); mid = 0; showScreen('memory'); }
  });
  setJourneyView(journeyView);
}
function renderSelectedPlace() {
  const place = currentPlace();
  if (!place) { $('#selectedMemory').innerHTML = '<div class="eyebrow">A STORY WILL LIVE HERE</div><p class="place-empty-note">Add your first place, then write a chapter to keep a memory.</p>'; }
  else {
    const memories = place.entries || [];
    $('#selectedMemory').innerHTML = `<div class="eyebrow">${memories.length} ${memories.length === 1 ? 'MOMENT' : 'MOMENTS'} AT THIS PLACE</div>${memories.map((m, i) => `<button class="memory-teaser" data-memory="${i}"><span>${esc(m.date || 'A MOMENT ALONG THE WAY')}</span><b>${esc(m.title || place.name)}</b><i>↗</i></button>`).join('')}${memories.length ? '' : '<p class="place-empty-note">Add a chapter in Your Story to save a moment here.</p>'}`;
    $$('[data-memory]').forEach(btn => btn.onclick = () => { mid = Number(btn.dataset.memory); showScreen('memory'); });
  }
}

async function renderMemory() {
  const place = currentPlace(), memory = currentMemory(); if (!place || !memory) return;
  if (longformMemoryId !== memory.id) { longformOpen = false; longformMemoryId = memory.id; }
  clearObjectUrls();
  $('#memoryHeading').textContent = memory.title || place.name; $('#memorySub').textContent = `${currentTrip().name} / ${place.area}`;
  $('#memoryTitle').textContent = memory.title || 'A moment, remembered';
  $('#memoryNote').textContent = [memory.note, memory.with ? `With ${memory.with}.` : '', memory.extra].filter(Boolean).join('\n\n') || 'What would you like to remember about this?';
  $('#memoryPlace').textContent = place.area; $('#memoryJourney').textContent = currentTrip().name; $('#memoryDate').textContent = memory.date || 'A DATE TO REMEMBER'; $('#memoryMood').textContent = `✳  ${memory.mood ? memory.mood.toUpperCase() : 'A FEELING'}`; $('#memoryMood').onclick = () => openModal('feeling');
  $('#memoryChapter').textContent = (currentTrip().chapters?.find(c => c.memoryId === memory.id)?.title || currentTrip().chapters?.[0]?.title || 'A MOMENT ALONG THE WAY').toUpperCase();
  const box = $('#memoryPhotos'); box.innerHTML = '';
  for (const id of memory.photoKeys || []) { const blob = await getAsset(id); if (!blob) continue; const frame = document.createElement('div'); frame.className = 'memory-photo-frame'; const img = document.createElement('img'); img.src = previewUrl(blob); img.alt = 'Your travel photograph'; img.className = 'memory-photo'; const remove = document.createElement('button'); remove.className = 'remove-photo'; remove.setAttribute('aria-label', 'Remove photo'); remove.textContent = '×'; remove.onclick = async () => { await deleteAssets([id]); memory.photoKeys = memory.photoKeys.filter(k => k !== id); persist(); renderMemory(); }; frame.append(img, remove); box.append(frame); }
  const add = document.createElement('div'); add.className = 'photo-empty'; add.innerHTML = '<span class="upload-symbol">＋</span><strong>ADD YOUR PHOTOGRAPHS</strong><span class="upload-hint">Drop images here or choose files</span><button class="upload-button" type="button">CHOOSE PHOTOS</button><input type="file" accept="image/*" multiple aria-label="Choose photos">'; box.append(add);
  const input = add.querySelector('input');
  const savePhotos = async files => { await savePhotoFiles(files, memory, place); await renderMemory(); };
  add.querySelector('.upload-button').onclick = () => input.click(); input.onchange = e => savePhotos([...e.target.files]);
  add.ondragover = e => { e.preventDefault(); add.classList.add('dragging'); }; add.ondragleave = () => add.classList.remove('dragging'); add.ondrop = e => { e.preventDefault(); add.classList.remove('dragging'); savePhotos([...e.dataTransfer.files]); };
  const layout = $('#memoryLayout'), reading = $('#memoryReadingView'), writing = $('#memoryWritingView'), openWriting = $('#openLongform'), text = $('#longformText');
  writing.querySelector('.eyebrow')?.remove(); writing.querySelector('h2')?.remove(); writing.querySelector('.longform-label')?.remove(); writing.querySelector('.writing-footer')?.remove();
  text.placeholder = '';
  $('#closeLongform').setAttribute('aria-label', 'Close journal');
  $('#closeLongform').textContent = '×';
  const topbar = writing.querySelector('.writing-topline'); topbar.querySelector('#expandJournal')?.remove();
  const expand = document.createElement('button'); expand.type = 'button'; expand.id = 'expandJournal'; expand.className = 'writing-expand'; topbar.insertBefore(expand, $('#closeLongform'));
  setJournalFullscreen(journalFullscreen && longformOpen);
  openWriting.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4.5 5.5c2.7-.9 5.2-.4 7.5 1.4v12c-2.3-1.8-4.8-2.3-7.5-1.4zM19.5 5.5c-2.7-.9-5.2-.4-7.5 1.4v12c2.3-1.8 4.8-2.3 7.5-1.4z"/><path d="M12 7v12"/></svg><span>JOURNAL</span>';
  reading.insertBefore(openWriting, $('#memoryMood'));
  layout.classList.toggle('longform-open', longformOpen); reading.classList.toggle('hidden', longformOpen); writing.classList.toggle('hidden', !longformOpen); openWriting.classList.toggle('hidden', longformOpen); openWriting.setAttribute('aria-expanded', String(longformOpen)); text.value = memory.reflection || '';
  openWriting.onclick = () => { longformOpen = true; reading.classList.add('hidden'); writing.classList.remove('hidden'); layout.classList.add('longform-open'); openWriting.classList.add('hidden'); openWriting.setAttribute('aria-expanded', 'true'); text.focus(); };
  expand.onclick = () => setJournalFullscreen(!journalFullscreen);
  $('#closeLongform').onclick = () => { memory.reflection = text.value; persist(); setJournalFullscreen(false); longformOpen = false; reading.classList.remove('hidden'); writing.classList.add('hidden'); layout.classList.remove('longform-open'); openWriting.classList.remove('hidden'); openWriting.setAttribute('aria-expanded', 'false'); };
  text.oninput = () => { memory.reflection = text.value; persist(); $('#longformStatus').textContent = 'SAVED JUST NOW'; };
}

function collectionOptions(selected = '') { return `<label>COLLECTION<select name="folder"><option value="">No collection</option>${folders.map(f => `<option value="${esc(f)}" ${f === selected ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></label>`; }
const backdrop = $('#modalBackdrop'), closeModal = () => { backdrop.classList.add('hidden'); };
function openModal(kind, makeNew = false, coordinates = null) {
  let title = '', intro = '', fields = '', submit = 'SAVE';
  if (kind === 'journey') { title = 'Create a journey'; intro = 'Give this journey a name. Add places and memories as they happen.'; fields = `<label>JOURNEY NAME<input name="name" placeholder="Japan, slowly" required></label><label>A LITTLE ABOUT THIS JOURNEY<textarea name="description" placeholder="What would you like to remember about it?"></textarea></label><div class="form-pair"><label>START DATE<input name="start" type="date" lang="en-US"></label><label>END DATE<input name="end" type="date" lang="en-US"></label></div>${collectionOptions()}`; submit = 'CREATE JOURNEY'; }
  else if (kind === 'folder') { title = 'Create a collection'; intro = 'Make a folder for journeys you want to keep together.'; fields = '<label>COLLECTION NAME<input name="name" placeholder="Summer notes" required></label>'; submit = 'CREATE COLLECTION'; }
  else if (kind === 'location') { title = 'Add a place'; intro = 'Choose where this part of your journey happened. After saving the place, you can add its first story chapter.'; fields = `<div class="search-line"><input id="geoQuery" placeholder="Search a place or address" autocomplete="off"><button class="search-action" type="button" id="doGeoSearch">SEARCH</button></div><div class="geo-results" id="geoResults"></div><button type="button" class="map-pick-action" id="pickMap">＋ PICK A POINT ON THE MAP</button><label>PLACE NAME<input name="name" id="placeName" placeholder="Tokyo Tower" required></label><label>CITY OR AREA<input name="area" id="placeArea" placeholder="Minato City, Tokyo"></label><input type="hidden" name="lat" id="placeLat"><input type="hidden" name="lon" id="placeLon"><p class="modal-note">Search sends the place query to OpenStreetMap Nominatim. You choose which result to use. &copy; OpenStreetMap contributors.</p>`; submit = 'SAVE PLACE'; }
  else if (kind === 'chapter') { title = 'Add a chapter'; intro = 'A journey is easier to remember in small pieces.'; fields = `<label>CHAPTER TITLE<input name="name" placeholder="The first morning" required></label><label>WHAT DO YOU REMEMBER?<textarea name="note" placeholder="A sentence is enough."></textarea></label><label>HOW DID IT FEEL?<select name="mood"><option value="">Choose a feeling</option>${['Excited','Peaceful','Curious','Grateful','Surprised','Nostalgic','Joyful','Anxious','Hopeful','Calm'].map(feeling => `<option>${feeling}</option>`).join('')}</select></label>`; submit = 'ADD CHAPTER'; }
  else if (kind === 'feeling') { const memory = currentMemory(); title = 'Name this feeling'; intro = 'Use your own words for what this moment felt like.'; fields = `<label>YOUR FEELING<input name="mood" value="${esc(memory?.mood || '')}" placeholder="For example, quietly hopeful" maxlength="80" autofocus></label>`; submit = 'SAVE FEELING'; }
  else if (kind === 'editJourney') { const t = currentTrip(); title = 'Journey details'; intro = 'Edit your story, choose a collection, or add your own cover photograph.'; fields = `<label>JOURNEY NAME<input name="name" value="${esc(t.name)}" required></label><label>DESCRIPTION<textarea name="description">${esc(t.description)}</textarea></label>${collectionOptions(t.folder)}<label>COVER PHOTOGRAPH<input name="cover" type="file" accept="image/*"></label><p class="modal-note">WITHOUT A COVER PHOTO, THE JOURNEY USES ITS PLACE MAP.</p>`; submit = 'SAVE CHANGES'; }
  else if (kind === 'memory') { const old = makeNew ? {} : currentMemory() || {}; title = makeNew ? 'Add a memory' : 'Edit this memory'; intro = 'Keep the little details only you can add.'; fields = `<label>WHAT HAPPENED?<textarea name="note" placeholder="What do you remember about this?">${esc(old.note)}</textarea></label><label>WHO WERE YOU WITH?<input name="with" placeholder="Add a name, if you like" value="${esc(old.with)}"></label><label>HOW DID YOU FEEL?<select name="mood"><option value="">Choose a feeling</option>${['Excited','Peaceful','Curious','Grateful','Surprised','Nostalgic'].map(m => `<option ${old.mood === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label><label>SOMETHING I DON’T WANT TO FORGET<textarea name="extra" placeholder="One line is plenty.">${esc(old.extra)}</textarea></label><label>DATE<input name="date" type="date"></label><label>PHOTOGRAPHS<input name="photos" type="file" accept="image/*" multiple></label><p class="modal-note">YOUR WORDS STAY YOURS. NOTHING WRITES A MEMORY FOR YOU.</p>`; submit = makeNew ? 'SAVE MEMORY' : 'SAVE CHANGES'; }
  else if (kind === 'account') { title = 'My account'; intro = 'Your profile and private archive stay in this browser.'; fields = `<label>DISPLAY NAME<input name="name" value="${esc(user.name)}" required></label><label>EMAIL ADDRESS<input name="email" type="email" value="${esc(user.email)}" required></label><p class="modal-note">This prototype does not create a cloud account or store your password.</p>`; submit = 'SAVE ACCOUNT'; }

  $('#modalContent').innerHTML = `<div class="eyebrow">TERRADIARY · YOUR PRIVATE ARCHIVE</div><h2>${title}</h2><p>${intro}</p><form class="form" id="modalForm">${fields}<button class="dark-button">${submit} &nbsp; ↗</button></form>${kind === 'editJourney' ? '<button class="modal-link delete-trip-action" id="deleteJourney">DELETE THIS JOURNEY</button>' : ''}`;
  backdrop.classList.remove('hidden');
  if (kind === 'location') {
    if (coordinates) { $('#placeLat').value = coordinates.lat; $('#placeLon').value = coordinates.lon; $('#geoResults').textContent = 'Map point selected. Name this place, then confirm it.'; }
    $('#doGeoSearch').onclick = () => searchPlaces($('#geoQuery').value);
    $('#geoQuery').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchPlaces(e.currentTarget.value); } });
    $('#geoQuery').addEventListener('input', () => { $('#placeLat').value = ''; $('#placeLon').value = ''; });
    $('#pickMap').onclick = () => { mapPickMode = true; closeModal(); showScreen('journey'); setJourneyView('map'); notify('Click the map to choose a place.'); };
  }
  $('#deleteJourney')?.addEventListener('click', deleteCurrentJourney);
  if (kind === 'account') { const logout = document.createElement('button'); logout.type = 'button'; logout.className = 'modal-link logout'; logout.textContent = 'LOG OUT'; logout.onclick = () => { closeModal(); $('#app').style.display = 'none'; backLanding(); }; $('#modalContent').append(logout); }
  $('#modalForm').onsubmit = async e => {
    e.preventDefault(); const form = e.target, data = new FormData(form);
    if (kind === 'journey') { const trip = { id: crypto.randomUUID(), name: data.get('name').trim(), description: data.get('description') || 'A journey in progress.', date: data.get('start') ? new Date(data.get('start')).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase() : 'JUST BEGUN', folder: data.get('folder') || '', coverKey: '', locations: [], chapters: [] }; journeys.unshift(trip); jid = trip.id; lid = 0; mid = 0; persist(); closeModal(); showScreen('journey'); notify('Journey created. Add your first place to the map.'); }
    else if (kind === 'folder') { const name = data.get('name').trim(); if (name && !folders.includes(name)) folders.push(name); if (name && window.collectionForJourney) { const trip = journeys.find(item => item.id === window.collectionForJourney); if (trip) trip.folder = name; window.collectionForJourney = ''; } persist(); filterFolder = ''; closeModal(); renderDashboard(); }
    else if (kind === 'location') { const rawLat = data.get('lat'), rawLon = data.get('lon'); if (!rawLat || !rawLon) { notify('Search for a place or choose a point on the map first.'); return; } const lat = Number(rawLat), lon = Number(rawLon); if (!Number.isFinite(lat) || !Number.isFinite(lon)) { notify('That map point could not be read. Choose it again.'); return; } const place = { name: data.get('name').trim(), area: data.get('area') || 'Somewhere along the way', lat, lon, entries: [] }; currentTrip().locations.push(place); lid = currentTrip().locations.length - 1; mid = 0; persist(); closeModal(); journeyView = 'story'; renderJourney(); openModal('chapter'); notify('Place saved. Add a chapter to keep the moment.'); }
    else if (kind === 'chapter') { const trip = currentTrip(), place = currentPlace(), title = data.get('name').trim(), note = data.get('note') || 'A moment, kept close.', memory = { id: crypto.randomUUID(), title, note, with: '', extra: '', date: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(), mood: data.get('mood') || '', photoKeys: [] }; place.entries ||= []; place.entries.push(memory); place.memories = place.entries.length; trip.chapters ||= []; trip.chapters.push({ title, place: place.name.toUpperCase(), note, mood: memory.mood, memoryId: memory.id, locationIndex: lid }); mid = place.entries.length - 1; persist(); closeModal(); journeyView = 'story'; renderJourney(); notify('Chapter saved as a memory in your journey.'); }
    else if (kind === 'editJourney') { const trip = currentTrip(); trip.name = data.get('name').trim(); trip.description = data.get('description'); trip.folder = data.get('folder') || ''; const cover = form.querySelector('[name="cover"]').files[0]; if (cover) { await deleteAssets([trip.coverKey]); trip.coverKey = await putAsset(cover); } persist(); closeModal(); renderJourney(); }
    else if (kind === 'memory') { const place = currentPlace(); let memory = makeNew ? { id: crypto.randomUUID(), title: '', note: '', with: '', extra: '', date: '', mood: '', photoKeys: [] } : currentMemory(); memory.note = data.get('note') || ''; memory.with = data.get('with') || ''; memory.extra = data.get('extra') || ''; memory.mood = data.get('mood') || ''; memory.date = data.get('date') ? new Date(data.get('date')).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() : memory.date || new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(); memory.title = memory.note.split(/[.!?]/)[0] || place.name; const files = [...form.querySelector('[name="photos"]').files]; if (files.length) await savePhotoFiles(files, memory, place); if (makeNew) { place.entries.push(memory); mid = place.entries.length - 1; } place.memories = place.entries.length; persist(); closeModal(); renderMemory(); if (!files.length) notify('Memory saved on this device.'); }
    else if (kind === 'feeling') { const memory = currentMemory(); if (!memory) return; memory.mood = data.get('mood').trim(); (currentTrip().chapters || []).filter(chapter => chapter.memoryId === memory.id).forEach(chapter => { chapter.mood = memory.mood; }); persist(); closeModal(); renderMemory(); notify('Feeling saved on this device.'); }
    else if (kind === 'account') { user = { ...user, name: data.get('name').trim(), email: data.get('email').trim() }; localStorage.setItem('terra-user', JSON.stringify(user)); closeModal(); renderDashboard(); }
  };
}

let searchBusy = false;
async function searchPlaces(query) {
  const q = query.trim(); if (!q || searchBusy) return;
  const wait = Math.max(0, 1100 - (Date.now() - lastSearchAt)); searchBusy = true;
  $('#geoResults').textContent = 'Searching…';
  setTimeout(async () => {
    lastSearchAt = Date.now();
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search'); url.search = new URLSearchParams({ format: 'jsonv2', limit: '5', q }).toString();
      const response = await fetch(url); if (!response.ok) throw new Error('Search unavailable'); const results = await response.json();
      const host = $('#geoResults'); host.innerHTML = '';
      if (!results.length) host.textContent = 'No places found. Try a nearby town or region.';
      results.forEach(result => { const button = document.createElement('button'); button.type = 'button'; button.className = 'geo-option'; button.textContent = result.display_name; button.onclick = () => { $('#placeName').value = result.name || q; $('#placeArea').value = result.display_name; $('#placeLat').value = result.lat; $('#placeLon').value = result.lon; host.textContent = `Selected ${result.display_name}. Confirm below to add its pin.`; }; host.append(button); });
    } catch { $('#geoResults').textContent = 'Place search is unavailable right now. Choose a point on the map instead.'; }
    finally { searchBusy = false; }
  }, wait);
}

async function deleteCurrentJourney() {
  const trip = currentTrip(); if (!trip || !confirm(`Delete “${trip.name}” and all of its memories? This cannot be undone.`)) return;
  const keys = [trip.coverKey, ...trip.locations.flatMap(p => (p.entries || []).flatMap(m => m.photoKeys || []))]; await deleteAssets(keys); journeys = journeys.filter(t => t.id !== trip.id); jid = journeys[0]?.id; filterFolder = ''; persist(); closeModal(); showScreen('dashboard'); notify('Journey deleted.');
}
async function deleteCurrentMemory() {
  const memory = currentMemory(), place = currentPlace(); if (!memory || !confirm(`Delete “${memory.title || place.name}” and its saved photographs? This cannot be undone.`)) return;
  await deleteAssets(memory.photoKeys || []); place.entries.splice(mid, 1); place.memories = place.entries.length; currentTrip().chapters = (currentTrip().chapters || []).filter(c => c.memoryId !== memory.id); mid = 0; persist(); showScreen('journey'); notify('Memory deleted.');
}
async function deleteJourneyPlace(index) {
  const trip = currentTrip(), place = trip?.locations?.[index];
  if (!place || !confirm(`Delete “${place.name}”, its memories and photographs? This cannot be undone.`)) return;
  const entries = place.entries || [];
  const memoryIds = new Set(entries.map(memory => memory.id).filter(Boolean));
  await deleteAssets(entries.flatMap(memory => memory.photoKeys || []));
  const chapters = trip.chapters || [];
  trip.locations.splice(index, 1);
  trip.chapters = chapters.filter(chapter => {
    if (chapter.memoryId && memoryIds.has(chapter.memoryId)) return false;
    if (Number.isInteger(chapter.locationIndex)) return chapter.locationIndex !== index;
    const chapterPlace = String(chapter.place || '').split('·')[0].trim().toLowerCase();
    return !chapterPlace || ![place.name, place.area].some(value => value && chapterPlace === String(value).trim().toLowerCase());
  }).map(chapter => {
    if (Number.isInteger(chapter.locationIndex) && chapter.locationIndex > index) chapter.locationIndex--;
    return chapter;
  });
  lid = trip.locations.length ? Math.min(index, trip.locations.length - 1) : 0;
  mid = 0;
  persist();
  renderJourney();
  notify('Place and its memories deleted.');
}

function settings() {
  openModal('settings');
  const colors = ['#facc15', '#abff46', '#ffff23', '#fe05bb', '#11ffff'];
  const colorButtons = colors.map(c => `<button class="color-swatch ${cursorColor === c ? 'selected' : ''}" data-color="${c}" style="--swatch:${c}" aria-label="Cursor color ${c}"></button>`).join('');
  $('#modalContent').innerHTML = `<div class="eyebrow">YOUR EXPERIENCE</div><h2>Settings</h2><p>Make this little corner feel like yours.</p><div class="setting-row"><span>Cursor color</span><div class="color-choices">${colorButtons}<input id="colorPicker" type="color" value="${cursorColor}" aria-label="Custom cursor color"></div></div><div class="setting-row"><span>Cursor shape</span><div class="shape-choices"><button data-shape="circle" class="shape-option circle-shape" aria-label="Circle"></button><button data-shape="ring" class="shape-option ring-shape" aria-label="Ring"></button><button data-shape="square" class="shape-option square-shape" aria-label="Square"></button><button data-shape="diamond" class="shape-option diamond-shape" aria-label="Diamond"></button></div></div><div class="setting-row"><span>Reduce motion</span><input id="reduceMotion" type="checkbox"></div><div class="setting-row"><span>Journey visibility</span><span class="eyebrow">PRIVATE BY DEFAULT</span></div><div class="modal-note">Photos and memories stay on this device. The map loads OpenStreetMap tiles around the current journey; place searches are sent to Nominatim.</div><button class="dark-button settings-done" id="settingsDone">DONE</button>`;
  $$('[data-color]').forEach(b => b.onclick = () => setCursorColor(b.dataset.color)); $('#colorPicker').oninput = e => setCursorColor(e.target.value);
  $$('[data-shape]').forEach(b => { b.classList.toggle('selected', b.dataset.shape === cursorShape); b.onclick = () => setCursorShape(b.dataset.shape); });
  $('#reduceMotion').checked = localStorage.getItem('terra-reduceMotion') === 'true'; $('#reduceMotion').onchange = e => { document.documentElement.classList.toggle('reduced-motion', e.target.checked); localStorage.setItem('terra-reduceMotion', e.target.checked); };
  $('#settingsDone').onclick = closeModal;
}
function setCursorColor(value) { cursorColor = value; $('#cursor').style.background = value; localStorage.setItem('terra-cursorColor', value); $$('.color-swatch').forEach(b => b.classList.toggle('selected', b.dataset.color === value)); }
function setCursorShape(value) { cursorShape = value; $('#cursor').className = `cursor-dot ${value === 'circle' ? '' : value}`; localStorage.setItem('terra-cursorShape', value); $$('[data-shape]').forEach(b => b.classList.toggle('selected', b.dataset.shape === value)); }

$('#enter').onclick = () => goAuth('login'); $$('[data-route]').forEach(btn => btn.onclick = () => goAuth(btn.dataset.route === 'signup' ? 'signup' : 'login'));
const homeBrand = $('#app .app-brand');
homeBrand.setAttribute('role', 'button'); homeBrand.setAttribute('tabindex', '0'); homeBrand.setAttribute('aria-label', 'Return to the Terra Diary landing page'); homeBrand.title = 'Back to landing page';
const returnToLanding = () => { $('#app').style.display = 'none'; backLanding(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
homeBrand.onclick = returnToLanding;
homeBrand.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); returnToLanding(); } };
$('#authBack').onclick = backLanding; $('#newJourney').onclick = () => openModal('journey'); $('#folderAction').onclick = () => openModal('folder');
let authReturnBusy = false;
const returnFromAuthOnUp = () => { if (authReturnBusy || $('#auth').classList.contains('hidden') || $('#auth').scrollTop > 0) return; authReturnBusy = true; backLanding(); window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => authReturnBusy = false, 700); };
$('#auth').addEventListener('wheel', event => { if (event.deltaY < -22) returnFromAuthOnUp(); }, { passive: true });
let authTouchStartY = 0;
$('#auth').addEventListener('touchstart', event => { authTouchStartY = event.touches[0]?.clientY || 0; }, { passive: true });
$('#auth').addEventListener('touchend', event => { const endY = event.changedTouches[0]?.clientY || authTouchStartY; if (endY - authTouchStartY > 45) returnFromAuthOnUp(); }, { passive: true });
$('#addLocation').onclick = () => openModal('location'); $('#addChapter').onclick = () => openModal('chapter'); $('#editJourney').onclick = () => openModal('editJourney'); $('#editMemory').onclick = () => openModal('memory'); $('#addAnotherMemory').onclick = () => openModal('memory', true);
$('#deleteMemory').onclick = deleteCurrentMemory; $('#avatar').onclick = () => openModal('account'); $('#settingsBtn').onclick = settings;
$$('[data-screen]').forEach(btn => btn.onclick = () => showScreen(btn.dataset.screen)); $('#closeModal').onclick = closeModal; backdrop.onclick = e => { if (e.target === backdrop) closeModal(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (journalFullscreen) { setJournalFullscreen(false); return; } closeModal(); if (!$('#auth').classList.contains('hidden')) backLanding(); } });
let scrollBusy = false; $('#landing').addEventListener('wheel', e => { if (e.deltaY > 22 && !scrollBusy) { scrollBusy = true; goAuth('login'); setTimeout(() => scrollBusy = false, 1000); } }, { passive: true });
let touchStart = 0; $('#landing').addEventListener('touchstart', e => touchStart = e.touches[0].clientY, { passive: true }); $('#landing').addEventListener('touchend', e => { if (touchStart - e.changedTouches[0].clientY > 45) goAuth('login'); }, { passive: true });
document.addEventListener('mousemove', e => { $('#cursor').style.left = e.clientX + 'px'; $('#cursor').style.top = e.clientY + 'px'; });
$('#cursor').style.background = cursorColor; $('#cursor').className = `cursor-dot ${cursorShape === 'circle' ? '' : cursorShape}`; document.body.classList.add('custom-cursor');
document.documentElement.classList.toggle('reduced-motion', localStorage.getItem('terra-reduceMotion') === 'true');
if (localStorage.getItem('terra-user')) user = read('user', user);
