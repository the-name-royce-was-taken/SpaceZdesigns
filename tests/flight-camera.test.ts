import {describe,expect,it} from "vitest";
import {
  FLIGHT_CAMERA_INITIAL_DISTANCE_METRES,
  FLIGHT_CAMERA_MAX_DISTANCE_METRES,
  FLIGHT_CAMERA_MIN_DISTANCE_METRES,
  FLIGHT_METRES_PER_SCENE_UNIT,
  flightCameraDistance,
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
