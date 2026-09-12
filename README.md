# ASTRA
## Asteroid Surveillance & Threat Radar

> An interactive planetary-defense dashboard visualizing Near-Earth Objects using real-time NASA/JPL CNEOS data.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-latest-009688.svg)](https://fastapi.tiangolo.com)

---

## Overview

ASTRA brings NASA/JPL asteroid data to life through interactive 3D orbit visualization, real-time close approach monitoring, and AI-assisted scientific explanations. Built for planetary science enthusiasts, students, and anyone curious about the Near-Earth Object landscape.

**What makes ASTRA different from NASA's own tools:**
- Unified view combining three separate JPL APIs (CAD + SBDB + Sentry)
- Scientifically accurate distinction between **PHA status** and **impact risk**
- AI-assisted explanations grounded in real orbital data
- Custom filtering and cross-referenced asteroid detail pages

---

## Features

- **NEO Radar Dashboard** — Live close approach monitoring for the next 60 days
- **Asteroid Detail Pages** — Physical parameters, orbital elements, close approach history
- **3D Orbit Visualization** — Interactive Keplerian orbit viewer (Three.js)
- **PHA Classification** — Potentially Hazardous Asteroid badge with scientific context
- **Sentry Impact Monitoring** — Three-state system: MONITORED / IMPACT ELIMINATED / NOT MONITORED
- **AI Scientific Analysis** — Data-grounded explanations via LLM (no hallucination guardrails)
- **Advanced Filtering** — By date range, distance, velocity, diameter, PHA status

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| [Next.js 14](https://nextjs.org) (App Router) | Framework |
| TypeScript | Type safety |
| [Three.js](https://threejs.org) + React Three Fiber | 3D orbit visualization |
| Tailwind CSS | Styling |
| Zustand | State management |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.11+ | Runtime |
| [FastAPI](https://fastapi.tiangolo.com) | REST API framework |
| Pydantic v2 | Data validation & serialization |
| httpx | Async HTTP client for NASA APIs |
| Redis | Response caching |

---

## Architecture

```
User ──► Next.js ──► FastAPI ──► Redis (cache) ──► NASA/JPL APIs
                      │                               ├── CAD API
                      └──► LLM Provider              ├── SBDB API
                                                      └── Sentry API
```

All NASA/JPL API calls are proxied through the FastAPI backend per JPL's usage guidelines. Browser-direct API calls are not used.

**Cache TTLs:**
- Close approach data (CAD): 10 minutes
- Asteroid detail (SBDB): 1 hour
- Sentry impact data: 30 minutes

See [`/docs/architecture.md`](docs/architecture.md) for the full architecture diagram.

---

## Data Sources

| API | Endpoint | Purpose |
|---|---|---|
| **SBDB Close Approach Data** | `/cad.api` | Close approach dates, distances, velocities |
| **Small-Body Database** | `/sbdb.api` | Asteroid identity, orbital elements, physical parameters |
| **Sentry Impact Monitoring** | `/sentry.api` | Future impact probability assessment |

All data sourced from [NASA/JPL Center for Near-Earth Object Studies (CNEOS)](https://cneos.jpl.nasa.gov/).

---

## Important: PHA vs. Impact Risk

**Potentially Hazardous Asteroid (PHA)** and **Sentry impact monitoring** are two different things:

- A **PHA** designation means an asteroid's orbit intersects Earth's orbital neighborhood. It does **not** mean the asteroid will hit Earth.
- **Sentry** monitors specific future orbital scenarios for impact probability. Most PHAs have **no Sentry entry** at all.
- An asteroid can be **removed from Sentry** (like Apophis in 2021) when observations rule out all impact scenarios — this is good news.

ASTRA displays both statuses separately and clearly. ASTRA does **not** independently compute impact probabilities.

---

## Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- Redis (Docker recommended for local)
- pnpm or npm

### Setup

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
pnpm install
pnpm dev
```

**Redis (Docker):**
```bash
docker run -d -p 6379:6379 redis:alpine
```

### Environment Variables

**Backend** (`backend/.env`):
```
NASA_BASE_URL=https://ssd-api.jpl.nasa.gov
REDIS_URL=redis://localhost:6379
AI_PROVIDER=openai
AI_API_KEY=your_key_here
CORS_ORIGINS=http://localhost:3000
```

**Frontend** (`frontend/.env.local`):
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Project Structure

```
astra/
├── frontend/              # Next.js application
│   ├── app/               # App Router pages
│   │   ├── page.tsx       # Radar dashboard
│   │   ├── asteroids/
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   └── about/
│   │       └── page.tsx
│   ├── components/
│   │   ├── radar/         # Dashboard components
│   │   ├── asteroid/      # Detail components
│   │   ├── orbit/         # Three.js orbit viewer
│   │   └── ui/            # Design system
│   ├── stores/            # Zustand stores
│   ├── types/             # TypeScript interfaces
│   └── lib/               # Utilities, API client
│
├── backend/               # FastAPI application
│   ├── main.py
│   ├── routers/
│   │   └── asteroids.py
│   ├── services/
│   │   ├── cad_service.py
│   │   ├── sbdb_service.py
│   │   ├── sentry_service.py
│   │   ├── ai_service.py
│   │   └── cache_service.py
│   ├── adapters/
│   │   ├── cad_adapter.py
│   │   ├── sbdb_adapter.py
│   │   └── sentry_adapter.py
│   ├── models/
│   │   └── asteroid.py    # Pydantic models
│   └── tests/
│
└── docs/
    ├── architecture.md
    ├── data-models.md
    └── api-specification.md
```

---

## Roadmap

### v1.0 — MVP (Current Sprint)
- [x] Sprint 0: Discovery & Architecture
- [ ] Sprint 1: Data Layer (FastAPI + NASA API integration)
- [ ] Sprint 2: Frontend Foundation (design system, layout)
- [ ] Sprint 3: Radar Dashboard
- [ ] Sprint 4: Asteroid Detail Pages
- [ ] Sprint 5: 3D Orbit Visualization
- [ ] Sprint 6: Sentry Integration
- [ ] Sprint 7: AI Analysis
- [ ] Sprint 8: Polish & Deployment

### v2.0 — Future
- Analytics dashboard
- Asteroid comparison view
- Historical close approach timeline
- Export / sharing features

---

## Disclaimer

> ASTRA is an **educational visualization tool**. It does not independently predict asteroid impacts or replace official NASA/JPL impact monitoring systems.
>
> All orbital data, impact probabilities, and classification data are sourced directly from NASA/JPL CNEOS and are subject to their accuracy limitations. Impact probabilities from the Sentry system can be inaccurate by a factor of ten or more due to observational uncertainties.
>
> For authoritative planetary defense information, consult [CNEOS](https://cneos.jpl.nasa.gov/), [NASA Planetary Defense](https://www.nasa.gov/planetarydefense/), and [ESA NEOCC](https://neo.ssa.esa.int/).

---

## Credits

- **Data:** [NASA/JPL Center for Near-Earth Object Studies (CNEOS)](https://cneos.jpl.nasa.gov/)
- **APIs:** [JPL Solar System Dynamics SSD/CNEOS API Server](https://ssd-api.jpl.nasa.gov/)
- **Inspiration:** [NASA Eyes on Asteroids](https://www.jpl.nasa.gov/asteroid-watch/eyes-on-asteroids/)

---

## License

MIT © 2026 ASTRA Project
