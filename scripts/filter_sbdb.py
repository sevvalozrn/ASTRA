import json
import math
from pathlib import Path


# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_FILE = BASE_DIR / "data" / "sbdb_asteroids.json"
OUTPUT_FILE = BASE_DIR / "data" / "astra_objects.json"

TOP_N = 50


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def to_float(value):
    """Convert a value to float. Return None if impossible."""
    if value is None:
        return None

    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def to_int(value):
    """Convert a value to int. Return None if impossible."""
    if value is None:
        return None

    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def is_true(value):
    """Handle SBDB boolean-like values."""
    return str(value).lower() in {"y", "yes", "true", "1"}


# ---------------------------------------------------------
# TEMPORARY VISUAL POSITION
# ---------------------------------------------------------

def get_asteroid_position(moid, index):
    """
    Generate a temporary visual position relative to Earth.

    Earth = (0, 0, 0)

    IMPORTANT:
    These are NOT real astronomical coordinates.
    They are only used for the current ASTRA 3D visualization.

    Smaller MOID -> visually closer to Earth.
    Larger MOID  -> visually farther from Earth.
    """

    moid_value = to_float(moid)

    # If MOID is missing, place the asteroid around the middle.
    if moid_value is None:
        normalized = 0.5
    else:
        # Normalize MOID between 0 and 0.15 AU.
        # Values above 0.15 are treated as 1.
        normalized = min(moid_value / 0.15, 1.0)

    # Visual distance from Earth.
    radius = 3 + normalized * 10

    # Golden-angle distribution.
    # This prevents objects from stacking on top of each other.
    angle = index * 2.39996

    # Slight vertical variation.
    vertical_offset = ((index % 7) - 3) * 0.5

    x = math.cos(angle) * radius
    y = vertical_offset
    z = math.sin(angle) * radius

    return {
        "x": round(x, 3),
        "y": round(y, 3),
        "z": round(z, 3),
    }


# ---------------------------------------------------------
# ASTRA INTEREST SCORE
# ---------------------------------------------------------

def calculate_score(asteroid):

    score = 0
    reasons = []

    pha = is_true(asteroid.get("pha"))

    moid = to_float(asteroid.get("moid"))
    diameter = to_float(asteroid.get("diameter"))
    eccentricity = to_float(asteroid.get("e"))
    inclination = to_float(asteroid.get("i"))

    data_arc = to_float(asteroid.get("data_arc"))
    n_obs = to_int(asteroid.get("n_obs_used"))

    orbit_class = str(
        asteroid.get("class") or ""
    ).upper()

    # -----------------------------------------------------
    # 1. POTENTIALLY HAZARDOUS
    # -----------------------------------------------------

    if pha:
        score += 40
        reasons.append("Potentially Hazardous Asteroid")

    # -----------------------------------------------------
    # 2. MOID / EARTH PROXIMITY
    # -----------------------------------------------------

    if moid is not None:

        if moid < 0.01:
            score += 35
            reasons.append("Very low Earth MOID")

        elif moid < 0.03:
            score += 25
            reasons.append("Low Earth MOID")

        elif moid < 0.05:
            score += 15
            reasons.append("Close Earth MOID")

    # -----------------------------------------------------
    # 3. SIZE
    # -----------------------------------------------------

    if diameter is not None:

        if diameter >= 1000:
            score += 25
            reasons.append("Large asteroid (>1 km)")

        elif diameter >= 500:
            score += 20
            reasons.append("Large asteroid (>500 m)")

        elif diameter >= 100:
            score += 12
            reasons.append("Large asteroid (>100 m)")

        elif diameter >= 50:
            score += 5
            reasons.append("Medium asteroid (>50 m)")

    # -----------------------------------------------------
    # 4. HIGH ECCENTRICITY
    # -----------------------------------------------------

    if eccentricity is not None:

        if eccentricity >= 0.7:
            score += 15
            reasons.append("Extreme orbital eccentricity")

        elif eccentricity >= 0.5:
            score += 10
            reasons.append("High orbital eccentricity")

        elif eccentricity >= 0.3:
            score += 5
            reasons.append("Notable orbital eccentricity")

    # -----------------------------------------------------
    # 5. HIGH INCLINATION
    # -----------------------------------------------------

    if inclination is not None:

        if inclination >= 30:
            score += 15
            reasons.append("Extreme orbital inclination")

        elif inclination >= 20:
            score += 10
            reasons.append("High orbital inclination")

        elif inclination >= 10:
            score += 5
            reasons.append("Notable orbital inclination")

    # -----------------------------------------------------
    # 6. ORBIT CLASS
    # -----------------------------------------------------

    if orbit_class == "ATE":
        score += 5
        reasons.append("Aten-class orbit")

    elif orbit_class == "APO":
        score += 5
        reasons.append("Apollo-class orbit")

    elif orbit_class == "AMO":
        score += 3
        reasons.append("Amor-class orbit")

    # -----------------------------------------------------
    # 7. DATA QUALITY
    # -----------------------------------------------------

    if data_arc is not None:

        if data_arc >= 3650:
            # 10 years
            score += 5
            reasons.append("Long observation history")

        elif data_arc >= 1825:
            # 5 years
            score += 3

    if n_obs is not None:

        if n_obs >= 500:
            score += 5
            reasons.append("High observation count")

        elif n_obs >= 100:
            score += 3

    return score, reasons


