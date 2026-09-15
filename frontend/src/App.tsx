import { useEffect, useState } from "react";
import "./App.css";
import astraObjectsRaw from "./data/astra_objects.json";
import AsteroidOrbitViewer from "./AsteroidOrbitViewer";

export type AstraObject = {
  spkid: number;
  full_name: string;
  pdes: string;
  name: string | null;
  kind: string;
  class: string;
  neo: string;
  pha: string;
  moid: string | null;
  moid_ld: string | null;
  e: string | null;
  a: string | null;
  q: string | null;
  i: string | null;
  om: string | null;
  w: string | null;
  ma: string | null;
  per: string | null;
  ad: string | null;
  H: string | null;
  diameter: string | null;
  albedo: string | null;
  rot_per: string | null;
  condition_code: string | null;
  data_arc: string | null;
  first_obs: string | null;
  last_obs: string | null;
  n_obs_used: number | null;
  soln_date: string | null;
  astra_score: number;
  astra_reasons: string[];
  position: {
    x: number;
    y: number;
    z: number;
  };
};

const astraObjects = astraObjectsRaw as AstraObject[];

function App() {
  const [systemStarted, setSystemStarted] = useState(false);
  const [showInterface, setShowInterface] = useState(false);
  const [selectedAsteroid, setSelectedAsteroid] =
    useState<AstraObject | null>(null);
  const [orbitMode, setOrbitMode] = useState(false);

  const [bootStep, setBootStep] = useState(0);
  const [time, setTime] = useState("");

  /*
   * ---------------------------------------------------------
   * BOOT SEQUENCE
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!systemStarted) return;

    const timer = setInterval(() => {
      setBootStep((current) => {
        if (current >= 3) {
          clearInterval(timer);
          return 3;
        }

        return current + 1;
      });
    }, 650);

    return () => clearInterval(timer);
  }, [systemStarted]);

  /*
   * ---------------------------------------------------------
   * UTC CLOCK
   * ---------------------------------------------------------
   */

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formatted = now.toISOString().substring(11, 19);
      setTime(formatted);
    };

    updateTime();

    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  /*
   * ---------------------------------------------------------
   * ENTER SYSTEM
   * ---------------------------------------------------------
   */

  const handleEnterSystem = () => {
    setSystemStarted(true);

    setTimeout(() => {
      setShowInterface(true);
    }, 2700);
  };

  /*
   * ---------------------------------------------------------
   * ASTEROID SELECT
   * ---------------------------------------------------------
   */

  const handleSelectAsteroid = (asteroid: AstraObject) => {
    setSelectedAsteroid(asteroid);
    setOrbitMode(false);
  };

  /*
   * ---------------------------------------------------------
   * ORBIT MODE
   * ---------------------------------------------------------
   */

  const handleViewOrbit = () => {
    setOrbitMode(true);
  };

  const handleReturnRadar = () => {
    setOrbitMode(false);
  };

  return (
    <main className="app">
      {/* =====================================================
          3D SPACE SCENE
          ===================================================== */}

      <div className="space-scene">
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at center, rgba(15, 28, 38, 0.18), transparent 45%)",
          }}
        />
      </div>

      {/* =====================================================
          DECORATIVE LAYERS
          ===================================================== */}

      <div className="space-grid" />
      <div className="space-vignette" />
      <div className="scanline" />

      <div className="corner top-left" />
      <div className="corner top-right" />
      <div className="corner bottom-left" />
      <div className="corner bottom-right" />

      {/* =====================================================
          INTRO / BOOT SCREEN
          ===================================================== */}

      {!showInterface && (
        <section
          className={`intro-screen ${systemStarted && bootStep >= 3 ? "hidden" : ""
            }`}
        >
          <div className="intro-content">
            <h1 className="intro-logo">ASTRA</h1>

            <p className="intro-subtitle">
              Asteroid Surveillance System
            </p>

            {systemStarted && (
              <div className="boot-status">
                <div className="boot-row">
                  <span>CNEOS CONNECTION</span>

                  <span
                    className={
                      bootStep >= 1
                        ? "boot-status-value"
                        : "boot-status-value loading"
                    }
                  >
                    {bootStep >= 1 ? "OK" : "CONNECTING"}
                  </span>
                </div>

                <div className="boot-row">
                  <span>ORBITAL DATABASE</span>

                  <span
                    className={
                      bootStep >= 2
                        ? "boot-status-value"
                        : "boot-status-value loading"
                    }
                  >
                    {bootStep >= 2 ? "OK" : "LOADING"}
                  </span>
                </div>

                <div className="boot-row">
                  <span>RADAR SYSTEM</span>

                  <span
                    className={
                      bootStep >= 3
                        ? "boot-status-value"
                        : "boot-status-value loading"
                    }
                  >
                    {bootStep >= 3 ? "READY" : "INITIALIZING"}
                  </span>
                </div>
              </div>
            )}

            {!systemStarted && (
              <div className="intro-enter">
                <span className="intro-enter-label">
                  Planetary Defense Network
                </span>

                <button
                  className="enter-button"
                  onClick={handleEnterSystem}
                >
                  Enter System
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* =====================================================
          MAIN HUD
          ===================================================== */}

      {showInterface && (
        <>
          {/* -------------------------------------------------
              TOP HUD
              ------------------------------------------------- */}

          <header className="top-hud">
            <div className="brand">
              <div className="brand-name">ASTRA</div>

              <div className="brand-subtitle">
                Asteroid Surveillance System
              </div>

              <div className="live-indicator">
                <span className="live-dot" />
                Live Data
              </div>
            </div>

            <div className="data-source">
              <div className="utc-time">UTC {time}</div>

              <div className="data-source-label">Data Source</div>

              <div className="data-source-name">NASA / JPL CNEOS</div>
            </div>
          </header>

          {/* -------------------------------------------------
              LEFT HUD
              ------------------------------------------------- */}

          {!orbitMode && (
            <aside className="left-hud">
              <div className="data-readout">
                <div className="data-readout-label">
                  Objects Detected
                </div>

                <div className="data-readout-value">
                  {String(astraObjects.length).padStart(2, "0")}
                </div>

                <div className="data-readout-description">
                  Near-Earth Objects
                </div>
              </div>

              <div className="data-readout">
                <div className="data-readout-label">
                  Close Approaches
                </div>

                <div className="data-readout-value">
                  {String(
                    astraObjects.filter(
                      (o) => parseFloat(o.moid || "1") < 0.05
                    ).length
                  ).padStart(2, "0")}
                </div>

                <div className="data-readout-description">
                  Tracked Objects
                </div>
              </div>

              <div className="system-status">
                <div className="system-status-title">
                  System Status
                </div>

                <div className="status-row">
                  <span className="status-dot" />
                  Radar Active
                </div>

                <div className="status-row">
                  <span className="status-dot" />
                  Tracking Online
                </div>

                <div className="status-row">
                  <span className="status-dot" />
                  Data Synchronized
                </div>
              </div>
            </aside>
          )}

          {/* -------------------------------------------------
              RADAR FIELD & TARGETING SYSTEM
              ------------------------------------------------- */}

          {!orbitMode && (
            <div className="radar-field">
              {/* Phased array rotating sweep scanner */}
              <div className="radar-sweep-beam" />

              {/* Diagonal azimuth reference guides */}
              <div className="radar-diagonal radar-diag-1" />
              <div className="radar-diagonal radar-diag-2" />

              {/* Concentric range rings centered around Earth (50%, 50%) */}
              <div className="radar-ring radar-ring-1">
                <span className="radar-ring-label">1.0 AU • 150M KM</span>
              </div>
              <div className="radar-ring radar-ring-2">
                <span className="radar-ring-label">2.5 AU • 375M KM</span>
              </div>
              <div className="radar-ring radar-ring-3">
                <span className="radar-ring-label">4.0 AU • 600M KM</span>
              </div>

              {/* Azimuth Cardinal Indicators */}
              <div className="radar-cardinal cardinal-n">000° N</div>
              <div className="radar-cardinal cardinal-e">090° E</div>
              <div className="radar-cardinal cardinal-s">180° S</div>
              <div className="radar-cardinal cardinal-w">270° W</div>

              {/* Crosshair reticle axes */}
              <div className="radar-axis-h" />
              <div className="radar-axis-v" />

              {/* Center Earth Astronomical Reference Datum */}
              <div className="radar-earth" title="Earth Datum [0,0,0]">
                <div className="radar-earth-crosshair" />
                <span className="radar-earth-glyph">⊕</span>
                <span className="radar-earth-label">EARTH [0.00 AU]</span>
              </div>

              {/* Asteroid radar blips from astra_objects.json */}
              {astraObjects.map((asteroid, index) => {
                // Normalizing position to fit comfortably in radar screen
                // x range [-3.36, 4.52], z range [-4.95, 3.59]
                const maxCoord = 5.6;
                const left = 50 + (asteroid.position.x / maxCoord) * 36;
                const top = 50 + (asteroid.position.z / maxCoord) * 36;
                const isSelected =
                  selectedAsteroid?.spkid === asteroid.spkid;

                const isCritical =
                  asteroid.pha === "Y" && asteroid.astra_score >= 115;
                const isHazard = asteroid.pha === "Y" && !isCritical;

                return (
                  <button
                    key={asteroid.spkid}
                    className={`radar-dot-button ${isSelected ? "active" : ""
                      }`}
                    onClick={() => handleSelectAsteroid(asteroid)}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      animationDelay: `${index * 35}ms`,
                    }}
                    aria-label={`Select ${asteroid.pdes}`}
                    title={asteroid.full_name || asteroid.pdes}
                  >
                    {/* Blip contact diamond */}
                    <span
                      className={`radar-dot-core ${isCritical
                          ? "critical"
                          : isHazard
                            ? "hazard"
                            : ""
                        }`}
                    />

                    {/* Micro designation tag */}
                    <span className="radar-blip-pdes">
                      {asteroid.pdes}
                    </span>

                    {/* Technical tactical hover readout */}
                    <span className="radar-dot-tag">
                      <div className="radar-tag-row header">
                        <span className="radar-dot-tag-title">
                          {asteroid.name || asteroid.pdes}
                        </span>
                        <span className={`radar-tag-badge ${asteroid.pha === "Y" ? "pha" : ""}`}>
                          {asteroid.pha === "Y" ? "PHA" : "NEO"}
                        </span>
                      </div>
                      <div className="radar-tag-grid">
                        <span className="radar-tag-k">MOID:</span>
                        <span className="radar-tag-v">
                          {asteroid.moid_ld
                            ? `${parseFloat(asteroid.moid_ld).toFixed(1)} LD`
                            : asteroid.moid
                              ? `${parseFloat(asteroid.moid).toFixed(3)} AU`
                              : "N/A"}
                        </span>
                        <span className="radar-tag-k">SCORE:</span>
                        <span className="radar-tag-v">
                          {asteroid.astra_score}/120
                        </span>
                        <span className="radar-tag-k">CLASS:</span>
                        <span className="radar-tag-v">
                          {asteroid.class || "NEO"}
                        </span>
                      </div>
                    </span>
                  </button>
                );
              })}

              {/* Optical lock reticle for selected asteroid */}
              {selectedAsteroid && (
                <div
                  className="target-marker"
                  style={{
                    left: `${50 + (selectedAsteroid.position.x / 5.6) * 36}%`,
                    top: `${50 + (selectedAsteroid.position.z / 5.6) * 36}%`,
                    zIndex: 35,
                  }}
                >
                  <div className="target-reticle-corner corner-tl" />
                  <div className="target-reticle-corner corner-tr" />
                  <div className="target-reticle-corner corner-bl" />
                  <div className="target-reticle-corner corner-br" />
                  <div className="target-reticle-label">
                    <span className="target-lock-title">LOCK: {selectedAsteroid.pdes}</span>
                    <span className="target-coords">
                      X: {selectedAsteroid.position.x.toFixed(2)} AU | Z: {selectedAsteroid.position.z.toFixed(2)} AU
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -------------------------------------------------
              MINI RADAR CORNER WIDGET
              ------------------------------------------------- */}

          <div className="radar" />

          {/* -------------------------------------------------
              ASTEROID DETAIL PANEL
              ------------------------------------------------- */}

          {selectedAsteroid && !orbitMode && (
            <aside className="object-panel">
              <div className="object-header">
                <div>
                  <div className="object-label">
                    Object Identified
                  </div>

                  <div className="object-name">
                    {selectedAsteroid.name || selectedAsteroid.pdes}
                  </div>

                  <div className="object-designation">
                    {selectedAsteroid.full_name
                      ? selectedAsteroid.full_name.trim()
                      : `DESIG: ${selectedAsteroid.pdes}`}
                  </div>
                </div>

                <div className="object-type">
                  {selectedAsteroid.neo === "Y" ? "N.E.O" : "ASTEROID"}
                </div>
              </div>

              <div className="object-status">
                <span
                  className={`object-status-dot ${selectedAsteroid.pha === "Y" ? "danger" : ""
                    }`}
                />

                {selectedAsteroid.pha === "Y"
                  ? "POTENTIALLY HAZARDOUS"
                  : "MONITORED OBJECT"}
              </div>

              <div className="object-data">
                <div className="object-data-row">
                  <span className="object-data-label">Orbit Class</span>

                  <span className="object-data-value">
                    {selectedAsteroid.class || "NEAR-EARTH"}
                  </span>
                </div>

                <div className="object-data-row">
                  <span className="object-data-label">Diameter</span>

                  <span className="object-data-value">
                    {selectedAsteroid.diameter
                      ? `${selectedAsteroid.diameter} km`
                      : selectedAsteroid.H
                        ? `H: ${selectedAsteroid.H} mag`
                        : "UNKNOWN"}
                  </span>
                </div>

                <div className="object-data-row">
                  <span className="object-data-label">Earth MOID</span>

                  <span className="object-data-value">
                    {selectedAsteroid.moid
                      ? `${parseFloat(selectedAsteroid.moid).toFixed(5)} AU`
                      : "N/A"}
                    {selectedAsteroid.moid_ld
                      ? ` (${parseFloat(selectedAsteroid.moid_ld).toFixed(2)} LD)`
                      : ""}
                  </span>
                </div>

                <div className="object-data-row">
                  <span className="object-data-label">
                    ASTRA Threat Score
                  </span>

                  <span
                    className="object-data-value"
                    style={{ color: "var(--cyan)", fontWeight: 500 }}
                  >
                    {selectedAsteroid.astra_score} / 120
                  </span>
                </div>

                {selectedAsteroid.rot_per && (
                  <div className="object-data-row">
                    <span className="object-data-label">
                      Rotation Period
                    </span>

                    <span className="object-data-value">
                      {parseFloat(selectedAsteroid.rot_per).toFixed(2)} h
                    </span>
                  </div>
                )}

                {selectedAsteroid.first_obs && (
                  <div className="object-data-row">
                    <span className="object-data-label">
                      Observation Arc
                    </span>

                    <span className="object-data-value">
                      {selectedAsteroid.data_arc || "—"} d (
                      {selectedAsteroid.n_obs_used || "—"} obs)
                    </span>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "16px",
                }}
              >
                <button
                  className="view-orbit-button"
                  style={{ marginTop: 0, flex: 1 }}
                  onClick={handleViewOrbit}
                >
                  View Orbit
                </button>

                <button
                  className="view-orbit-button"
                  style={{
                    marginTop: 0,
                    flex: "0 0 38px",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(255, 107, 95, 0.1)",
                    borderColor: "rgba(255, 107, 95, 0.3)",
                    color: "var(--danger)",
                  }}
                  onClick={() => setSelectedAsteroid(null)}
                  title="Deselect object"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
            </aside>
          )}

          {/* -------------------------------------------------
              ORBIT MODE
              ------------------------------------------------- */}

          {orbitMode && selectedAsteroid && (
            <section className="orbit-mode">
              {/* 3D Scientific Asteroid & Orbit Viewport */}
              <AsteroidOrbitViewer
                asteroid={selectedAsteroid}
                allAsteroids={astraObjects}
                onSelectAsteroid={(ast) => setSelectedAsteroid(ast)}
              />

              <div className="orbit-info">
                <div className="orbit-info-title">Orbital Analysis</div>

                <div className="orbit-info-name">
                  {selectedAsteroid.name || selectedAsteroid.pdes}
                </div>

                <div className="orbit-data">
                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Class</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.class ? selectedAsteroid.class.toUpperCase() : "APOLLO"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Status</span>
                    <span
                      className="orbit-data-value"
                      style={{
                        color: selectedAsteroid.pha === "Y" ? "var(--danger)" : "var(--cyan)",
                        fontWeight: 500,
                      }}
                    >
                      {selectedAsteroid.pha === "Y"
                        ? "POTENTIALLY HAZARDOUS"
                        : "MONITORED OBJECT"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Diameter</span>
                    <span
                      className="orbit-data-value"
                      style={{ color: "var(--cyan-bright)", fontWeight: 500 }}
                    >
                      {selectedAsteroid.diameter
                        ? parseFloat(selectedAsteroid.diameter) < 1
                          ? `${Math.round(parseFloat(selectedAsteroid.diameter) * 1000)} m`
                          : `${parseFloat(selectedAsteroid.diameter).toFixed(2)} km`
                        : selectedAsteroid.H
                          ? `H: ${selectedAsteroid.H} mag`
                          : "UNKNOWN"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Earth MOID</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.moid
                        ? `${parseFloat(selectedAsteroid.moid).toFixed(5)} AU`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Semi-major Axis (a)</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.a
                        ? `${parseFloat(selectedAsteroid.a).toFixed(3)} AU`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Eccentricity (e)</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.e
                        ? parseFloat(selectedAsteroid.e).toFixed(3)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Inclination (i)</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.i
                        ? `${parseFloat(selectedAsteroid.i).toFixed(2)}°`
                        : "N/A"}
                    </span>
                  </div>

                  <div className="orbit-data-row">
                    <span className="orbit-data-label">Period</span>
                    <span className="orbit-data-value">
                      {selectedAsteroid.per
                        ? `${parseFloat(selectedAsteroid.per).toFixed(1)} days`
                        : "N/A"}
                    </span>
                  </div>
                </div>

                <button
                  className="view-orbit-button"
                  onClick={handleReturnRadar}
                >
                  Return To Radar
                </button>
              </div>
            </section>
          )}

          {/* -------------------------------------------------
              BOTTOM NAVIGATION
              ------------------------------------------------- */}

          <nav className="bottom-nav">
            <button
              className={`nav-item ${!orbitMode ? "active" : ""}`}
              onClick={handleReturnRadar}
            >
              RADAR
            </button>

            <button
              className={`nav-item ${orbitMode ? "active" : ""}`}
              onClick={() => {
                if (!selectedAsteroid && astraObjects.length > 0) {
                  setSelectedAsteroid(astraObjects[0]);
                }
                setOrbitMode(true);
              }}
            >
              ORBITS
            </button>

            <button
              className="nav-item"
              onClick={() => {
                if (!selectedAsteroid && astraObjects.length > 0) {
                  setSelectedAsteroid(astraObjects[0]);
                } else if (selectedAsteroid) {
                  const currentIndex = astraObjects.findIndex(
                    (o) => o.spkid === selectedAsteroid.spkid
                  );
                  const nextIndex =
                    (currentIndex + 1) % astraObjects.length;
                  setSelectedAsteroid(astraObjects[nextIndex]);
                }
              }}
            >
              OBJECTS
            </button>
          </nav>
        </>
      )}
    </main>
  );
}

export default App;
