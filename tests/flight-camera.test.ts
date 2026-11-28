import {describe,expect,it} from "vitest";
import {
  FLIGHT_CAMERA_FOLLOW_RESPONSE,
  FLIGHT_CAMERA_INITIAL_DISTANCE_METRES,
  FLIGHT_CAMERA_MAX_DISTANCE_METRES,
  FLIGHT_CAMERA_MIN_DISTANCE_METRES,
  FLIGHT_METRES_PER_SCENE_UNIT,
  flightCameraDistance,
  flightCameraFollowAlpha,
} from "../src/flight-camera";

describe("3D flight chase-camera scale",()=>{
  it("converts a close 12-metre chase distance into flight-scene units",()=>{
    expect(flightCameraDistance(FLIGHT_CAMERA_INITIAL_DISTANCE_METRES)*FLIGHT_METRES_PER_SCENE_UNIT).toBe(12);
  });
  it("clamps zoom to practical metre-scale distances",()=>{
    expect(flightCameraDistance(0)*FLIGHT_METRES_PER_SCENE_UNIT).toBe(FLIGHT_CAMERA_MIN_DISTANCE_METRES);
    expect(flightCameraDistance(1_000)*FLIGHT_METRES_PER_SCENE_UNIT).toBe(FLIGHT_CAMERA_MAX_DISTANCE_METRES);
  });
  it("uses a safe default for non-finite distances",()=>{
    expect(flightCameraDistance(Number.NaN)*FLIGHT_METRES_PER_SCENE_UNIT).toBe(FLIGHT_CAMERA_INITIAL_DISTANCE_METRES);
  });
});

describe("stabilized flight-camera follow",()=>{
  it("does not move when no frame time has elapsed",()=>{
    expect(flightCameraFollowAlpha(0)).toBe(0);
  });
  it("smooths target movement with a bounded, frame-rate-independent response",()=>{
    const at30fps=flightCameraFollowAlpha(1/30);
    const at60fps=flightCameraFollowAlpha(1/60);
    expect(at30fps).toBeGreaterThan(at60fps);
    expect(at60fps).toBeGreaterThan(0);
    expect(at30fps).toBeLessThan(1);
    expect(flightCameraFollowAlpha(1)).toBe(1-Math.exp(-FLIGHT_CAMERA_FOLLOW_RESPONSE*.1));
  });
  it("ignores invalid or negative frame durations",()=>{
    expect(flightCameraFollowAlpha(Number.NaN)).toBe(0);
    expect(flightCameraFollowAlpha(-1)).toBe(0);
  });
});
