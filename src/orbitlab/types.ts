/**
 * Minimal structural subset of Orbitlab's vehicle types used by its aerodynamic
 * table generator. Kept local to avoid pulling the full simulator UI/type graph.
 * Copyright 2026 Royin (ROYIN001). Apache-2.0; adapted by SpaceZdesigns.
 */
export interface EngineSpec {
  name: string; count: number; thrustSL: number; thrustVac: number;
  ispSL: number; ispVac: number; solid?: boolean;
}
export interface BoosterGroupSpec {
  id: string; name: string; count: number; dryMass: number; propellantMass: number;
  engine: EngineSpec; diameter: number; length: number; baseOffset?: number; conicalTop?: boolean;
}
export interface StageSpec {
  id: string; name: string; dryMass: number; propellantMass: number; engine: EngineSpec;
  diameter: number; length: number; isSpacecraft?: boolean; boosters?: BoosterGroupSpec[];
}
export interface FairingSpec { mass: number; diameter: number; length: number; sepAltitude: number; adapter?: number; }
export interface VehicleSpec {
  id: string; name: string; country: string; manufacturer: string; height: number;
  payloadLEO: number; payloadGTO: number; fairing: FairingSpec | null;
  stages: StageSpec[]; sites: string[]; maxQ: number; maxAccel: number;
  exposedPayload?: { diameter: number; length: number; noseLength: number };
}
