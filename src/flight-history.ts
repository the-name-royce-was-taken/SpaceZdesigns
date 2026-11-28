export function removeCrashedFlightSaves(missions: readonly unknown[], activeFlightId: string | null): unknown[] {
  return missions.filter((entry) => {
    if (!entry || typeof entry !== "object") return true;
    const mission = entry as {
      kind?: unknown;
      id?: unknown;
      status?: unknown;
      state?: { crashed?: unknown } | null;
    };
    if (
      mission.kind === "spacez-flight-record" &&
      typeof mission.id === "string" &&
      mission.id === activeFlightId
    ) return false;
    if (
      (mission.kind === "spacez-flight-record" || mission.kind === "spacez-flight-save") &&
      (mission.state?.crashed === true || mission.status === "crashed" || mission.status === "lost")
    ) return false;
    return true;
  });
}
