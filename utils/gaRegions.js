// Region detection based on distance from Tifton, GA using Google Geocoding API
// South GA = within 100 miles of Tifton, GA (31.4505, -83.5085)

const TIFTON_LAT = 31.4505;
const TIFTON_LNG = -83.5085;
const SOUTH_GA_RADIUS_MILES = 100;

// Haversine formula to calculate distance between two lat/lng points in miles
const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => deg * (Math.PI / 180);
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Geocode a city+state using Google Maps Geocoding API and determine region
const getRegionFromCity = async (city, state) => {
  if (!city || !state) return 'north';

  const apiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_GEOCODING_API_KEY not set — defaulting to north');
    return 'north';
  }

  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn(`Geocoding failed for "${city}, ${state}": ${data.status}`);
      return 'north';
    }

    const { lat, lng } = data.results[0].geometry.location;
    const distance = haversineDistance(TIFTON_LAT, TIFTON_LNG, lat, lng);

    console.log(`[Region] ${city}, ${state} → lat:${lat.toFixed(4)} lng:${lng.toFixed(4)} → ${distance.toFixed(1)} mi from Tifton → ${distance <= SOUTH_GA_RADIUS_MILES ? 'SOUTH' : 'NORTH'}`);

    return distance <= SOUTH_GA_RADIUS_MILES ? 'south' : 'north';
  } catch (err) {
    console.error('Geocoding error:', err.message);
    return 'north';
  }
};

module.exports = { getRegionFromCity, haversineDistance, TIFTON_LAT, TIFTON_LNG, SOUTH_GA_RADIUS_MILES };
