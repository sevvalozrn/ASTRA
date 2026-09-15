# ASTRA

### Asteroid Surveillance & Threat Radar

> An interactive 3D visualization of Near-Earth Objects using real NASA/JPL data.

ASTRA is a web-based visualization project focused on exploring Near-Earth Objects through an interactive 3D radar interface.

The project transforms astronomical data into a spatial environment where asteroid positions, relative distances, classifications, and selected orbital parameters can be explored visually.

---

## Features

* **3D Asteroid Radar** — Interactive visualization of Near-Earth Objects in a spatial environment.
* **Relative Positioning** — Asteroids are positioned using relative X, Y, and Z coordinates.
* **Interactive HUD** — Real-time labels displaying asteroid identification and telemetry data.
* **Scientific Reference Grid** — Range rings, radial guides, distance markers, and depth references.
* **NASA/JPL Data** — Astronomical data sourced from the NASA/JPL Small-Body Database.

---

## Data

ASTRA uses data from the **NASA/JPL Small-Body Database (SBDB)**.

The current visualization includes selected asteroid properties such as:

```text
Designation
Classification
NEO / PHA Status
MOID
Orbital Elements
Estimated Diameter
Albedo
Absolute Magnitude
Relative Position
```

The project focuses on visualization and interaction rather than reproducing the full planetary-defense infrastructure of NASA/JPL.

---

## Technology

**Frontend:** React · TypeScript · Vite
**3D:** Three.js · React Three Fiber
**Data:** NASA/JPL Small-Body Database

---

## Design

ASTRA follows a restrained aerospace instrumentation aesthetic, using dark surfaces, technical typography, subtle cyan/blue visualization elements, and minimal status colors.

The interface is designed to prioritize **data clarity, spatial awareness, and interaction** over decorative effects.

---

## Disclaimer

ASTRA is an educational visualization project. It does not independently calculate asteroid impact probabilities or replace official planetary-defense systems.

All astronomical data is sourced from NASA/JPL and remains subject to the limitations of the original data.

---

## Credits

**Data**
NASA/JPL Solar System Dynamics — Small-Body Database

**Technology**
Three.js · React Three Fiber · React · TypeScript · Vite

**Project**
ASTRA — Asteroid Surveillance & Threat Radar

---

### License

MIT © 2026 ASTRA Project
