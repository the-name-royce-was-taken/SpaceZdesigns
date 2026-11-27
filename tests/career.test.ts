import { describe, expect, it } from "vitest";
import { getNewCareerAchievements } from "../src/career";

describe("career achievement progression", () => {
  it("awards the launch and altitude milestones once", () => {
    const launch = getNewCareerAchievements({ altitude: 0, vx: 0, vy: 0, maxQ: 0 }, [], "launch");
    expect(launch.map(item => item.id)).toEqual(["first-launch"]);
    const ascent = getNewCareerAchievements({ altitude: 120_000, vx: 0, vy: 900, maxQ: 31_000 }, ["first-launch"]);
    expect(ascent.map(item => item.id)).toEqual([
      "altitude-1km", "altitude-10km", "altitude-50km", "space-100km", "max-q"
    ]);
    expect(getNewCareerAchievements({ altitude: 120_000, vx: 0, vy: 900, maxQ: 31_000 }, ["first-launch", ...ascent.map(item => item.id)])).toEqual([]);
  });

  it("recognizes orbital insertion and escape velocity", () => {
    const earned = getNewCareerAchievements({ altitude: 120_000, vx: 7_600, vy: 100, maxQ: 0 }, []);
    expect(earned.map(item => item.id)).toContain("orbit");
    const escape = getNewCareerAchievements({ altitude: 150_000, vx: 11_300, vy: 0, maxQ: 0 }, []);
    expect(escape.map(item => item.id)).toContain("escape-velocity");
  });

  it("recognizes reentry and a safe return after spaceflight", () => {
    const reentry = getNewCareerAchievements({ altitude: 70_000, vx: 400, vy: -200, maxQ: 0 }, ["altitude-1km", "altitude-10km", "altitude-50km", "space-100km"]);
    expect(reentry.map(item => item.id)).toEqual(["reentry"]);
    const landing = getNewCareerAchievements({ altitude: 0, vx: 0, vy: 0, maxQ: 0 }, ["space-100km", "reentry"], "landing");
    expect(landing.map(item => item.id)).toEqual(["first-landing", "space-landing"]);
  });

  it("rewards first stage activation", () => {
    expect(getNewCareerAchievements({ altitude: 1_000, vx: 0, vy: 0, maxQ: 0 }, [], "stage").map(item => item.id)).toContain("first-stage");
  });
});
