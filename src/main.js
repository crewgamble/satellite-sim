import * as THREE from "three";

/* ---------------------------
   Page + root styling
---------------------------- */
const app = document.getElementById("app");

document.documentElement.style.margin = "0";
document.documentElement.style.padding = "0";
document.documentElement.style.height = "100%";
document.documentElement.style.overflow = "hidden";

document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.height = "100%";
document.body.style.overflow = "hidden";

app.style.width = "100vw";
app.style.height = "100vh";
app.style.margin = "0";
app.style.padding = "0";

/* ---------------------------
   UI
---------------------------- */
app.innerHTML = `
  <div id="ui" style="position:fixed; top:12px; left:12px; background:#111; color:#fff; padding:12px; border-radius:10px; font-family:system-ui; z-index:10; width:260px;">
    <div style="font-weight:700; margin-bottom:8px;">Mini Satellite Orbit Sim</div>

    <label>Speed <span id="speedVal">1.0</span>x</label>
    <input id="speed" type="range" min="0" max="5" step="0.1" value="1" style="width:100%;" />

    <label style="display:block; margin-top:8px;">Altitude <span id="altVal">2.5</span></label>
    <input id="alt" type="range" min="1.8" max="5.0" step="0.1" value="2.5" style="width:100%;" />

    <button id="pause" style="margin-top:10px; width:100%; padding:8px; border-radius:8px; border:0; cursor:pointer;">Pause</button>

    <button id="fail1" style="margin-top:10px; width:100%; padding:8px; border-radius:8px; border:0; cursor:pointer;">
      Toggle Sat 1 State
    </button>
    <div id="state1" style="margin-top:6px; font-size:12px;">Sat 1: ACTIVE</div>

    <button id="fail2" style="margin-top:10px; width:100%; padding:8px; border-radius:8px; border:0; cursor:pointer;">
      Toggle Sat 2 State
    </button>
    <div id="state2" style="margin-top:6px; font-size:12px;">Sat 2: ACTIVE</div>

    <button id="reset" style="margin-top:10px; width:100%; padding:8px; border-radius:8px; border:0; cursor:pointer;">
      Reset Simulation
    </button>

    <div style="display:flex; gap:6px; margin-top:10px;">
      <button class="ts" data-ts="0.5" style="flex:1; padding:8px; border-radius:8px; border:0; cursor:pointer;">0.5x</button>
      <button class="ts" data-ts="1"   style="flex:1; padding:8px; border-radius:8px; border:0; cursor:pointer;">1x</button>
      <button class="ts" data-ts="2"   style="flex:1; padding:8px; border-radius:8px; border:0; cursor:pointer;">2x</button>
      <button class="ts" data-ts="5"   style="flex:1; padding:8px; border-radius:8px; border:0; cursor:pointer;">5x</button>
    </div>

    <div id="contact1" style="margin-top:10px; font-size:12px;">Sat 1 Contact: --</div>
    <div id="contact2" style="margin-top:4px; font-size:12px;">Sat 2 Contact: --</div>
    <div id="isl" style="margin-top:8px; font-size:12px;">ISL: --</div>
    <div id="coverage" style="margin-top:4px; font-size:12px;">Coverage (30s): --</div>

    <div style="margin-top:10px; opacity:0.8; font-size:12px;">
      Tip: drag canvas to rotate, scroll canvas to zoom
    </div>
  </div>

  <canvas id="c" style="display:block; width:100vw; height:100vh;"></canvas>
`;

const ui = document.getElementById("ui");
["mousedown", "mousemove", "mouseup", "wheel", "pointerdown"].forEach((evt) => {
  ui.addEventListener(evt, (e) => e.stopPropagation());
});

const canvas = document.getElementById("c");
const speedSlider = document.getElementById("speed");
const altSlider = document.getElementById("alt");
const speedVal = document.getElementById("speedVal");
const altVal = document.getElementById("altVal");
const pauseBtn = document.getElementById("pause");
const contact1El = document.getElementById("contact1");
const contact2El = document.getElementById("contact2");
const islEl = document.getElementById("isl");
const coverageEl = document.getElementById("coverage");
const state1El = document.getElementById("state1");
const state2El = document.getElementById("state2");

