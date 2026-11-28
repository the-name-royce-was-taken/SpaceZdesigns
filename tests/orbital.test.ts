import {describe,expect,it} from "vitest";import{formatDuration,predictOrbit}from"../src/orbital";
const mu=3.986004418e14,r=6_371_000;
describe("osculating orbit prediction",()=>{
 it("predicts a circular low Earth orbit",()=>{const speed=Math.sqrt(mu/(r+200_000)),p=predictOrbit({altitude:200_000,vx:speed,vy:0});expect(p.valid).toBe(true);expect(p.escaped).toBe(false);expect(p.periapsisAltitude).toBeCloseTo(200,0);expect(p.apoapsisAltitude).toBeCloseTo(200,0);expect(p.periodSeconds).toBeGreaterThan(5000);});
 it("identifies escape trajectories",()=>{const speed=Math.sqrt(2*mu/(r+200_000))*1.1;expect(predictOrbit({altitude:200_000,vx:speed,vy:0}).escaped).toBe(true);});
 it("does not invent an orbit for a stationary craft",()=>{expect(predictOrbit({altitude:0,vx:0,vy:0}).valid).toBe(false);});
 it("formats orbital periods",()=>{expect(formatDuration(3600)).toBe("1.0 hr");expect(formatDuration(86400)).toBe("1.0 days");});
});