# ---------------------------------------------------------
# MAIN
# ---------------------------------------------------------

def main():

    print("Loading SBDB dataset...")

    # -----------------------------------------------------
    # CHECK INPUT FILE
    # -----------------------------------------------------

    if not INPUT_FILE.exists():

        print("ERROR: Input file not found:")
        print(INPUT_FILE)

        return

    # -----------------------------------------------------
    # LOAD JSON
    # -----------------------------------------------------

    with open(
        INPUT_FILE,
        "r",
        encoding="utf-8"
    ) as file:

        raw_data = json.load(file)

    # -----------------------------------------------------
    # SBDB API RESPONSE → LIST OF DICTS
    # -----------------------------------------------------

    if (
        isinstance(raw_data, dict)
        and "data" in raw_data
        and "fields" in raw_data
    ):

        fields = raw_data["fields"]
        rows = raw_data["data"]

        data = [
            dict(zip(fields, row))
            for row in rows
        ]

    elif isinstance(raw_data, list):

        data = raw_data

    else:

        print("ERROR: Unknown SBDB JSON format.")

        return

    print(f"Total objects loaded: {len(data)}")

    # -----------------------------------------------------
    # SCORE OBJECTS
    # -----------------------------------------------------

    scored_objects = []

    for asteroid in data:

        score, reasons = calculate_score(asteroid)

        asteroid_copy = asteroid.copy()

        asteroid_copy["astra_score"] = score
        asteroid_copy["astra_reasons"] = reasons

        scored_objects.append(asteroid_copy)

    # -----------------------------------------------------
    # SORT BY ASTRA SCORE
    # -----------------------------------------------------

    scored_objects.sort(
        key=lambda asteroid: asteroid.get(
            "astra_score",
            0
        ),
        reverse=True,
    )

    # -----------------------------------------------------
    # SELECT TOP N
    # -----------------------------------------------------

    selected = scored_objects[:TOP_N]

    # -----------------------------------------------------
    # REMOVE DUPLICATES
    # -----------------------------------------------------

    unique = {}

    for asteroid in selected:

        spkid = asteroid.get("spkid")

        if spkid:

            unique[spkid] = asteroid

        else:

            unique[id(asteroid)] = asteroid

    selected = list(unique.values())

    # -----------------------------------------------------
    # GENERATE VISUAL POSITIONS
    # -----------------------------------------------------

    for index, asteroid in enumerate(selected):

        asteroid["position"] = get_asteroid_position(
            asteroid.get("moid"),
            index
        )

    # -----------------------------------------------------
    # SAVE
    # -----------------------------------------------------

    OUTPUT_FILE.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        OUTPUT_FILE,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            selected,
            file,
            ensure_ascii=False,
            indent=2,
        )

    # -----------------------------------------------------
    # TERMINAL OUTPUT
    # -----------------------------------------------------

    print()

    print("=" * 60)
    print("ASTRA FILTER COMPLETE")
    print("=" * 60)

    print(f"Input objects : {len(data)}")
    print(f"Output objects: {len(selected)}")
    print(f"Output file   : {OUTPUT_FILE}")

    print()

    print("TOP OBJECTS")
    print("-" * 60)

    for index, asteroid in enumerate(
        selected[:20],
        start=1
    ):

        name = (
            asteroid.get("name")
            or asteroid.get("full_name")
            or asteroid.get("pdes")
            or "UNKNOWN"
        )

        score = asteroid.get(
            "astra_score",
            0
        )

        pha = asteroid.get("pha")
        moid = asteroid.get("moid")
        diameter = asteroid.get("diameter")

        position = asteroid.get(
            "position",
            {}
        )

        print(
            f"{index:02d}. "
            f"{name:<30} "
            f"SCORE={score:<3} "
            f"PHA={pha} "
            f"MOID={moid} "
            f"DIAM={diameter} "
            f"POS=({position.get('x')}, "
            f"{position.get('y')}, "
            f"{position.get('z')})"
        )


# ---------------------------------------------------------
# RUN
# ---------------------------------------------------------

if __name__ == "__main__":
    main()
    