/* ---------------------------
   Simulation enums + helpers
---------------------------- */
const SatState = {
  ACTIVE: "ACTIVE",
  DEGRADED: "DEGRADED",
  FAILED: "FAILED",
};

function nextState(state) {
  if (state === SatState.ACTIVE) return SatState.DEGRADED;
  if (state === SatState.DEGRADED) return SatState.FAILED;
  return SatState.ACTIVE;
}

function stateSpeedFactor(state) {
  if (state === SatState.DEGRADED) return 0.3;
  if (state === SatState.FAILED) return 0.0;
  return 1.0;
}

/* ---------------------------
   Three.js scene
---------------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// Camera controls state
let isDragging = false;
let prev = { x: 0, y: 0 };
let yaw = 0;
let pitch = 0.25;
let distance = 12;

function updateCamera() {
  const x = distance * Math.cos(pitch) * Math.sin(yaw);
  const y = distance * Math.sin(pitch);
  const z = distance * Math.cos(pitch) * Math.cos(yaw);
  camera.position.set(x, y, z);
  camera.lookAt(0, 0, 0);
}
updateCamera();

// IMPORTANT: listen on CANVAS, not window (avoids UI interference)
canvas.addEventListener("mousedown", (e) => {
  isDragging = true;
  prev = { x: e.clientX, y: e.clientY };
});
window.addEventListener("mouseup", () => (isDragging = false));
canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = (e.clientX - prev.x) * 0.005;
  const dy = (e.clientY - prev.y) * 0.005;
  prev = { x: e.clientX, y: e.clientY };
  yaw -= dx;
  pitch = Math.max(-1.2, Math.min(1.2, pitch - dy));
  updateCamera();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault(); // prevent page scroll / bounce
    distance = Math.max(4, Math.min(40, distance + e.deltaY * 0.01));
    updateCamera();
  },
  { passive: false }
);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(5, 8, 5);
scene.add(dir);

// Earth
const EARTH_RADIUS = 1.5;
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS, 64, 64),
  new THREE.MeshStandardMaterial({ color: 0x1d5cff, roughness: 0.8 })
);
scene.add(earth);

// Ground station (attached to Earth so it rotates with Earth)
const station = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0x330000 })
);
earth.add(station);
station.position.set(EARTH_RADIUS, 0, 0);

// Stars
{
  const starGeom = new THREE.BufferGeometry();
  const starCount = 1500;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3 + 0] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 1] = (Math.random() - 0.5) * 400;
    starPos[i * 3 + 2] = (Math.random() - 0.5) * 400;
  }
  starGeom.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ size: 0.6 })));
}

// Orbit ring
let orbitRadius = Number(altSlider.value);
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(orbitRadius, 0.02, 16, 200),
  new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x222222 })
);
ring.rotation.x = Math.PI / 2;
scene.add(ring);

// Satellite factory
function makeSat(color) {
  const g = new THREE.SphereGeometry(0.08, 16, 16);
  const m = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(0x00ff00),
    emissiveIntensity: 0.8,
  });
  const sat = new THREE.Mesh(g, m);
  scene.add(sat);
  return sat;
}

// Satellite visuals
function updateSatColor(sat, state) {
  if (state === SatState.ACTIVE) {
    sat.material.emissive.set(0x00ff00);
    sat.material.color.set(0x00ff00);
    sat.material.emissiveIntensity = 0.9;
  } else if (state === SatState.DEGRADED) {
    sat.material.emissive.set(0xffaa00);
    sat.material.color.set(0xffaa00);
    sat.material.emissiveIntensity = 0.8;
  } else {
    sat.material.emissive.set(0xff0000);
    sat.material.color.set(0xff0000);
    sat.material.emissiveIntensity = 0.6;
  }
}

/* ---------------------------
   Satellites array (data-driven)
---------------------------- */
const satellites = [
  {
    id: 1,
    name: "Sat 1",
    mesh: makeSat(0xffcc00),
    state: SatState.ACTIVE,
    mode: "equatorial",
    phase: 0.0,
    baseRate: 1.0,
  },
  {
    id: 2,
    name: "Sat 2",
    mesh: makeSat(0x00ffcc),
    state: SatState.ACTIVE,
    mode: "inclined",
    phase: 1.0,
    baseRate: 0.8,
    inc: 0.6,
  },
];

