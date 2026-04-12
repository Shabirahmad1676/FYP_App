import * as turf from '@turf/turf';

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';

export interface RouteStep {
  maneuver: {
    instruction: string;
    bearing_after: number;
    type: string;
  };
  distance: number;
  duration: number;
}

export interface RouteInfo {
  geometry: any;
  distance: number;    // meters from start
  duration: number;    // seconds
  steps: RouteStep[];
  destinationCoords: [number, number];
}

/**
 * Fetches a walking route from Mapbox Directions API with step-by-step instructions.
 */
export async function fetchWalkingRoute(
  start: [number, number], // [lng, lat]
  end: [number, number]    // [lng, lat]
): Promise<RouteInfo | null> {
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/walking/` +
    `${start[0]},${start[1]};${end[0]},${end[1]}` +
    `?geometries=geojson&steps=true&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      const steps: RouteStep[] = route.legs[0]?.steps || [];
      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        steps,
        destinationCoords: end,
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to fetch Mapbox route:', error);
    return null;
  }
}

/**
 * Calculates the remaining distance & duration from user's current location
 * to the destination by snapping to the route line.
 */
export function calculateRemainingRoute(
  userCoords: [number, number],       // [lng, lat]
  routeGeometry: any,                  // GeoJSON LineString
  totalDistance: number,               // original total meters
  totalDuration: number                // original total seconds
): { remainingDistance: number; remainingDuration: number } {
  try {
    const routeLine = turf.lineString(routeGeometry.coordinates);
    const userPoint = turf.point(userCoords);
    const snapped = turf.nearestPointOnLine(routeLine, userPoint, { units: 'meters' });
    const traveledDistance = snapped.properties.location || 0;
    const lineLength = turf.length(routeLine, { units: 'meters' });
    const remainingDistance = Math.max(0, lineLength - traveledDistance);
    const ratio = remainingDistance / (lineLength || 1);
    return {
      remainingDistance,
      remainingDuration: totalDuration * ratio,
    };
  } catch {
    return { remainingDistance: totalDistance, remainingDuration: totalDuration };
  }
}

/**
 * Returns true if user has arrived (within 20m of destination).
 */
export function hasArrived(
  userCoords: [number, number],
  destinationCoords: [number, number],
  thresholdMeters = 20
): boolean {
  const dist = turf.distance(
    turf.point(userCoords),
    turf.point(destinationCoords),
    { units: 'meters' }
  );
  return dist <= thresholdMeters;
}

/**
 * Utility to format meters to human readable distance (km/m).
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Utility to format seconds to human readable time (mins/hrs).
 */
export function formatDuration(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  if (mins < 60) {
    return `${mins} min${mins !== 1 ? 's' : ''}`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}
