export const TRACKING_METRES_PER_UNIT = 1e9;
export const EARTH_SURFACE_CAMERA_ALTITUDE_METRES = 10_000;

/** Camera distance in tracking-scene units for a low-altitude Earth surface view. */
export function earthSurfaceCameraDistance(): number {
  return EARTH_SURFACE_CAMERA_ALTITUDE_METRES / TRACKING_METRES_PER_UNIT;
}

/** Keep the selected vehicle large enough to inspect while retaining its true physical scale. */
export function rocketTrackingCameraDistance(boundsRadiusSceneUnits: number): number {
  const safeRadius = Number.isFinite(boundsRadiusSceneUnits) ? Math.max(0, boundsRadiusSceneUnits) : 0;
  return Math.max(3 / TRACKING_METRES_PER_UNIT, safeRadius * 3.2);
}

/** Screen-facing selection marker; independent of the physical rocket mesh scale. */
export function rocketTrackingMarkerSize(cameraDistanceSceneUnits: number): number {
  const safeDistance = Number.isFinite(cameraDistanceSceneUnits) ? Math.max(0, cameraDistanceSceneUnits) : 0;
  return Math.max(1e-12, safeDistance * 0.025);
}