satellites.forEach((s) => updateSatColor(s.mesh, s.state));

// ISL line visualization (updated each frame)
const islGeom = new THREE.BufferGeometry();
islGeom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
const islLine = new THREE.Line(
  islGeom,
  new THREE.LineBasicMaterial({ color: 0x66ffcc })
);
islLine.visible = false;
scene.add(islLine);


/* ---------------------------
   Contact / coverage
---------------------------- */
function hasLineOfSight(satPos, stationPosWorld) {
  // Normalize direction vectors from origin
  const toSat = satPos.clone().normalize();
  const toStation = stationPosWorld.clone().normalize();

  // > 0 means same hemisphere; threshold approximates horizon cutoff
  const horizonThreshold = 0.15;
  return toSat.dot(toStation) > horizonThreshold;
}

function hasEarthClearLine(a, b, earthRadius) {
  // Returns true if the line segment from a->b does NOT pass through the Earth sphere.
  // Using closest approach from origin to the segment.
  const ab = b.clone().sub(a);
  const abLen2 = ab.lengthSq();
  if (abLen2 === 0) return true;

  // Project point O(0,0,0) onto segment a->b
  const t = -a.dot(ab) / abLen2; // since O-a = -a
  const tClamped = Math.max(0, Math.min(1, t));
  const closest = a.clone().add(ab.multiplyScalar(tClamped));

  // If closest point is inside Earth -> blocked
  return closest.length() > earthRadius;
}


const stationWorld = new THREE.Vector3();

// Rolling coverage window
const COVERAGE_WINDOW_SEC = 30;
let contactSamples = []; // { dt, contact }


/* ---------------------------
   UI wiring
---------------------------- */
let paused = false;
let t = 0;

speedSlider.addEventListener("input", () => {
  speedVal.textContent = Number(speedSlider.value).toFixed(1);
});

altSlider.addEventListener("input", () => {
  orbitRadius = Number(altSlider.value);
  altVal.textContent = orbitRadius.toFixed(1);

  ring.geometry.dispose();
  ring.geometry = new THREE.TorusGeometry(orbitRadius, 0.02, 16, 200);
});

pauseBtn.addEventListener("click", () => {
  paused = !paused;
  pauseBtn.textContent = paused ? "Resume" : "Pause";
});

// Speed presets
document.querySelectorAll(".ts").forEach((btn) => {
  btn.addEventListener("click", () => {
    const ts = Number(btn.dataset.ts);
    speedSlider.value = String(ts);
    speedVal.textContent = ts.toFixed(1);
  });
});

// Toggle state buttons
document.getElementById("fail1").addEventListener("click", () => {
  const s = satellites.find((x) => x.id === 1);
  s.state = nextState(s.state);
  updateSatColor(s.mesh, s.state);
  state1El.textContent = `Sat 1: ${s.state}`;
});

document.getElementById("fail2").addEventListener("click", () => {
  const s = satellites.find((x) => x.id === 2);
  s.state = nextState(s.state);
  updateSatColor(s.mesh, s.state);
  state2El.textContent = `Sat 2: ${s.state}`;
});

// Reset
document.getElementById("reset").addEventListener("click", () => {
  paused = false;
  pauseBtn.textContent = "Pause";
  t = 0;
  contactSamples = [];

  for (const s of satellites) {
    s.state = SatState.ACTIVE;
    updateSatColor(s.mesh, s.state);
  }
  state1El.textContent = `Sat 1: ${satellites.find((x) => x.id === 1).state}`;
  state2El.textContent = `Sat 2: ${satellites.find((x) => x.id === 2).state}`;
});

