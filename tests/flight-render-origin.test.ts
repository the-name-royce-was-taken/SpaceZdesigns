import { describe, expect, it } from "vitest";
import { flightRenderOriginOffset, flightRenderPosition } from "../src/flight-render-origin";

describe("launch-relative flight rendering",()=>{
  const earthCentre={x:6.371,y:0,z:0};
  it("keeps the rocket near the render origin instead of Earth-radius coordinates",()=>{
    const local=flightRenderPosition({x:6.371001,y:0.000002,z:-0.000003},earthCentre);
    expect(local.x).toBeCloseTo(0.000001,12);
    expect(local.y).toBe(0.000002);
    expect(local.z).toBe(-0.000003);
  });
  it("moves the Earth-centred visual frame by the inverse origin offset",()=>{
    expect(flightRenderOriginOffset(earthCentre)).toEqual({x:-6.371,y:0,z:0});
  });
  it("preserves small frame-to-frame rocket displacement after rebasing",()=>{
    const first=flightRenderPosition({x:6.371001,y:0,z:0},earthCentre);
    const next=flightRenderPosition({x:6.37100101,y:0,z:0},earthCentre);
    expect(next.x-first.x).toBeCloseTo(1e-8,15);
    expect(Math.fround(next.x)-Math.fround(first.x)).toBeCloseTo(1e-8,9);
  });
});
