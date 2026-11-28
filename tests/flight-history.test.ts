import { describe, expect, it } from "vitest";
import { removeCrashedFlightSaves } from "../src/flight-history";

describe("crashed flight save cleanup", () => {
  it("removes legacy and current crashed saves but preserves landed flights", () => {
    const landed = { kind: "spacez-flight-record", id: "landed-1", status: "landed", state: { crashed: false, landed: true } };
    const legacyCrash = { kind: "spacez-flight-save", craftName: "Old Rocket", state: { crashed: true } };
    const currentCrash = { kind: "spacez-flight-record", id: "crash-1", state: { crashed: true } };
    const activeBeforeImpact = { kind: "spacez-flight-record", id: "active-1", state: { crashed: false } };
    const otherFlight = { kind: "spacez-flight-record", id: "other-1", state: { crashed: false, landed: false } };

    expect(removeCrashedFlightSaves([landed, legacyCrash, currentCrash, activeBeforeImpact, otherFlight], "active-1"))
      .toEqual([landed, otherFlight]);
  });

  it("cleans stale crashed saves even when there is no active flight id", () => {
    const survived = { kind: "spacez-flight-record", id: "landed-2", status: "landed", state: { crashed: false, landed: true } };
    const legacyCrash = { kind: "spacez-flight-save", craftName: "Legacy", state: { crashed: true } };
    expect(removeCrashedFlightSaves([legacyCrash, survived], null)).toEqual([survived]);
  });

  it("leaves unrelated mission records untouched", () => {
    const science = { kind: "science-contract", id: "contract-1" };
    expect(removeCrashedFlightSaves([science], null)).toEqual([science]);
  });
});
