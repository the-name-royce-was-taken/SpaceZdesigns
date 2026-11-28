# Orbitlab integration

SpaceZ vendors the upstream [Orbitlab](https://github.com/ROYIN001/Orbitlab) repository as a pinned Git submodule at `vendor/orbitlab` (Apache License 2.0). The pinned revision is `0bcef9723950bb9e50c748bac3f8868609cb42f2`. The upstream `LICENSE` and `NOTICE.md` are retained under `third_party/orbitlab/`; copied aerodynamic source files retain their copyright attribution and identify local modifications.

## What is wired into SpaceZ now

- The existing SpaceZ 3D builder remains the source of truth for each craft.
- `src/orbitlab/vehicle-adapter.ts` translates that specific build into an Orbitlab-shaped vehicle specification: staged engine clusters, propellant loads, dry mass, stage dimensions and fairing or exposed nose geometry.
- Orbitlab's geometry-derived aerodynamic table generator builds Mach-dependent axial-drag and normal-force slope tables from each build's stage diameters, lengths, stage transitions and nose/fairing shape.
- SpaceZ adds the actual built fins, wings, elevons and strakes to normal-force authority, plus deployed airbrakes to axial drag. Side-mounted parts contribute to the vehicle's aerodynamic reference diameter.
- The flight solver interpolates the generated drag and lift coefficients at the current Mach number and angle of attack.
- Tables are generated at launch from the selected connected craft component; they are not shared static coefficients from a catalogue vehicle.

The underlying Orbitlab aerodynamic method is a low-order slender-body/crossflow estimate (Allen & Perkins, NACA TR 1048; Jorgensen, NASA TR R-474), not wind-tunnel data. SpaceZ's current atmosphere remains its existing exponential approximation, and the current flight integrator is still SpaceZ's. This change does **not** claim that Orbitlab's full `Simulation` runtime has replaced the flight loop yet; the pinned upstream source is present for the next integration stage, which must map SpaceZ's custom craft and controls to Orbitlab's `MissionConfig`/six-DOF runtime and be regression-tested before switching the live flight over.

## Build requirements

CI and Pages checkout the submodule recursively. A local clone must use:

```sh
git clone --recurse-submodules https://github.com/the-name-royce-was-taken/SpaceZdesigns.git
```

If already cloned, run `git submodule update --init --recursive`.

## Aerodynamic source provenance

The local files in `src/orbitlab/` isolate Orbitlab's Apache-2.0 aerodynamic coefficient and table implementation from its larger UI/runtime graph. The table generator's imports were redirected to the small local stack-layout helper; the adapter adds SpaceZ part-catalog planform terms for fins, wings, elevons and strakes, plus deployed airbrake drag. Upstream attribution and the Apache license/NOTICE are preserved in `third_party/orbitlab/`.
