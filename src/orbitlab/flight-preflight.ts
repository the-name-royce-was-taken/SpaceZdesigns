/**
 * Preflight compiler: validates a SpaceZ assembly and compiles it into the
 * per-build Orbitlab aerodynamic model plus the live flight solver manifest.
 * This runs before the flight scene is created, so invalid builds never enter
 * a partially initialized simulation.
 */
import { buildOrbitlabAeroModel } from "./vehicle-adapter";
import { engineVariants, partCatalog, type BuildPart } from "../vehicle-builder-3d";
import { tankFuelCapacity } from "../vehicle-assembly";
import { listActivationGroups, partActivationGroup } from "../activation";
import { landingImpactCapacityForPart, type LandingSupportPart, type VehiclePhysics, type FlightEngine, type Vector3 } from "../flight-physics";

const G0 = 9.80665;
const surfaceKinds = new Set(["fin", "wing", "control", "strake"]);

export interface FlightPreflight {
  vehicle: VehiclePhysics;
  dryMassTonnes: number;
  propellantTonnes: number;
  wetMassTonnes: number;
  centerOfMassM: Vector3;
  inertiaRadiusSquared: number;
  referenceAreaM2: number;
  surfaceAreaM2: number;
  engineCount: number;
  stageNumbers: number[];
}

function finitePart(part: BuildPart): boolean {
  return [part.x ?? 0, part.y ?? 0, part.z ?? 0, part.radius ?? 0,
    part.height ?? 0, part.topRadius ?? 0, part.bottomRadius ?? 0]
    .every(Number.isFinite);
}

function dimensions(part: BuildPart) {
  const spec = partCatalog.find(item => item.kind === part.kind);
  if (!spec) throw new Error("Unsupported part type: " + part.kind);
  const height = part.kind === "tank" ? (part.height ?? spec.size.y)
    : part.kind === "structural-beam" ? Math.max(1, Math.min(12, Math.round(part.structuralLength ?? 3))) * .4
    : spec.size.y;
  const radius = Math.max(spec.size.x, spec.size.z, (part.radius ?? 0) * 2,
    (part.topRadius ?? 0) * 2, (part.bottomRadius ?? 0) * 2) / 2;
  return { height: Math.max(.05, height), radius: Math.max(.025, radius) };
}

function partStage(part: BuildPart): number {
  return Math.max(1, Math.floor(part.engineStage ?? partActivationGroup(part) ?? 1));
}

/**
 * Computes a first-order mass distribution using catalog dry masses, tank
 * propellant at each tank's centre, and cylindrical component inertias.
 * Inertia is stored as radius-of-gyration squared because FlightSimulator
 * multiplies this value by current vehicle mass on each integration step.
 */
function massProperties(parts: readonly BuildPart[]) {
  const bodies = parts.map(part => {
    const spec = partCatalog.find(item => item.kind === part.kind);
    if (!spec) throw new Error("Unsupported part type: " + part.kind);
    const d = dimensions(part);
    const dryKg = spec.mass * 1000;
    const fuelKg = part.kind === "tank" ? tankFuelCapacity(part) : 0;
    const massKg = dryKg + fuelKg;
    const x = part.x ?? 0, y = part.y ?? 0, z = part.z ?? 0;
    const transverse = massKg * (3 * d.radius * d.radius + d.height * d.height) / 12;
      return { massKg, x, y, z, transverse };
  });
  const totalKg = bodies.reduce((sum, body) => sum + body.massKg, 0);
  if (!(totalKg > 0) || !Number.isFinite(totalKg)) throw new Error("Vehicle mass must be greater than zero.");
  const centerOfMassM = {
    x: bodies.reduce((sum, body) => sum + body.massKg * body.x, 0) / totalKg,
    y: bodies.reduce((sum, body) => sum + body.massKg * body.y, 0) / totalKg,
    z: bodies.reduce((sum, body) => sum + body.massKg * body.z, 0) / totalKg
  };
  const ixx = bodies.reduce((sum, b) => sum + b.transverse + b.massKg * ((b.y-centerOfMassM.y)**2 + (b.z-centerOfMassM.z)**2), 0);
  const izz = bodies.reduce((sum, b) => sum + b.transverse + b.massKg * ((b.x-centerOfMassM.x)**2 + (b.y-centerOfMassM.y)**2), 0);
  const inertiaRadiusSquared = Math.max(.01, (ixx + izz) / (2 * totalKg));
  return { dryMassTonnes: bodies.reduce((sum, b, i) => sum + (b.massKg - (parts[i]!.kind === "tank" ? tankFuelCapacity(parts[i]!) : 0)) / 1000, 0),
    propellantTonnes: bodies.reduce((sum, b, i) => sum + (parts[i]!.kind === "tank" ? b.massKg - partCatalog.find(p => p.kind === parts[i]!.kind)!.mass * 1000 : 0), 0) / 1000,
    centerOfMassM, inertiaRadiusSquared };
}

