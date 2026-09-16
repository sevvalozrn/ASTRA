import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import type { AstraObject } from "./App";

interface AsteroidOrbitViewerProps {
  asteroid: AstraObject;
  allAsteroids?: AstraObject[];
  onSelectAsteroid?: (asteroid: AstraObject) => void;
}

// Pseudorandom generator based on numeric seed (spkid)
function createSeededRNG(seed: number) {
  let s = Math.abs(seed) || 123456789;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// 3D Simplex-like Perlin noise implementation for procedural deformation
function createPerlin3D(rng: () => number) {
  const perm: number[] = [];
  for (let i = 0; i < 256; i++) {
    perm[i] = Math.floor(rng() * 256);
  }
  const p: number[] = new Array(512);
  for (let i = 0; i < 512; i++) {
    p[i] = perm[i & 255];
  }

  function fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  function lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }
  function grad(hash: number, x: number, y: number, z: number) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  return function noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
        lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
      ),
      lerp(
        v,
        lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))
      )
    );
  };
}

// Convert diameter (km) to visual scale
export function getVisualRadius(diameterStr: string | null, HStr: string | null): number {
  let diamKm = 0.5;
  if (diameterStr && !isNaN(parseFloat(diameterStr))) {
    diamKm = parseFloat(diameterStr);
  } else if (HStr && !isNaN(parseFloat(HStr))) {
    const H = parseFloat(HStr);
    diamKm = (1329 / Math.sqrt(0.14)) * Math.pow(10, -0.2 * H);
  }
  // Clamp & logarithmic scale so that 0.05km is ~1.2, 0.55km is ~2.0, 5km is ~3.5
  const scaled = 1.6 + Math.log10(Math.max(0.01, diamKm) * 2 + 0.3) * 0.9;
  return Math.min(Math.max(scaled, 1.1), 3.8);
}

export function formatDiameter(diameterStr: string | null, HStr: string | null): string {
  if (diameterStr && !isNaN(parseFloat(diameterStr))) {
    const d = parseFloat(diameterStr);
    if (d < 1) return `${Math.round(d * 1000)} m`;
    return `${d.toFixed(2)} km`;
  }
  if (HStr && !isNaN(parseFloat(HStr))) {
    const H = parseFloat(HStr);
    const d = (1329 / Math.sqrt(0.14)) * Math.pow(10, -0.2 * H);
    if (d < 1) return `~${Math.round(d * 1000)} m (est)`;
    return `~${d.toFixed(2)} km (est)`;
  }
  return "UNKNOWN";
}

