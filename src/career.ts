import type { FlightState } from "./flight-physics";

export interface CareerAchievement {
  id: string;
  name: string;
  description: string;
  reward: number;
}

export const CAREER_STARTING_CREDITS = 750_000;

export const CAREER_ACHIEVEMENTS: CareerAchievement[] = [
  { id: "first-launch", name: "First Flight", description: "Launch your first rocket.", reward: 5_000 },
  { id: "altitude-1km", name: "Off the Ground", description: "Reach 1 km above the launch site.", reward: 2_500 },
  { id: "altitude-10km", name: "Stratospheric", description: "Reach 10 km altitude.", reward: 5_000 },
  { id: "altitude-50km", name: "Edge of Space", description: "Reach 50 km altitude.", reward: 10_000 },
  { id: "space-100km", name: "Crossing the Kármán Line", description: "Reach 100 km altitude.", reward: 25_000 },
  { id: "altitude-250km", name: "High Orbit", description: "Reach 250 km altitude.", reward: 35_000 },
  { id: "altitude-500km", name: "Very High", description: "Reach 500 km altitude.", reward: 50_000 },
  { id: "altitude-1000km", name: "Beyond the Horizon", description: "Reach 1,000 km altitude.", reward: 75_000 },
  { id: "deep-space", name: "Deep Space", description: "Travel 10,000 km above the surface.", reward: 100_000 },
  { id: "speed-1kms", name: "Supersonic", description: "Reach 1,000 m/s.", reward: 10_000 },
  { id: "speed-3kms", name: "Hypersonic", description: "Reach 3,000 m/s.", reward: 25_000 },
  { id: "max-q", name: "Maximum Pressure", description: "Survive the peak aerodynamic pressure region.", reward: 10_000 },
  { id: "first-stage", name: "Staging", description: "Activate a later flight group for the first time.", reward: 2_500 },
  { id: "orbit", name: "Orbital Insertion", description: "Reach 100 km altitude with at least 7,500 m/s horizontal speed.", reward: 125_000 },
  { id: "escape-velocity", name: "Breaking Free", description: "Exceed Earth's escape velocity above the atmosphere.", reward: 200_000 },
  { id: "reentry", name: "Coming Home", description: "Return below 80 km after reaching space.", reward: 20_000 },
  { id: "first-landing", name: "Touchdown", description: "Complete a controlled landing after launch.", reward: 10_000 },
  { id: "space-landing", name: "From Space, Safely", description: "Reach space and return for a controlled landing.", reward: 50_000 }
];

export type CareerEvent = "launch" | "stage" | "landing";

export function getNewCareerAchievements(
  state: Pick<FlightState, "altitude" | "vx" | "vy" | "maxQ">,
  unlocked: readonly string[],
  event?: CareerEvent
): CareerAchievement[] {
  const has = (id: string) => unlocked.includes(id);
  const speed = Math.hypot(state.vx, state.vy);
  const reachedSpace = has("space-100km") || state.altitude >= 100_000;
  const candidates = new Set<string>();
  if (event === "launch") candidates.add("first-launch");
  if (event === "stage") candidates.add("first-stage");
  if (state.altitude >= 1_000) candidates.add("altitude-1km");
  if (state.altitude >= 10_000) candidates.add("altitude-10km");
  if (state.altitude >= 50_000) candidates.add("altitude-50km");
  if (state.altitude >= 100_000) candidates.add("space-100km");
  if (state.altitude >= 250_000) candidates.add("altitude-250km");
  if (state.altitude >= 500_000) candidates.add("altitude-500km");
  if (state.altitude >= 1_000_000) candidates.add("altitude-1000km");
  if (state.altitude >= 10_000_000) candidates.add("deep-space");
  if (speed >= 1_000) candidates.add("speed-1kms");
  if (speed >= 3_000) candidates.add("speed-3kms");
  if (state.maxQ >= 30_000) candidates.add("max-q");
  if (state.altitude >= 100_000 && Math.abs(state.vx) >= 7_500) candidates.add("orbit");
  if (state.altitude >= 100_000 && speed >= 11_200) candidates.add("escape-velocity");
  if (reachedSpace && state.altitude <= 80_000 && state.vy < 0) candidates.add("reentry");
  if (event === "landing") {
    candidates.add("first-landing");
    if (has("space-100km")) candidates.add("space-landing");
  }
  return CAREER_ACHIEVEMENTS.filter(item => candidates.has(item.id) && !has(item.id));
}
