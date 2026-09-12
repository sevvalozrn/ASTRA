# ASTRA — NASA/JPL API Research

## 1. Overview

ASTRA (Asteroid Surveillance & Threat Radar) uses NASA/JPL Center for Near-Earth Object Studies (CNEOS) data as its primary scientific data source.

The project will initially integrate three main CNEOS APIs:

- CAD — Close-Approach Data
- SBDB — Small-Body Database
- Sentry — Impact Risk Data

This document records the API research and defines how NASA/JPL data will be used inside ASTRA.

---

# 2. CAD API

## 2.1 Purpose

CAD (Close-Approach Data) provides information about close approaches between small bodies and planets.

ASTRA will use CAD primarily for:

- Upcoming close approaches
- Asteroid-Earth distance
- Relative velocity
- Close-approach date
- Distance uncertainty
- Absolute magnitude
- Estimated diameter
- Filtering and sorting close approaches

---

## 2.2 Official Documentation

NASA/JPL CNEOS CAD API documentation:

https://ssd-api.jpl.nasa.gov/doc/cad.html

API endpoint:

https://ssd-api.jpl.nasa.gov/cad.api

---

## 2.3 API Architecture

ASTRA will not request NASA/JPL APIs directly from the browser.

The architecture will be:

Frontend
    ↓
FastAPI Backend
    ↓
NASA/JPL CNEOS API
    ↓
FastAPI Backend
    ↓
Frontend

Reasons:

- Keep external API logic inside the backend
- Avoid exposing external API integration details to the frontend
- Normalize NASA/JPL response formats
- Add caching later
- Handle errors centrally
- Combine CAD, SBDB and Sentry data
- Provide a stable API contract for the frontend

---

# 3. CAD Request Parameters

The CAD API supports several query parameters.

ASTRA's initial implementation will primarily use:

| Parameter | Purpose |
|---|---|
| `body` | Planet or body involved in the close approach |
| `date-min` | Minimum date |
| `date-max` | Maximum date |
| `dist-max` | Maximum close-approach distance |
| `dist-min` | Minimum close-approach distance |
| `neo` | Filter for Near-Earth Objects |
| `pha` | Filter for Potentially Hazardous Asteroids |
| `h-min` | Minimum absolute magnitude |
| `h-max` | Maximum absolute magnitude |
| `v-rel-min` | Minimum relative velocity |
| `v-rel-max` | Maximum relative velocity |
| `limit` | Maximum number of returned results |
| `sort` | Sort order |
| `diameter` | Request diameter information |
| `fullname` | Request full object name |

---

# 4. Initial ASTRA CAD Query

ASTRA's initial close-approach query will conceptually request:

- Earth close approaches
- Near-Earth Objects
- A defined future date range
- A maximum distance threshold
- Sorted by approach date
- Diameter information
- Full object names

Example:

https://ssd-api.jpl.nasa.gov/cad.api?body=Earth&dist-max=0.05&date-min=now&date-max=%2B60d&sort=date&diameter=true&fullname=true

This request is used for exploration and API understanding.

The production implementation will be handled by the FastAPI backend.

---

# 5. CAD Response Structure

The CAD API returns a response containing metadata and tabular data.

Simplified structure:

```json
{
  "signature": {
    "source": "NASA/JPL",
    "version": "1.5"
  },
  "count": 1,
  "fields": [
    "des",
    "orbit_id",
    "jd",
    "cd",
    "dist",
    "dist_min",
    "dist_max",
    "v_rel",
    "v_inf",
    "t_sigma_f",
    "body",
    "h",
    "diameter",
    "fullname"
  ],
  "data": [
    [
      "asteroid designation",
      "orbit id",
      "julian date",
      "calendar date",
      "distance",
      "minimum distance",
      "maximum distance",
      "relative velocity",
      "infinity velocity",
      "time uncertainty",
      "Earth",
      "absolute magnitude",
      "diameter",
      "full name"
    ]
  ]
}