export function prepareSpaceZFlight(parts: readonly BuildPart[], craftName: string, epochSeconds = Date.now() / 1000 - 946728000): FlightPreflight {
  if (!parts.length) throw new Error("The vehicle is empty.");
  if (parts.some(part => !finitePart(part))) throw new Error("A part has invalid or non-finite dimensions or placement.");
  if (!parts.some(part => part.kind === "capsule" || part.kind === "remote-control"))
    throw new Error("Add a command pod or remote-control module before flight.");
  const engines = parts.filter(part => part.kind === "engine");
  if (!engines.length) throw new Error("Add at least one engine before flight.");
  for (const part of parts) {
    if (!partCatalog.some(item => item.kind === part.kind))
      throw new Error("Unsupported part type: " + part.kind);
    if (part.kind === "tank" && !(tankFuelCapacity(part) >= 0))
      throw new Error("A fuel tank has an invalid capacity.");
  }

  const aero = buildOrbitlabAeroModel(parts, craftName);
  const mass = massProperties(parts);
  const contactCandidates = parts.map(part => {
    const d = dimensions(part);
    const y = part.y ?? 0;
    const lowestY = part.kind === "landing-leg" || part.kind === "wheel"
      ? y - (part.retracted ? .22 : .92)
      : y + (part.kind === "capsule" ? .1525 : part.kind === "engine" ? -.1 : 0) - d.height / 2;
    return { part, lowestY };
  }).sort((a, b) => a.lowestY - b.lowestY);
  const minY = contactCandidates[0]!.lowestY;
  const supportingParts = contactCandidates.filter(candidate => candidate.lowestY <= minY + .08);
  const landingContactKind = supportingParts[0]!.part.kind;
  const landingGearCount = supportingParts.filter(candidate => candidate.part.kind === "landing-leg" || candidate.part.kind === "wheel" || candidate.part.kind === "rover-wheel").length;
  const landingImpactCapacityJ = supportingParts.reduce((sum, candidate) => sum + landingImpactCapacityForPart(candidate.part.kind), 0);
  const landingSupportParts: LandingSupportPart[] = parts.map(part => {
    const d = dimensions(part), x = part.x ?? 0, y = part.y ?? 0, z = part.z ?? 0;
    const radius = part.kind === "landing-leg" ? .72 : part.kind === "wheel" ? .32 : part.kind === "rover-wheel" ? (part.radius ?? .24) + .12 : d.radius;
    const bottom = part.kind === "landing-leg" ? (part.retracted ? -.22 : -.92)
      : part.kind === "rover-wheel" ? -.12 - (part.radius ?? .24)
      : part.kind === "heat-shield" ? -(part.thickness ?? .16)
      : part.kind === "engine" ? -.72
      : -d.height / 2;
    return { kind: part.kind, min: { x: x-radius, y: y+bottom, z: z-radius }, max: { x: x+radius, y: y+d.height/2, z: z+radius } };
  });
  const spawnClearanceM = Math.max(.08, -minY + .08);
  const engineManifest: FlightEngine[] = engines.map(part => {
    const variant = engineVariants.find(item => item.id === (part.engineType ?? "liquid")) ?? engineVariants[0]!;
    return { stage: partStage(part), thrustKN: variant.thrustKN, ispSeconds: variant.ispSeconds };
  });
  const stageNumbers = [...new Set(engineManifest.map(engine => engine.stage))].sort((a,b) => a-b);
  const totalThrust = engineManifest.reduce((sum, engine) => sum + engine.thrustKN, 0);
  const engineMountM = engines.reduce((sum, part) => {
    const variant = engineVariants.find(item => item.id === (part.engineType ?? "liquid")) ?? engineVariants[0]!;
    const thrust = variant.thrustKN;
    return { x: sum.x + (part.x ?? 0) * thrust, y: sum.y + (part.y ?? 0) * thrust, z: sum.z + (part.z ?? 0) * thrust };
  }, { x: 0, y: 0, z: 0 });
  engineMountM.x /= Math.max(totalThrust, 1e-9); engineMountM.y /= Math.max(totalThrust, 1e-9); engineMountM.z /= Math.max(totalThrust, 1e-9);
  const totalFlow = engineManifest.reduce((sum, engine) => sum + engine.thrustKN * 1000 / (engine.ispSeconds * G0), 0);
  const ispSeconds = totalFlow > 0 ? totalThrust * 1000 / (totalFlow * G0) : 285;
  const rcs = parts.filter(part => part.kind === "rcs");
  const wheels = parts.filter(part => part.kind === "reaction-wheel");
  const surfaces = parts.filter(part => surfaceKinds.has(part.kind));
  const rcsFuelTonnes = rcs.length * .012;
  const vehicle: VehiclePhysics = {
    epochSeconds, spawnClearanceM, launchRailLengthM: 20,
    landingContactKind, landingGearCount, landingImpactCapacityJ, landingSupportParts,
    dryMassTonnes: mass.dryMassTonnes,
    fuelTonnes: mass.propellantTonnes,
    thrustKN: totalThrust, ispSeconds,
    referenceArea: aero.referenceArea, aeroTable: aero.table,
    dragCoefficient: aero.dragCoefficient, liftSlope: aero.liftSlope,
    inertia: mass.inertiaRadiusSquared,
    centerOfMassM: mass.centerOfMassM, engineMountM, aeroDatumY: minY,
    reactionWheelTorque: wheels.length * 3.8,
    rcsTorque: rcs.length * 1.5, rcsThrustKN: rcs.length * .35,
    rcsFuelTonnes,
    controlSurfaceAuthority: surfaces.reduce((sum, part) => sum + (part.kind === "control" ? 1 : part.kind === "wing" ? .45 : part.kind === "strake" ? .2 : .3), 0),
    rcsStages: rcs.map(partStage),
    reactionWheelStages: wheels.map(partStage),
    controlSurfaceStages: surfaces.map(partStage),
    engines: engineManifest,
    activationGroups: [...new Set([...listActivationGroups(parts), ...engineManifest.map(engine => engine.stage)])].sort((a,b) => a-b)
  };
  const wetMassTonnes = vehicle.dryMassTonnes + vehicle.fuelTonnes + rcsFuelTonnes;
  if (![wetMassTonnes, vehicle.thrustKN, vehicle.ispSeconds, vehicle.referenceArea, vehicle.inertia].every(Number.isFinite)
    || wetMassTonnes <= 0 || vehicle.referenceArea <= 0 || vehicle.ispSeconds <= 0)
    throw new Error("The compiled vehicle has invalid mass, propulsion, or aerodynamic properties.");
  return { vehicle, dryMassTonnes: vehicle.dryMassTonnes, propellantTonnes: vehicle.fuelTonnes,
    wetMassTonnes, centerOfMassM: mass.centerOfMassM, inertiaRadiusSquared: mass.inertiaRadiusSquared,
    referenceAreaM2: aero.referenceArea, surfaceAreaM2: aero.surfaceArea, engineCount: engines.length, stageNumbers };
}
