/** Flight-scene units are one million metres; keep the chase camera at human-scale distances. */
export const FLIGHT_METRES_PER_SCENE_UNIT = 1_000_000;
export const FLIGHT_CAMERA_MIN_DISTANCE_METRES = 3;
export const FLIGHT_CAMERA_INITIAL_DISTANCE_METRES = 12;
export const FLIGHT_CAMERA_MAX_DISTANCE_METRES = 80;

export function flightCameraDistance(distanceMetres: number): number {
  const safeDistance = Number.isFinite(distanceMetres)
    ? Math.max(FLIGHT_CAMERA_MIN_DISTANCE_METRES, Math.min(FLIGHT_CAMERA_MAX_DISTANCE_METRES, distanceMetres))
    : FLIGHT_CAMERA_INITIAL_DISTANCE_METRES;
  return safeDistance / FLIGHT_METRES_PER_SCENE_UNIT;
}
