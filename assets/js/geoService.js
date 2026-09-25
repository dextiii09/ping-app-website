// Ping Web Platform - Location Detection Service
// Uses the browser's Geolocation API + OpenStreetMap Nominatim (free, no API
// key required) to turn a GPS fix into a human-readable "City, State" label.
// Detection is always optional - every location field also accepts manual
// text entry, since permission can be denied or just not granted.
export function detectLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location detection is not supported by this browser. Please type your location instead.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );
          if (!res.ok) throw new Error('Reverse geocoding request failed.');
          const data = await res.json();
          const addr = data.address || {};
          const city = addr.city || addr.town || addr.village || addr.suburb || addr.county || '';
          const state = addr.state || '';
          const label = [city, state].filter(Boolean).join(', ') || data.display_name || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
          resolve({ label, latitude, longitude });
        } catch (err) {
          reject(new Error('Could not resolve your location to a place name. Please type it manually.'));
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new Error('Location permission denied. Please enter your location manually.'));
        } else {
          reject(new Error('Could not detect your location. Please enter it manually.'));
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  });
}
