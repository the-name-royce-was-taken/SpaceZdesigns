/** Flight-scene units are one million metres; keep the chase camera at human-scale distances. */
export const FLIGHT_METRES_PER_SCENE_UNIT = 1_000_000;
export const FLIGHT_CAMERA_MIN_DISTANCE_METRES = 3;
export const FLIGHT_CAMERA_INITIAL_DISTANCE_METRES = 12;
export const FLIGHT_CAMERA_MAX_DISTANCE_METRES = 80;
/** A lower response makes camera translation less reactive to per-frame vehicle motion. */
export const FLIGHT_CAMERA_FOLLOW_RESPONSE = 6;

export function flightCameraDistance(distanceMetres: number): number {
  const safeDistance = Number.isFinite(distanceMetres)
    ? Math.max(FLIGHT_CAMERA_MIN_DISTANCE_METRES, Math.min(FLIGHT_CAMERA_MAX_DISTANCE_METRES, distanceMetres))
    : FLIGHT_CAMERA_INITIAL_DISTANCE_METRES;
  return safeDistance / FLIGHT_METRES_PER_SCENE_UNIT;
}

/** Frame-rate-independent follow damping; zero elapsed time never moves the camera. */
export function flightCameraFollowAlpha(deltaSeconds: number): number {
  const safeDelta = Number.isFinite(deltaSeconds)
    ? Math.max(0, Math.min(0.1, deltaSeconds))
    : 0;
  return 1 - Math.exp(-FLIGHT_CAMERA_FOLLOW_RESPONSE * safeDelta);
}
