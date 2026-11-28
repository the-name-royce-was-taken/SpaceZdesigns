import {describe,expect,it} from "vitest";
import {EARTH_SURFACE_CAMERA_ALTITUDE_METRES,earthSurfaceCameraDistance,rocketTrackingCameraDistance,rocketTrackingMarkerSize} from "../src/tracking-camera";

describe("tracking camera scale",()=>{
 it("starts at a low launch-site altitude rather than framing the entire globe",()=>{
  expect(earthSurfaceCameraDistance()*1e9).toBe(EARTH_SURFACE_CAMERA_ALTITUDE_METRES);
  expect(EARTH_SURFACE_CAMERA_ALTITUDE_METRES).toBe(10_000);
  expect(earthSurfaceCameraDistance()).toBeLessThan((6_371_000*1e-9)*.05);
 });
 it("frames a true-scale rocket closely using its measured bounds",()=>{
  const radius=.9e-9;
  expect(rocketTrackingCameraDistance(radius)).toBeCloseTo(radius*3.2);
  expect(rocketTrackingCameraDistance(0)).toBeCloseTo(3e-9);
 });
 it("keeps the rocket selection marker visible at close zoom",()=>{
  expect(rocketTrackingMarkerSize(4e-9)).toBeGreaterThan(1e-10);
  expect(rocketTrackingMarkerSize(0)).toBe(1e-12);
 });
});