/* ---------------------------
   Main loop
---------------------------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const speed = Number(speedSlider.value);
  if (!paused) t += dt * speed;

  earth.rotation.y += dt * 0.15;

  // Update satellites
  for (const s of satellites) {
    const factor = stateSpeedFactor(s.state);
    if (factor === 0) continue;

    const rate = s.baseRate * factor;

    if (s.mode === "equatorial") {
      s.mesh.position.set(
        Math.cos(t * rate + s.phase) * orbitRadius,
        0,
        Math.sin(t * rate + s.phase) * orbitRadius
      );
    } else if (s.mode === "inclined") {
      const inc = s.inc ?? 0.6;
      s.mesh.position.set(
        Math.cos(t * rate + s.phase) * orbitRadius,
        Math.sin(t * rate + s.phase) * orbitRadius * Math.sin(inc),
        Math.sin(t * rate + s.phase) * orbitRadius * Math.cos(inc)
      );
    }
  }

  // --- Ground station contact for BOTH sats ---
  station.getWorldPosition(stationWorld);

  const sat1Obj = satellites.find(s => s.id === 1);
  const sat2Obj = satellites.find(s => s.id === 2);

  const sat1Contact =
    sat1Obj.state !== SatState.FAILED &&
    hasLineOfSight(sat1Obj.mesh.position, stationWorld);

  const sat2Contact =
    sat2Obj.state !== SatState.FAILED &&
    hasLineOfSight(sat2Obj.mesh.position, stationWorld);

  contact1El.textContent = `Sat 1 Contact: ${sat1Contact ? "IN CONTACT" : "NO CONTACT"}`;
  contact2El.textContent = `Sat 2 Contact: ${sat2Contact ? "IN CONTACT" : "NO CONTACT"}`;

  // --- ISL UP/DOWN ---
  const ISL_MAX_DIST = 6.0;
  const d12 = sat1Obj.mesh.position.distanceTo(sat2Obj.mesh.position);

  const occlusionOk = hasEarthClearLine(
    sat1Obj.mesh.position,
    sat2Obj.mesh.position,
    EARTH_RADIUS
  );

  const islUp =
    sat1Obj.state !== SatState.FAILED &&
    sat2Obj.state !== SatState.FAILED &&
    d12 <= ISL_MAX_DIST &&
    occlusionOk;

  islEl.textContent = `ISL: ${islUp ? "UP" : "DOWN"} (d=${d12.toFixed(2)})`;

  islLine.visible = islUp;
  if (islUp) {
    const posAttr = islLine.geometry.getAttribute("position");
    posAttr.setXYZ(0, sat1Obj.mesh.position.x, sat1Obj.mesh.position.y, sat1Obj.mesh.position.z);
    posAttr.setXYZ(1, sat2Obj.mesh.position.x, sat2Obj.mesh.position.y, sat2Obj.mesh.position.z);
    posAttr.needsUpdate = true;
  }

  const networkContact =
  sat1Contact ||
  sat2Contact ||
  (islUp && sat1Contact); // sat2 relays via sat1 when sat1 has ground contact


  // --- Coverage (Sat 1 only) ---
  if (!paused && sat1Obj.state !== SatState.FAILED) {
    contactSamples.push({ dt, contact: networkContact });

    let sum = 0;
    for (let i = contactSamples.length - 1; i >= 0; i--) {
      sum += contactSamples[i].dt;
      if (sum > COVERAGE_WINDOW_SEC) {
        contactSamples = contactSamples.slice(i);
        break;
      }
    }

    let total = 0;
    let contactTotal = 0;
    for (const s of contactSamples) {
      total += s.dt;
      if (s.contact) contactTotal += s.dt;
    }
    const pct = total > 0 ? (contactTotal / total) * 100 : 0;
    coverageEl.textContent = `Network Coverage (${COVERAGE_WINDOW_SEC}s): ${pct.toFixed(1)}%`;
    islEl.textContent = `ISL: ${islUp ? "UP" : "DOWN"} | Network: ${networkContact ? "REACHABLE" : "DOWN"}`;
  } else if (sat1Obj.state === SatState.FAILED) {
    coverageEl.textContent = `Coverage (${COVERAGE_WINDOW_SEC}s): 0.0%`;
  }

  renderer.render(scene, camera);
}
animate();


// Resize
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
