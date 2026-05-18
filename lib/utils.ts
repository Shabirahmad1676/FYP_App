/**
 * Calculate distance between two coordinates in kilometers using the Haversine formula.
 */
export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const inferFromCoordinateArray = (value: unknown): { latitude: number | null; longitude: number | null } => {
  if (!Array.isArray(value) || value.length < 2) {
    return { latitude: null, longitude: null };
  }

  const first = toFiniteNumber(value[0]);
  const second = toFiniteNumber(value[1]);
  const third = toFiniteNumber(value[2]);

  if (first !== null && second !== null) {
    if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
      return { latitude: second, longitude: first };
    }

    if (Math.abs(second) > 90 && Math.abs(first) <= 90) {
      return { latitude: first, longitude: second };
    }

    return { latitude: second, longitude: first };
  }

  if (second !== null && third !== null) {
    if (Math.abs(second) <= 90 && Math.abs(third) <= 180) {
      return { latitude: second, longitude: third };
    }

    if (Math.abs(third) <= 90 && Math.abs(second) <= 180) {
      return { latitude: third, longitude: second };
    }
  }

  return { latitude: null, longitude: null };
};

/**
 * Normalize billboard-like coordinate payloads from Supabase RPC/cache responses.
 */
export const normalizeBillboardCoordinates = (item: {
  latitude?: unknown;
  longitude?: unknown;
  lat?: unknown;
  lng?: unknown;
  lon?: unknown;
  coords?: unknown;
  coordinates?: unknown;
}) => {
  const fromCoords = inferFromCoordinateArray(item.coords ?? item.coordinates);

  const fieldLatitude = toFiniteNumber(item.latitude ?? item.lat);
  const fieldLongitude = toFiniteNumber(item.longitude ?? item.lng ?? item.lon);

  // Prefer explicit coordinate arrays because they preserve ordering ([lng, lat])
  // and avoid ambiguous scalar swaps in regions where both values are <= 90.
  let latitude = fromCoords.latitude ?? fieldLatitude;
  let longitude = fromCoords.longitude ?? fieldLongitude;

  if (latitude === null) {
    latitude = fieldLatitude;
  }

  if (longitude === null) {
    longitude = fieldLongitude;
  }

  if (latitude !== null && longitude !== null && Math.abs(latitude) > 90 && Math.abs(longitude) <= 90) {
    return {
      latitude: longitude,
      longitude: latitude,
    };
  }

  return { latitude, longitude };
};

/**
 * Format distance for display.
 */
export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} m away`;
  }
  return `${km.toFixed(1)} km away`;
};