export const AsteroidOrbitViewer: React.FC<AsteroidOrbitViewerProps> = ({
  asteroid,
  allAsteroids = [],
  onSelectAsteroid,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryTagAnchorRef = useRef<HTMLDivElement>(null);
  const primaryTagElRef = useRef<HTMLDivElement>(null);
  const badgeAnchorsRef = useRef<Map<number, HTMLDivElement>>(new Map());

  const [scanStep, setScanStep] = useState<"ACQUIRED" | "SCANNING" | "COMPLETE">("ACQUIRED");
  const [isReconstructed, setIsReconstructed] = useState<boolean>(false);
  const isReconstructedRef = useRef<boolean>(false);

  // Compute surrounding asteroids list once per focus change
  const others = React.useMemo(() => {
    const currentOrigin = asteroid.position || { x: 0, y: 0, z: 0 };
    return (allAsteroids || [])
      .filter((o) => o.spkid !== asteroid.spkid)
      .map((otherObj) => {
        const otherPos = otherObj.position || { x: 0, y: 0, z: 0 };
        const dx = otherPos.x - currentOrigin.x;
        const dy = otherPos.y - currentOrigin.y;
        const dz = otherPos.z - currentOrigin.z;
        const distAU = Math.sqrt(dx * dx + dy * dy + dz * dz);
        return {
          ...otherObj,
          distanceAU: distAU,
          isHazard: otherObj.pha === "Y",
        };
      })
      .filter((o) => o.distanceAU >= 0.0001);
  }, [asteroid, allAsteroids]);

  // Scan sequence timing
  useEffect(() => {
    setScanStep("ACQUIRED");
    const t1 = setTimeout(() => setScanStep("SCANNING"), 400);
    const t2 = setTimeout(() => setScanStep("COMPLETE"), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [asteroid.spkid]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let width = container.clientWidth;
    let height = container.clientHeight;

    // SCENE & RENDERER
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030507, 0.012);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 3, 11);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // DETERMINISTIC PROCEDURAL GEOMETRY FOR PRIMARY ASTEROID
    const rng = createSeededRNG(asteroid.spkid);
    const noise = createPerlin3D(rng);

    // Surface types: 0: Rocky, 1: Metallic, 2: Fractured, 3: Porous, 4: Dense, 5: Ancient
    const surfaceType = Math.floor(rng() * 6);
    const baseRadius = getVisualRadius(asteroid.diameter, asteroid.H);

    // Base irregular geometry using Icosahedron with subdivisions
    const baseGeo = new THREE.IcosahedronGeometry(baseRadius, 5);
    const posAttr = baseGeo.attributes.position;
    const vertex = new THREE.Vector3();

    // Elongation factors for realistic non-spherical irregular silhouette
    const stretchX = 0.85 + rng() * 0.4;
    const stretchY = 0.8 + rng() * 0.35;
    const stretchZ = 0.9 + rng() * 0.35;

    for (let i = 0; i < posAttr.count; i++) {
      vertex.fromBufferAttribute(posAttr, i);
      const nx = vertex.x / baseRadius;
      const ny = vertex.y / baseRadius;
      const nz = vertex.z / baseRadius;

      // Primary rough boulder shapes (low frequency, high amplitude)
      const n1 = noise(nx * 1.2 + 2.1, ny * 1.2 + 1.7, nz * 1.2 + 0.9);
      // Secondary craters and ridges (medium frequency)
      const n2 = noise(nx * 3.1 + 4.3, ny * 3.1 + 3.2, nz * 3.1 + 2.4);
      // Micro roughness
      const n3 = noise(nx * 6.5 + 8.1, ny * 6.5 + 7.5, nz * 6.5 + 5.3);

      let displacement = 1.0 + n1 * 0.28 + n2 * 0.12 + n3 * 0.04;

      // Surface character variations
      if (surfaceType === 2) {
        // Fractured: deep narrow groove depressions
        const cracks = Math.abs(noise(nx * 4.5, ny * 4.5, nz * 4.5));
        if (cracks < 0.12) displacement -= (0.12 - cracks) * 0.7;
      } else if (surfaceType === 3) {
        // Porous: small cavities
        if (n2 < -0.15) displacement += n2 * 0.2;
      } else if (surfaceType === 5) {
        // Ancient: more crater depressions
        if (n1 < -0.1) displacement -= 0.15 * Math.abs(n1);
      }

      vertex.x *= displacement * stretchX;
      vertex.y *= displacement * stretchY;
      vertex.z *= displacement * stretchZ;

      posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    baseGeo.computeVertexNormals();

    // SHADER MATERIAL: Radar Hologram -> Liquid-like Surface Reconstruction
    const uniforms = {
      uTime: { value: 0 },
      uHover: { value: 0 },
      uScanProgress: { value: 0 },
      uSurfaceType: { value: surfaceType },
      uBaseRadius: { value: baseRadius },
      uLightPos: { value: new THREE.Vector3(12, 10, 8) },
    };

    const asteroidMaterial = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          vPosition = position;

          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;

          vec4 mvPosition = viewMatrix * worldPosition;
          vViewPosition = -mvPosition.xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uHover;
        uniform float uScanProgress;
        uniform int uSurfaceType;
        uniform float uBaseRadius;
        uniform vec3 uLightPos;

        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vWorldPosition;
        varying vec2 vUv;
        varying vec3 vViewPosition;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise3D(vec3 p) {
          vec3 i = floor(p);
          vec3 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z
          );
        }

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);
          vec3 lightDir = normalize(uLightPos - vWorldPosition);

          float NdotV = max(dot(normal, viewDir), 0.0);
          float fresnel = pow(1.0 - NdotV, 3.2);
          float limbLuminance = pow(1.0 - NdotV, 1.8);

          // Deep space direct solar shadow with crisp terminator
          float diff = max(dot(normal, lightDir), 0.0);
          float ambient = 0.04;

          vec3 halfVector = normalize(lightDir + viewDir);
          float NdotH = max(dot(normal, halfVector), 0.0);
          float specPower = (uSurfaceType == 1) ? 48.0 : 20.0;
          float spec = pow(NdotH, specPower);

          // Scientific Delay-Doppler Radar Elevation Contours
          float latLine = abs(fract(vPosition.y * 3.6) - 0.5) * 2.0;
          float contourLine = smoothstep(0.88, 0.98, latLine);

          float angle = atan(vPosition.z, vPosition.x);
          float radialLine = smoothstep(0.88, 0.98, abs(fract(angle * 3.0) - 0.5) * 2.0);
          float radarGrid = max(contourLine, radialLine * 0.5);

          vec3 cyanColor = vec3(0.37, 0.88, 1.0);
          vec3 cyanBright = vec3(0.72, 0.96, 1.0);
          vec3 darkVoid = vec3(0.015, 0.025, 0.038);

          // Radar Wireframe / Elevation Color Mode
          vec3 radarColor = mix(darkVoid, cyanColor, radarGrid * 0.45);
          radarColor += cyanColor * fresnel * 0.55;

          // Technical Phased Sweep Beam across object
          float scanY = (vPosition.y / (uBaseRadius * 1.5)) * 0.5 + 0.5;
          float scanDist = abs(scanY - uScanProgress);
          float scanBeam = smoothstep(0.045, 0.0, scanDist);
          radarColor += cyanBright * scanBeam * 1.0;

          // Planetary Regolith / Chondrite Physical Reflectance
          float texNoise = noise3D(vPosition * 9.0);
          float microRough = noise3D(vPosition * 24.0) * 0.15;

          vec3 rockBase = vec3(0.08, 0.10, 0.13); // Carbonaceous chondrite
          if (uSurfaceType == 1) {
            rockBase = vec3(0.15, 0.17, 0.20); // Metallic nickel-iron
          } else if (uSurfaceType == 2) {
            rockBase = vec3(0.06, 0.08, 0.10); // Volatile carbon
          } else if (uSurfaceType == 5) {
            rockBase = vec3(0.07, 0.09, 0.11); // Ancient regolith
          }

          // Direct solar illumination + Earthshine fill
          vec3 rockLit = rockBase * (diff + ambient) + (texNoise * 0.03 - microRough * 0.02);
          rockLit += vec3(0.88, 0.96, 1.0) * spec * ((uSurfaceType == 1) ? 0.5 : 0.18);
          // Subtle aerospace Earthshine limb edge
          rockLit += cyanColor * limbLuminance * 0.22;

          vec3 finalColor = mix(radarColor, rockLit, uHover);
          float alpha = mix(0.60 + radarGrid * 0.25 + fresnel * 0.35 + scanBeam * 0.4, 0.98, uHover);

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });

    const asteroidMesh = new THREE.Mesh(baseGeo, asteroidMaterial);
    scene.add(asteroidMesh);

    // Holographic wireframe shell (Delay-Doppler shape model)
    const wireframeGeo = new THREE.WireframeGeometry(baseGeo);
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0x5ee2ff,
      transparent: true,
      opacity: 0.12,
    });
    const wireframeMesh = new THREE.LineSegments(wireframeGeo, wireframeMat);
    asteroidMesh.add(wireframeMesh);

    // Subtle Horizon Scattering (Tightly bound to limb)
    const glowGeo = new THREE.IcosahedronGeometry(baseRadius * 1.04, 3);
    const glowMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uHover: { value: 0 },
        uBaseRadius: { value: baseRadius },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float uHover;
        void main() {
          float intensity = pow(0.85 - dot(vNormal, vec3(0, 0, 1.0)), 4.0);
          vec3 glowColor = mix(vec3(0.10, 0.35, 0.55), vec3(0.20, 0.55, 0.75), uHover);
          gl_FragColor = vec4(glowColor, intensity * (0.16 + uHover * 0.12));
        }
      `,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    asteroidMesh.add(glowMesh);

    // ORBITAL PATH OF PRIMARY ASTEROID
    const a = parseFloat(asteroid.a || "1.8");
    const e = parseFloat(asteroid.e || "0.4");
    const incDeg = parseFloat(asteroid.i || "12");
    const incRad = (incDeg * Math.PI) / 180;

    const semiMajor = Math.min(Math.max(a * 4.0, 7.0), 16.0);
    const semiMinor = semiMajor * Math.sqrt(Math.max(0.01, 1 - e * e));
    const focalDist = semiMajor * e;

    const orbitPoints: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      const x = Math.cos(theta) * semiMajor - focalDist;
      const z = Math.sin(theta) * semiMinor;
      const y = z * Math.sin(incRad);
      const zRot = z * Math.cos(incRad);
      orbitPoints.push(new THREE.Vector3(x - semiMajor * 0.7, y, zRot));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({
      color: 0x7ddff2,
      transparent: true,
      opacity: 0.35,
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    scene.add(orbitLine);

    // =========================================================
    // SURROUNDING ASTEROIDS (BASED ON RELATIVE COORDINATES)
    // =========================================================
    const otherAsteroidsGroup = new THREE.Group();
    scene.add(otherAsteroidsGroup);

    // Common materials & geometries for surrounding asteroids
    const otherMeshRefs: {
      mesh: THREE.Mesh;
      targetData: AstraObject;
      worldPos: THREE.Vector3;
      distanceAU: number;
      isHazard: boolean;
    }[] = [];

    const currentOrigin = asteroid.position || { x: 0, y: 0, z: 0 };
    // Filter other asteroids
    const others = allAsteroids.filter((o) => o.spkid !== asteroid.spkid);

    // Scale factor: real coordinate units in astra_objects.json to 3D scene units relative to focused asteroid
    const relativeScale = 5.5;

    others.forEach((otherObj) => {
      const otherPos = otherObj.position || { x: 0, y: 0, z: 0 };
      const dx = otherPos.x - currentOrigin.x;
      const dy = otherPos.y - currentOrigin.y;
      const dz = otherPos.z - currentOrigin.z;

      const distAU = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distAU < 0.0001) return;

      // Map relative coordinates to 3D scene (x, y, z)
      const visualX = dx * relativeScale;
      const visualY = dy * relativeScale;
      const visualZ = dz * relativeScale;

      const otherRadius = Math.max(0.18, getVisualRadius(otherObj.diameter, otherObj.H) * 0.22);
      const isCritical = otherObj.pha === "Y" && otherObj.astra_score >= 115;
      const isHazard = otherObj.pha === "Y";

      // Irregular mini contact geometry
      const miniGeo = new THREE.DodecahedronGeometry(otherRadius, 1);
      const miniMat = new THREE.MeshStandardMaterial({
        color: isCritical ? 0xcc473b : isHazard ? 0xcf9330 : 0x5ee2ff,
        emissive: isCritical ? 0x40120e : isHazard ? 0x362208 : 0x0c2230,
        roughness: 0.65,
        metalness: 0.25,
        transparent: true,
        opacity: 0.85,
      });

      const miniMesh = new THREE.Mesh(miniGeo, miniMat);
      miniMesh.position.set(visualX, visualY, visualZ);

      // Add a subtle astronomical beacon halo to each nearby asteroid
      const haloGeo = new THREE.RingGeometry(otherRadius * 1.25, otherRadius * 1.45, 16);
      const haloMat = new THREE.MeshBasicMaterial({
        color: isHazard ? 0xcf9330 : 0x5ee2ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.25,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.lookAt(camera.position);
      miniMesh.add(halo);

      // Subtle dashed distance telemetry line towards primary asteroid
      const distLineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(-visualX, -visualY, -visualZ),
      ]);
      const distLineMat = new THREE.LineDashedMaterial({
        color: 0x5ee2ff,
        dashSize: 0.4,
        gapSize: 0.4,
        transparent: true,
        opacity: 0.10,
      });
      const distLine = new THREE.Line(distLineGeo, distLineMat);
      distLine.computeLineDistances();
      miniMesh.add(distLine);

      otherAsteroidsGroup.add(miniMesh);

      otherMeshRefs.push({
        mesh: miniMesh,
        targetData: otherObj,
        worldPos: new THREE.Vector3(visualX, visualY, visualZ),
        distanceAU: distAU,
        isHazard,
      });
    });

    // =========================================================
    // ADVANCED SPACECRAFT SPATIAL REFERENCE SYSTEM
    // =========================================================
    const gridLinePoints: THREE.Vector3[] = [];
    const gridPlaneY = -baseRadius - 1.2;

    // 1. Concentric Range Rings with high geometric fidelity
    const ringRadii = [
      baseRadius + 1.8,  // Inner clearance orbit
      baseRadius + 5.2,  // Proximal tracking zone
      baseRadius + 10.0, // Intermediate navigation ring
      baseRadius + 16.5, // Outer spatial boundary
      baseRadius + 24.5, // Deep-space telemetry fringe
    ];

    ringRadii.forEach((r) => {
      const ringSegments = 96;
      for (let i = 0; i < ringSegments; i++) {
        const theta1 = (i / ringSegments) * Math.PI * 2;
        const theta2 = ((i + 1) / ringSegments) * Math.PI * 2;
        gridLinePoints.push(
          new THREE.Vector3(Math.cos(theta1) * r, gridPlaneY, Math.sin(theta1) * r),
          new THREE.Vector3(Math.cos(theta2) * r, gridPlaneY, Math.sin(theta2) * r)
        );
      }
    });

    // 2. Radial Azimuth Navigation Lines (12 major spokes every 30 deg)
    const spokeCount = 12;
    const spokeInnerR = baseRadius + 1.8;
    const spokeOuterR = ringRadii[ringRadii.length - 1];
    for (let i = 0; i < spokeCount; i++) {
      const theta = (i / spokeCount) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      gridLinePoints.push(
        new THREE.Vector3(cosT * spokeInnerR, gridPlaneY, sinT * spokeInnerR),
        new THREE.Vector3(cosT * spokeOuterR, gridPlaneY, sinT * spokeOuterR)
      );
    }

    // 3. Sparse Measurement Ticks along Navigation Rings (10 deg subdivisions)
    [ringRadii[1], ringRadii[2]].forEach((r) => {
      const tickCount = 36;
      const tickLen = 0.32;
      for (let i = 0; i < tickCount; i++) {
        if (i % 3 === 0) continue; // Skip angles with existing major radial spokes
        const theta = (i / tickCount) * Math.PI * 2;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        gridLinePoints.push(
          new THREE.Vector3(cosT * (r - tickLen * 0.5), gridPlaneY, sinT * (r - tickLen * 0.5)),
          new THREE.Vector3(cosT * (r + tickLen * 0.5), gridPlaneY, sinT * (r + tickLen * 0.5))
        );
      }
    });

    // 4. Cardinal Distance Measurement Ticks along Primary X and Z Axes
    const cardinalTickSpacing = 2.4;
    for (let d = spokeInnerR + 1.0; d < spokeOuterR; d += cardinalTickSpacing) {
      const tickHalf = 0.28;
      // Along +X and -X
      gridLinePoints.push(
        new THREE.Vector3(d, gridPlaneY, -tickHalf),
        new THREE.Vector3(d, gridPlaneY, tickHalf),
        new THREE.Vector3(-d, gridPlaneY, -tickHalf),
        new THREE.Vector3(-d, gridPlaneY, tickHalf)
      );
      // Along +Z and -Z
      gridLinePoints.push(
        new THREE.Vector3(-tickHalf, gridPlaneY, d),
        new THREE.Vector3(tickHalf, gridPlaneY, d),
        new THREE.Vector3(-tickHalf, gridPlaneY, -d),
        new THREE.Vector3(tickHalf, gridPlaneY, -d)
      );
    }

    // 5. Vertical Spatial Depth Whiskers (3D elevation reference datum)
    [ringRadii[0], ringRadii[1]].forEach((r) => {
      const whiskerAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
      whiskerAngles.forEach((ang) => {
        const px = Math.cos(ang) * r;
        const pz = Math.sin(ang) * r;
        gridLinePoints.push(
          new THREE.Vector3(px, gridPlaneY - 0.35, pz),
          new THREE.Vector3(px, gridPlaneY + 0.55, pz)
        );
      });
    });

    // Central Normal Axis Line (Subtle rotational / normal vector reference)
    gridLinePoints.push(
      new THREE.Vector3(0, gridPlaneY - 0.8, 0),
      new THREE.Vector3(0, gridPlaneY + 0.8, 0)
    );

    const spatialGridGeo = new THREE.BufferGeometry().setFromPoints(gridLinePoints);

    // Custom Shader Material for Radial Distance Fading & Camera Depth Fading
    const spatialGridMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      uniforms: {
        uColor: { value: new THREE.Color(0x5ee2ff) },
        uSoftBlue: { value: new THREE.Color(0x4a7e9c) },
        uInnerRadius: { value: baseRadius + 1.2 },
        uMaxRadius: { value: spokeOuterR },
      },
      vertexShader: `
        varying float vRadialDist;
        varying float vViewZ;

        void main() {
          vRadialDist = length(position.xz);
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewZ = -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uSoftBlue;
        uniform float uInnerRadius;
        uniform float uMaxRadius;

        varying float vRadialDist;
        varying float vViewZ;

        void main() {
          // Smooth radial falloff with distance from asteroid
          float innerFade = smoothstep(uInnerRadius * 0.7, uInnerRadius * 1.3, vRadialDist);
          float outerFade = smoothstep(uMaxRadius + 3.0, uInnerRadius + 3.0, vRadialDist);
          float radialAlpha = innerFade * outerFade;

          // Camera depth attenuation
          float depthFade = clamp(1.0 - (vViewZ - 6.0) / 42.0, 0.08, 1.0);

          // Subtle blend from electric cyan near asteroid to soft deep blue outwards
          float colorMix = clamp((vRadialDist - uInnerRadius) / (uMaxRadius - uInnerRadius), 0.0, 1.0);
          vec3 finalColor = mix(uColor, uSoftBlue, colorMix * 0.75);

          // Very low, subtle opacity (never overpowers the asteroid)
          float alpha = radialAlpha * depthFade * 0.16;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
    });

    const spatialGridLines = new THREE.LineSegments(spatialGridGeo, spatialGridMat);
    scene.add(spatialGridLines);

    // Deep Space Astronomical Starfield (Fine pinprick stars)
    const starCount = 850;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 120;
      starPositions[i + 1] = (Math.random() - 0.5) * 120;
      starPositions[i + 2] = (Math.random() - 0.5) * 120;
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xd2e5f5,
      size: 0.38,
      transparent: true,
      opacity: 0.38,
    });
    const starParticles = new THREE.Points(starGeo, starMat);
    scene.add(starParticles);

    // LIGHTING: Direct Solar Illumination + Earthshine Fill
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight.position.set(14, 12, 10);
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x5ee2ff, 0.45);
    rimLight.position.set(-10, -5, -8);
    scene.add(rimLight);

    const ambLight = new THREE.AmbientLight(0x03060a, 0.35);
    scene.add(ambLight);

    // INTERACTION: Raycasting for Hover & Mouse Drag Orbit Controls
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let targetHover = 0.0;
    let currentHover = 0.0;

    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let camRadius = 9.5;
    let camTheta = 0.35;
    let camPhi = 0.25;
    let targetTheta = 0.35;
    let targetPhi = 0.25;
    let targetRadius = 9.5;

    function updateCameraPos() {
      camTheta += (targetTheta - camTheta) * 0.16;
      camPhi += (targetPhi - camPhi) * 0.16;
      camRadius += (targetRadius - camRadius) * 0.16;

      camPhi = Math.max(-1.4, Math.min(1.4, camPhi));

      const cx = camRadius * Math.cos(camPhi) * Math.sin(camTheta);
      const cy = camRadius * Math.sin(camPhi);
      const cz = camRadius * Math.cos(camPhi) * Math.cos(camTheta);

      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
    }

    const onPointerDown = (e: MouseEvent) => {
      if (e.button === 0) {
        isDragging = true;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
      }
    };

    const onPointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.x = x;
      mouse.y = y;

      if (isDragging) {
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;

        targetTheta -= deltaX * 0.007;
        targetPhi += deltaY * 0.007;
      }
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetRadius += e.deltaY * 0.006;
      targetRadius = Math.max(baseRadius * 1.8, Math.min(30, targetRadius));
    };

    let touchDist = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
      } else if (e.touches.length === 2) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging) {
        e.preventDefault();
        const deltaX = e.touches[0].clientX - prevMouseX;
        const deltaY = e.touches[0].clientY - prevMouseY;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;

        targetTheta -= deltaX * 0.007;
        targetPhi += deltaY * 0.007;
        
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const delta = touchDist - dist;
        targetRadius += delta * 0.03;
        targetRadius = Math.max(baseRadius * 1.8, Math.min(30, targetRadius));
        touchDist = dist;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        isDragging = false;
      } else if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
      }
    };

    container.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });
    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd);
    container.addEventListener("touchcancel", onTouchEnd);

    // RESIZE LISTENER
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth;
      height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // ANIMATION LOOP
    let animationFrameId: number;
    const clock = new THREE.Clock();
    let scanTimer = 0.0;

    // Pre-allocated vectors for zero-garbage-collection render loop
    const toPrimary = new THREE.Vector3();
    const primaryWorldPos = new THREE.Vector3();
    const toOther = new THREE.Vector3();
    const camForward = new THREE.Vector3();
    const projVec = new THREE.Vector3();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // 1. Slow rotation of primary asteroid on its axis
      asteroidMesh.rotation.y += 0.0035;
      asteroidMesh.rotation.x += 0.0012;
      asteroidMesh.updateMatrixWorld();

      // 2. Scan progress sweep animation
      scanTimer = (scanTimer + 0.006) % 1.0;
      uniforms.uScanProgress.value = scanTimer;
      uniforms.uTime.value = elapsedTime;

      // 3. Slow idle rotation of other asteroids & billboarding halos
      otherMeshRefs.forEach((item) => {
        item.mesh.rotation.y += 0.005;
        item.mesh.rotation.x += 0.003;
        const halo = item.mesh.children[0];
        if (halo) {
          halo.lookAt(camera.position);
        }
      });

      // 4. Update camera position & matrix FIRST before any projections
      updateCameraPos();

      // 5. Raycast asteroid hover check (surface reconstruction trigger)
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(asteroidMesh);
      targetHover = intersects.length > 0 ? 1.0 : 0.0;

      currentHover += (targetHover - currentHover) * 0.08;
      uniforms.uHover.value = currentHover;
      glowMat.uniforms.uHover.value = currentHover;
      wireframeMat.opacity = THREE.MathUtils.lerp(0.16, 0.04, currentHover);

      const reconstructed = currentHover > 0.35;
      if (reconstructed !== isReconstructedRef.current) {
        isReconstructedRef.current = reconstructed;
        setIsReconstructed(reconstructed);
      }

      if (primaryTagElRef.current) {
        primaryTagElRef.current.style.opacity = currentHover > 0.1 ? "1" : "0.85";
      }

      // 6. Camera directional & position parameters for projection & occlusion
      camera.getWorldDirection(camForward);
      const camPos = camera.position;
      const camPosLenSq = camPos.lengthSq();
      const occRadiusSq = (baseRadius * 1.08) * (baseRadius * 1.08);

      // 7. Directly synchronize primary asteroid floating HUD tag
      if (primaryTagAnchorRef.current) {
        primaryWorldPos.set(0, baseRadius * 1.15, 0);
        primaryWorldPos.applyMatrix4(asteroidMesh.matrixWorld);

        toPrimary.subVectors(primaryWorldPos, camPos);
        const inFront = toPrimary.dot(camForward) > 0;

        if (!inFront) {
          if (primaryTagAnchorRef.current.style.display !== "none") {
            primaryTagAnchorRef.current.style.display = "none";
          }
        } else {
          projVec.copy(primaryWorldPos).project(camera);
          const screenX = (projVec.x * 0.5 + 0.5) * width;
          const screenY = (-projVec.y * 0.5 + 0.5) * height;

          if (screenX < -100 || screenX > width + 100 || screenY < -100 || screenY > height + 100) {
            if (primaryTagAnchorRef.current.style.display !== "none") {
              primaryTagAnchorRef.current.style.display = "none";
            }
          } else {
            if (primaryTagAnchorRef.current.style.display !== "block") {
              primaryTagAnchorRef.current.style.display = "block";
            }
            primaryTagAnchorRef.current.style.transform = `translate3d(${screenX}px, ${screenY}px, 0)`;
          }
        }
      }

      // 8. Directly synchronize surrounding asteroids badges (zero React state / zero lag)
      for (let i = 0; i < otherMeshRefs.length; i++) {
        const refItem = otherMeshRefs[i];
        const el = badgeAnchorsRef.current.get(refItem.targetData.spkid);
        if (!el) continue;

        toOther.subVectors(refItem.worldPos, camPos);
        const distToTarget = toOther.length();
        if (distToTarget < 0.001) continue;

        // Behind camera check
        if (toOther.dot(camForward) <= 0) {
          if (el.style.display !== "none") el.style.display = "none";
          continue;
        }

        // Occlusion check by primary central asteroid
        const dirX = toOther.x / distToTarget;
        const dirY = toOther.y / distToTarget;
        const dirZ = toOther.z / distToTarget;
        const t = -(camPos.x * dirX + camPos.y * dirY + camPos.z * dirZ);

        if (t > 0 && t < distToTarget) {
          const perpSq = camPosLenSq - t * t;
          if (perpSq < occRadiusSq) {
            if (el.style.display !== "none") el.style.display = "none";
            continue;
          }
        }

        // Project 3D world pos to normalized screen coordinates
        projVec.copy(refItem.worldPos).project(camera);
        const sx = (projVec.x * 0.5 + 0.5) * width;
        const sy = (-projVec.y * 0.5 + 0.5) * height;

        // Boundary check to keep inside viewport
        if (sx < 25 || sx > width - 25 || sy < 25 || sy > height - 35) {
          if (el.style.display !== "none") el.style.display = "none";
          continue;
        }

        if (el.style.display !== "block") el.style.display = "block";
        el.style.transform = `translate3d(${sx}px, ${sy}px, 0)`;
        el.style.zIndex = String(Math.round(1000 - distToTarget));
      }

      // 9. Render 3D scene in the exact same frame
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      badgeAnchorsRef.current.clear();
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
      baseGeo.dispose();
      wireframeGeo.dispose();
      glowGeo.dispose();
      asteroidMaterial.dispose();
      wireframeMat.dispose();
      glowMat.dispose();
      spatialGridGeo.dispose();
      spatialGridMat.dispose();
    };
  }, [
    asteroid.spkid,
    asteroid.diameter,
    asteroid.H,
    asteroid.a,
    asteroid.e,
    asteroid.i,
    asteroid.position,
    allAsteroids,
  ]);

  const surfaceTypeNames = [
    "ROCKY SILICATE",
    "METALLIC (FE-NI)",
    "FRACTURED VOLATILE",
    "POROUS AGGREGATE",
    "DENSE BASALTIC",
    "ANCIENT REGOLITH",
  ];
  const typeIndex = (Math.abs(asteroid.spkid) || 0) % 6;

  return (
    <div className="asteroid-3d-orbit-viewer">
      {/* Three.js canvas container */}
      <div ref={containerRef} className="orbit-canvas-viewport" />

      {/* Floating 3D Diameter Pin attached to Primary Asteroid (Directly synchronized) */}
      <div
        ref={primaryTagAnchorRef}
        className="floating-label-anchor primary-anchor"
        style={{ display: "none" }}
      >
        <div ref={primaryTagElRef} className="asteroid-floating-tag primary-asteroid-tag">
          <div className="tag-anchor-line" />
          <div className="tag-content">
            <span className="tag-title">TARGET FOCUS</span>
            <span className="tag-value">
              {asteroid.name || asteroid.pdes} ({formatDiameter(asteroid.diameter, asteroid.H)})
            </span>
          </div>
        </div>
      </div>

      {/* Floating badges for surrounding asteroids in relative 3D space (Directly synchronized) */}
      {others.map((other) => (
        <div
          key={other.spkid}
          ref={(el) => {
            if (el) badgeAnchorsRef.current.set(other.spkid, el);
            else badgeAnchorsRef.current.delete(other.spkid);
          }}
          className="floating-label-anchor"
          style={{ display: "none" }}
        >
          <div
            className={`nearby-asteroid-badge ${other.isHazard ? "hazard" : ""}`}
            onClick={() => onSelectAsteroid && onSelectAsteroid(other)}
            title={`Select ${other.name || other.pdes}`}
          >
            <span className="nearby-badge-dot" />
            <div className="nearby-badge-content">
              <span className="nearby-badge-name">
                {other.name || other.pdes}
              </span>
              <span className="nearby-badge-dist">
                Δ {other.distanceAU.toFixed(2)} AU
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* ASTRA Technical Scan Overlay State */}
      <div className="orbit-scan-status-overlay">
        <div className="scan-badge">
          <span
            className={`scan-led ${scanStep === "COMPLETE" ? "active" : "pulsing"
              }`}
          />
          <span className="scan-text">
            {scanStep === "ACQUIRED" && "OBJECT ACQUIRED"}
            {scanStep === "SCANNING" && "SCANNING SURFACE..."}
            {scanStep === "COMPLETE" &&
              (isReconstructed
                ? "SURFACE RECONSTRUCTION ACTIVE"
                : "RADAR TELEMETRY READY")}
          </span>
        </div>

        <div className="interaction-hint">
          {!isReconstructed ? (
            <span>HOVER OBJECT TO RECONSTRUCT 3D SURFACE</span>
          ) : (
            <span className="text-cyan">
              SPECIMEN: {surfaceTypeNames[typeIndex]}
            </span>
          )}
        </div>
      </div>

      {/* Scientific Camera Drag Notice */}
      <div className="orbit-controls-hint">
        <span>LEFT DRAG TO ORBIT • SCROLL TO ZOOM • CLICK NEARBY OBJECT TO SWITCH</span>
      </div>
    </div>
  );
};

export default AsteroidOrbitViewer;
