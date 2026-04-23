import { useState } from "react";

// ─── Constantes de sala ───────────────────────────────────────────────────────
const ROOM_W = 6.85;
const ROOM_D = 11.40;
const PAD    = 52;
const SCALE  = 57;

const toSvg = (x, y) => ({ sx: PAD + x * SCALE, sy: PAD + y * SCALE });
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// ─── Mesa ─────────────────────────────────────────────────────────────────────
const TW = 1.30;
const TL = 8.70;
const TX = (ROOM_W - TW) / 2;
const TY = 1.40;

// ─── Sillas ───────────────────────────────────────────────────────────────────
function makeSeats() {
  const seats = [];
  const nSide = 10;
  const sp = TL / (nSide + 1);
  for (let i = 1; i <= nSide; i++) {
    const sy = TY + i * sp;
    seats.push({ x: TX - 0.52, y: sy });
    seats.push({ x: TX + TW + 0.52, y: sy });
  }
  seats.push({ x: TX + TW / 2 - 0.38, y: TY - 0.52 });
  seats.push({ x: TX + TW / 2 + 0.38, y: TY - 0.52 });
  seats.push({ x: TX + TW / 2 - 0.38, y: TY + TL + 0.52 });
  seats.push({ x: TX + TW / 2 + 0.38, y: TY + TL + 0.52 });
  return seats;
}
const SEATS = makeSeats();

// ─── Vista Lateral ────────────────────────────────────────────────────────────
const ROOM_H = 3.0;   // altura sala (m)
const LPAD   = 52;
const LSX    = 57;    // escala horizontal px/m (igual al plano)
const LSY    = 80;    // escala vertical px/m (exagerada para ver altura)
// ry = posición en profundidad (0=Norte, ROOM_D=Sur), h = altura desde piso
const toLat = (ry, h) => ({ lx: LPAD + ry * LSX, ly: LPAD + (ROOM_H - h) * LSY });

// ─── Cámaras iniciales ────────────────────────────────────────────────────────
const CAMERAS_INIT = [
  { id: 1, x: 1.30, y: 11.25, dir: -Math.PI / 2, color: "#FF6B35", label: "CAM 1" },
  { id: 2, x: 5.55, y: 11.25, dir: -Math.PI / 2, color: "#4ECDC4", label: "CAM 2" },
  { id: 3, x: 1.30, y: 0.30,  dir:  Math.PI / 2, color: "#A855F7", label: "CAM 3" },
  { id: 4, x: 5.55, y: 0.30,  dir:  Math.PI / 2, color: "#F59E0B", label: "CAM 4" },
];

// ─── Presets de zoom ──────────────────────────────────────────────────────────
const PRESETS = [
  { id: 0, label: "Vista General",  zoom: 1,  fov: 60.0, fill: "rgba(255,80,50,0.28)",  stroke: "rgba(255,80,50,0.95)",  dot: "#ff5032" },
  { id: 1, label: "Vista de Grupo", zoom: 4,  fov: 17.0, fill: "rgba(50,220,100,0.28)", stroke: "rgba(50,220,100,0.95)", dot: "#32dc64" },
  { id: 2, label: "Dos Personas",   zoom: 8,  fov: 8.5,  fill: "rgba(80,130,255,0.30)", stroke: "rgba(80,130,255,0.95)", dot: "#5082ff" },
  { id: 3, label: "Una Persona",    zoom: 16, fov: 4.0,  fill: "rgba(255,200,0,0.32)",  stroke: "rgba(255,200,0,0.95)",  dot: "#ffc800" },
];

// Direcciones cardinales (en coordenadas SVG: Y crece hacia abajo)
const DIRS = [
  { label: "↑ Norte", dir: -Math.PI / 2 },
  { label: "↓ Sur",   dir:  Math.PI / 2 },
  { label: "← Oeste", dir:  Math.PI      },
  { label: "→ Este",  dir:  0            },
];

// ─── Geometría ────────────────────────────────────────────────────────────────
function rayToWall(ox, oy, angle) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let t = 2000;
  const candidates = [
    dy < -1e-9 ? (0 - oy) / dy       : Infinity,
    dy >  1e-9 ? (ROOM_D - oy) / dy  : Infinity,
    dx < -1e-9 ? (0 - ox) / dx       : Infinity,
    dx >  1e-9 ? (ROOM_W - ox) / dx  : Infinity,
  ];
  for (const s of candidates) {
    if (s > 1e-9 && s < t) {
      const xi = ox + dx * s, yi = oy + dy * s;
      if (xi >= -0.01 && xi <= ROOM_W + 0.01 && yi >= -0.01 && yi <= ROOM_D + 0.01) t = s;
    }
  }
  return { x: ox + dx * t, y: oy + dy * t };
}

function buildCone(cam, fovDeg) {
  const half = (fovDeg * Math.PI) / 360;
  const N = 40;
  const pts = [{ x: cam.x, y: cam.y }];
  for (let i = 0; i <= N; i++) {
    const a = (cam.dir - half) + (2 * half * i) / N;
    pts.push(rayToWall(cam.x, cam.y, a));
  }
  return pts.map(p => { const { sx, sy } = toSvg(p.x, p.y); return `${sx},${sy}`; }).join(" ");
}

function coverageAt(fovDeg, dist) {
  return (2 * dist * Math.tan((fovDeg * Math.PI) / 360)).toFixed(2);
}

// Lanza un rayo en el plano lateral (ry=profundidad, h=altura) y devuelve dónde toca la pared
function rayToWallLat(ry0, h0, angRad) {
  const dx = Math.cos(angRad), dy = Math.sin(angRad);
  let t = 2000;
  const cands = [
    dy < -1e-9 ? -h0 / dy : Infinity,
    dy >  1e-9 ? (ROOM_H - h0) / dy : Infinity,
    dx < -1e-9 ? -ry0 / dx : Infinity,
    dx >  1e-9 ? (ROOM_D - ry0) / dx : Infinity,
  ];
  for (const s of cands) if (s > 1e-9 && s < t) t = s;
  return { ry: clamp(ry0 + dx * t, 0, ROOM_D), h: clamp(h0 + dy * t, 0, ROOM_H) };
}

// FOV vertical a partir del FOV horizontal (sensor 16:9)
const toVFOV = (hFov) => (2 * Math.atan(Math.tan((hFov * Math.PI) / 360) * (9 / 16)) * 180 / Math.PI);

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ConferenceRoomSim() {
  const [activeCams,    setActiveCams]    = useState([1, 2, 3, 4]);
  const [activePresets, setActivePresets] = useState([0]);
  const [cameras,       setCameras]       = useState(CAMERAS_INIT);
  const [selectedCam,   setSelectedCam]   = useState(null);
  // Inputs temporales para coordenadas (como strings para permitir escritura libre)
  const [coordInputs,   setCoordInputs]   = useState({
    1: { x: "1.30", y: "11.25" },
    2: { x: "5.55", y: "11.25" },
    3: { x: "1.30", y: "0.30"  },
    4: { x: "5.55", y: "0.30"  },
  });
  const [camHeight, setCamHeight] = useState(2.4); // altura montaje cámara (m)
  const [tilt,      setTilt]      = useState(-12);  // inclinación vertical cámara (grados)

  const toggleCam    = id => setActiveCams(p    => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const togglePreset = id => setActivePresets(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const panCamera = (camId, deltaDeg) => {
    setCameras(prev => prev.map(c =>
      c.id === camId ? { ...c, dir: c.dir + (deltaDeg * Math.PI) / 180 } : c
    ));
  };

  const setDirection = (camId, dir) => {
    setCameras(prev => prev.map(c => c.id === camId ? { ...c, dir } : c));
  };

  // Actualizar coordenada del input (string temporal)
  const handleCoordChange = (camId, axis, value) => {
    setCoordInputs(prev => ({ ...prev, [camId]: { ...prev[camId], [axis]: value } }));
  };

  // Aplicar coordenadas al soltar el campo o presionar Enter
  const applyCoords = (camId) => {
    const raw = coordInputs[camId];
    const x = clamp(parseFloat(raw.x) || 0, 0.01, ROOM_W - 0.01);
    const y = clamp(parseFloat(raw.y) || 0, 0.01, ROOM_D - 0.01);
    // Corregir inputs con el valor clampado
    setCoordInputs(prev => ({ ...prev, [camId]: { x: x.toFixed(2), y: y.toFixed(2) } }));
    setCameras(prev => prev.map(c => c.id === camId ? { ...c, x, y } : c));
  };

  const svgW = PAD * 2 + ROOM_W * SCALE;
  const svgH = PAD * 2 + ROOM_D * SCALE;

  const inputStyle = {
    width: "64px", padding: "5px 7px", borderRadius: 5, fontSize: 13, fontWeight: 700,
    background: "#0d1117", border: "1.5px solid #30363d", color: "#c9d1d9",
    outline: "none", textAlign: "center",
  };

  const BtnStyle = (active, color) => ({
    display: "flex", alignItems: "center", gap: 8, width: "100%",
    marginBottom: 8, padding: "8px 12px", borderRadius: 6, cursor: "pointer",
    background: active ? `${color}22` : "transparent",
    border: `1.5px solid ${active ? color : "#30363d"}`,
    color: active ? "#e0e0e0" : "#6e7681",
    fontSize: 13, fontWeight: 600, textAlign: "left", transition: "all 0.15s",
  });

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", padding: 24, fontFamily: "'Segoe UI', Arial, sans-serif", color: "#e0e0e0" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h1 style={{ color: "#c9d1d9", margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>
          🏢 Sala de Reuniones 1 — Simulación 4 Cámaras
        </h1>
        <p style={{ color: "#8b949e", fontSize: 13, margin: 0 }}>
          Q-SYS NC-20×60 · 4 cámaras · Sala {ROOM_W} × {ROOM_D} m · Origen (0,0) = esquina NO
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, justifyContent: "center", alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* ──── Plano SVG ──────────────────────────────────────────────── */}
        <div style={{ background: "#161b22", borderRadius: 14, padding: 10, border: "1px solid #30363d", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <svg width={svgW} height={svgH}>
            <defs>
              <pattern id="grid" width={SCALE} height={SCALE} patternUnits="userSpaceOnUse" x={PAD} y={PAD}>
                <path d={`M ${SCALE} 0 L 0 0 0 ${SCALE}`} fill="none" stroke="#1e2530" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* Piso */}
            <rect x={PAD} y={PAD} width={ROOM_W * SCALE} height={ROOM_D * SCALE} fill="#161d2b" stroke="#3b76c4" strokeWidth={2} />
            <rect x={PAD} y={PAD} width={ROOM_W * SCALE} height={ROOM_D * SCALE} fill="url(#grid)" />

            {/* Etiquetas de paredes */}
            <text x={PAD + ROOM_W * SCALE / 2} y={PAD - 5} textAnchor="middle" fill="#2d4a7a" fontSize={9} fontWeight={600}>PARED NORTE (Y=0)</text>
            <text x={PAD + ROOM_W * SCALE / 2} y={PAD + ROOM_D * SCALE + 15} textAnchor="middle" fill="#2d4a7a" fontSize={9} fontWeight={600}>PARED SUR (Y={ROOM_D})</text>
            <text x={PAD - 10} y={PAD + ROOM_D * SCALE / 2} textAnchor="middle" fill="#2d4a7a" fontSize={9} fontWeight={600}
              transform={`rotate(-90, ${PAD - 10}, ${PAD + ROOM_D * SCALE / 2})`}>OESTE (X=0)</text>
            <text x={PAD + ROOM_W * SCALE + 12} y={PAD + ROOM_D * SCALE / 2} textAnchor="middle" fill="#2d4a7a" fontSize={9} fontWeight={600}
              transform={`rotate(90, ${PAD + ROOM_W * SCALE + 12}, ${PAD + ROOM_D * SCALE / 2})`}>ESTE (X={ROOM_W})</text>

            {/* Origen (0,0) */}
            <circle cx={PAD} cy={PAD} r={4} fill="#ffc800" opacity={0.7} />
            <text x={PAD + 6} y={PAD + 12} fill="#ffc800" fontSize={9} fontWeight={700} opacity={0.8}>(0,0)</text>

            {/* Pantalla norte */}
            {(() => {
              const sw = 2.80;
              const { sx, sy } = toSvg((ROOM_W - sw) / 2, 0.04);
              return (
                <g>
                  <rect x={sx} y={sy} width={sw * SCALE} height={0.11 * SCALE} fill="#1f3a6e" stroke="#388bfd" strokeWidth={2} rx={4} />
                  <text x={sx + sw * SCALE / 2} y={sy + 0.11 * SCALE / 2 + 4} textAnchor="middle" fill="#79c0ff" fontSize={9.5} fontWeight={700}>
                    ◼ PANTALLA + CÁMARA FRONTAL
                  </text>
                </g>
              );
            })()}

            {/* Mesa */}
            {(() => {
              const { sx, sy } = toSvg(TX, TY);
              return (
                <g>
                  <rect x={sx} y={sy} width={TW * SCALE} height={TL * SCALE} fill="#221508" stroke="#7d5a2f" strokeWidth={2.5} rx={5} />
                  {[1, 2, 3, 4].map(i => {
                    const ys = sy + (TL * SCALE * i) / 5;
                    return <line key={i} x1={sx + 6} y1={ys} x2={sx + TW * SCALE - 6} y2={ys} stroke="#3a2510" strokeWidth={1} />;
                  })}
                  <text x={sx + TW * SCALE / 2} y={sy + TL * SCALE / 2 + 5} textAnchor="middle" fill="#6b4c26"
                    fontSize={10} fontWeight={700} transform={`rotate(-90, ${sx + TW * SCALE / 2}, ${sy + TL * SCALE / 2})`}>MESA</text>
                </g>
              );
            })()}

            {/* Sillas */}
            {SEATS.map((s, i) => {
              const { sx, sy } = toSvg(s.x, s.y);
              return (
                <g key={i}>
                  <rect x={sx - 7} y={sy - 7} width={14} height={14} fill="#1c3554" stroke="#3d7abf" strokeWidth={1.5} rx={3} />
                  <rect x={sx - 4} y={sy - 4} width={8} height={8} fill="#234873" rx={2} />
                </g>
              );
            })}

            {/* ── Conos FOV (sobre el mobiliario) ── */}
            {cameras.map(cam => {
              if (!activeCams.includes(cam.id)) return null;
              return activePresets.map(pid => {
                const p = PRESETS.find(x => x.id === pid);
                if (!p) return null;
                return (
                  <polygon key={`cone-${cam.id}-${pid}`}
                    points={buildCone(cam, p.fov)}
                    fill={p.fill} stroke={p.stroke} strokeWidth={1.5} />
                );
              });
            })}

            {/* ── Iconos de cámara ── */}
            {cameras.map(cam => {
              if (!activeCams.includes(cam.id)) return null;
              const { sx, sy } = toSvg(cam.x, cam.y);
              const isSelected = selectedCam === cam.id;
              return (
                <g key={`cam-${cam.id}`} onClick={() => setSelectedCam(selectedCam === cam.id ? null : cam.id)} style={{ cursor: "pointer" }}>
                  {isSelected && (
                    <circle cx={sx} cy={sy} r={18} fill="none" stroke={cam.color} strokeWidth={2} strokeDasharray="4 3" opacity={0.7}>
                      <animateTransform attributeName="transform" type="rotate"
                        from={`0 ${sx} ${sy}`} to={`360 ${sx} ${sy}`} dur="4s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Body cámara */}
                  <rect x={sx - 10} y={sy - 7} width={20} height={14} fill={cam.color} stroke="white" strokeWidth={1.5} rx={3} />
                  <circle cx={sx} cy={sy} r={5} fill="white" />
                  <circle cx={sx} cy={sy} r={3} fill="#111" />
                  <circle cx={sx - 1} cy={sy - 1} r={1} fill="white" opacity={0.6} />
                  {/* Flecha de dirección */}
                  <line x1={sx} y1={sy}
                    x2={sx + Math.cos(cam.dir) * 18} y2={sy + Math.sin(cam.dir) * 18}
                    stroke={cam.color} strokeWidth={2.5} strokeDasharray="3 2" />
                  {/* Coordenadas flotantes */}
                  <text x={sx + 14} y={sy - 8} fill={cam.color} fontSize={8.5} fontWeight={700} opacity={0.9}>
                    ({cam.x.toFixed(2)}, {cam.y.toFixed(2)})
                  </text>
                  <text x={sx} y={sy + 24} textAnchor="middle" fill={cam.color} fontSize={10} fontWeight={700}>{cam.label}</text>
                </g>
              );
            })}

            {/* Cotas */}
            <line x1={PAD} y1={PAD - 18} x2={PAD + ROOM_W * SCALE} y2={PAD - 18} stroke="#484f58" strokeWidth={1} />
            <line x1={PAD} y1={PAD - 22} x2={PAD} y2={PAD - 14} stroke="#484f58" strokeWidth={1} />
            <line x1={PAD + ROOM_W * SCALE} y1={PAD - 22} x2={PAD + ROOM_W * SCALE} y2={PAD - 14} stroke="#484f58" strokeWidth={1} />
            <text x={PAD + ROOM_W * SCALE / 2} y={PAD - 22} textAnchor="middle" fill="#6e7681" fontSize={11}>6.85 m</text>
            <line x1={PAD - 20} y1={PAD} x2={PAD - 20} y2={PAD + ROOM_D * SCALE} stroke="#484f58" strokeWidth={1} />
            <line x1={PAD - 24} y1={PAD} x2={PAD - 16} y2={PAD} stroke="#484f58" strokeWidth={1} />
            <line x1={PAD - 24} y1={PAD + ROOM_D * SCALE} x2={PAD - 16} y2={PAD + ROOM_D * SCALE} stroke="#484f58" strokeWidth={1} />
            <text x={PAD - 28} y={PAD + ROOM_D * SCALE / 2} textAnchor="middle" fill="#6e7681" fontSize={11}
              transform={`rotate(-90, ${PAD - 28}, ${PAD + ROOM_D * SCALE / 2})`}>11.40 m</text>
            <text x={PAD + ROOM_W * SCALE - 4} y={PAD + 16} textAnchor="end" fill="#e3b341" fontSize={13} fontWeight={800}>N ▲</text>

            {/* Escala gráfica */}
            <g transform={`translate(${PAD + 4}, ${PAD + ROOM_D * SCALE - 14})`}>
              <rect x={0} y={0} width={SCALE} height={5} fill="#3b76c4" opacity={0.7} rx={1} />
              <rect x={SCALE} y={0} width={SCALE} height={5} fill="none" stroke="#3b76c4" strokeWidth={1} rx={1} />
              <text x={0} y={14} fill="#6e7681" fontSize={9}>0</text>
              <text x={SCALE - 4} y={14} fill="#6e7681" fontSize={9}>1m</text>
              <text x={SCALE * 2 - 4} y={14} fill="#6e7681" fontSize={9}>2m</text>
            </g>
          </svg>
        </div>

        {/* ──── Panel de controles ─────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 262 }}>

          {/* ── Todas las cámaras con posición configurable ── */}
          <div style={{ background: "#161b22", border: "1.5px solid #30363d", borderRadius: 10, padding: 14 }}>
            <div style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>
              POSICIÓN DE CÁMARAS
            </div>
            <div style={{ color: "#484f58", fontSize: 10, marginBottom: 12 }}>
              Origen (0,0) = esquina Noroeste · X → Este · Y → Sur
            </div>

            {cameras.map(cam => {
              const inp = coordInputs[cam.id];
              const isActive = activeCams.includes(cam.id);
              return (
                <div key={cam.id} style={{
                  marginBottom: 14, padding: 12, borderRadius: 8,
                  background: isActive ? `${cam.color}0d` : "#0d1117",
                  border: `1.5px solid ${isActive ? cam.color + "55" : "#21262d"}`,
                }}>
                  {/* Header de cámara */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: 11, height: 11, borderRadius: "50%", background: cam.color, flexShrink: 0 }} />
                      <span style={{ color: cam.color, fontWeight: 800, fontSize: 13 }}>{cam.label}</span>
                    </div>
                    <button onClick={() => toggleCam(cam.id)} style={{
                      padding: "3px 10px", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700,
                      background: isActive ? `${cam.color}33` : "#21262d",
                      border: `1px solid ${isActive ? cam.color : "#30363d"}`,
                      color: isActive ? cam.color : "#6e7681",
                    }}>
                      {isActive ? "● ON" : "○ OFF"}
                    </button>
                  </div>

                  {/* Inputs de coordenadas */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#6e7681", fontSize: 10, marginBottom: 3, fontWeight: 600 }}>X (0 – {ROOM_W}m)</div>
                      <input
                        type="number" min="0" max={ROOM_W} step="0.1"
                        value={inp.x}
                        onChange={e => handleCoordChange(cam.id, "x", e.target.value)}
                        onBlur={() => applyCoords(cam.id)}
                        onKeyDown={e => e.key === "Enter" && applyCoords(cam.id)}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", borderColor: cam.color + "66" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#6e7681", fontSize: 10, marginBottom: 3, fontWeight: 600 }}>Y (0 – {ROOM_D}m)</div>
                      <input
                        type="number" min="0" max={ROOM_D} step="0.1"
                        value={inp.y}
                        onChange={e => handleCoordChange(cam.id, "y", e.target.value)}
                        onBlur={() => applyCoords(cam.id)}
                        onKeyDown={e => e.key === "Enter" && applyCoords(cam.id)}
                        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", borderColor: cam.color + "66" }}
                      />
                    </div>
                    <div style={{ paddingTop: 16 }}>
                      <button onClick={() => applyCoords(cam.id)} style={{
                        padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 14,
                        background: cam.color, border: "none", color: "#fff", fontWeight: 700,
                      }}>↵</button>
                    </div>
                  </div>

                  {/* Dirección cardinal */}
                  <div style={{ color: "#6e7681", fontSize: 10, marginBottom: 5, fontWeight: 600 }}>DIRECCIÓN</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {DIRS.map(d => {
                      const isDir = Math.abs(cam.dir - d.dir) < 0.05;
                      return (
                        <button key={d.label} onClick={() => setDirection(cam.id, d.dir)} style={{
                          padding: "5px 0", borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700,
                          background: isDir ? `${cam.color}33` : "#21262d",
                          border: `1px solid ${isDir ? cam.color : "#30363d"}`,
                          color: isDir ? cam.color : "#6e7681",
                        }}>{d.label}</button>
                      );
                    })}
                  </div>

                  {/* Pan */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ color: "#6e7681", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>PAN FINO</div>
                    <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                      {[[-5,"◀5°"], [-1,"◀1°"], [1,"1°▶"], [5,"5°▶"]].map(([d, lbl]) => (
                        <button key={lbl} onClick={() => panCamera(cam.id, d)} style={{
                          flex: 1, padding: "4px 0", borderRadius: 5, cursor: "pointer",
                          background: "#21262d", border: `1px solid ${cam.color}66`,
                          color: cam.color, fontSize: 11, fontWeight: 700,
                        }}>{lbl}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 3 }}>
                      {[[-30,"◀30°"], [-10,"◀10°"], [10,"10°▶"], [30,"30°▶"]].map(([d, lbl]) => (
                        <button key={lbl} onClick={() => panCamera(cam.id, d)} style={{
                          flex: 1, padding: "4px 0", borderRadius: 5, cursor: "pointer",
                          background: "#21262d", border: `1px solid ${cam.color}33`,
                          color: cam.color + "bb", fontSize: 11, fontWeight: 700,
                        }}>{lbl}</button>
                      ))}
                    </div>
                    <button onClick={() => setDirection(cam.id, CAMERAS_INIT.find(c => c.id === cam.id).dir)} style={{
                      width: "100%", marginTop: 3, padding: "3px 0", borderRadius: 5, cursor: "pointer",
                      background: "#21262d", border: "1px solid #30363d",
                      color: "#6e7681", fontSize: 10, fontWeight: 600,
                    }}>⟳ Reset dirección</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tiros */}
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 14 }}>
            <div style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>TIPO DE TIRO</div>
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => togglePreset(p.id)} style={BtnStyle(activePresets.includes(p.id), p.dot)}>
                <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: activePresets.includes(p.id) ? p.dot : "#30363d" }} />
                <div>
                  <div style={{ fontWeight: 700 }}>{p.label}</div>
                  <div style={{ fontSize: 10, fontWeight: 400, color: "#6e7681" }}>{p.zoom}x zoom · {p.fov}°</div>
                </div>
              </button>
            ))}
          </div>

          {/* Specs */}
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 10, padding: 14, fontSize: 12 }}>
            <div style={{ color: "#8b949e", fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>Q-SYS NC-20×60</div>
            {[["FOV Gran Angular","60°"],["FOV Tele","~3°"],["Zoom","20x"],["Pan","±170°"],["Tilt","-30°→+90°"],["Resolución","4K/1080p"]].map(([k,v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, borderBottom: "1px solid #21262d", paddingBottom: 4 }}>
                <span style={{ color: "#6e7681" }}>{k}</span>
                <span style={{ color: "#c9d1d9", fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* ──── Vista Lateral ──────────────────────────────────────────────── */}
      {(() => {
        const latW = LPAD * 2 + ROOM_D * LSX;
        const latH = LPAD * 2 + ROOM_H * LSY;
        const heightMarks = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
        const depthMarks  = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11.4];

        // Cámara a mostrar: seleccionada o primera activa
        const displayCamId = selectedCam && activeCams.includes(selectedCam) ? selectedCam : activeCams[0];
        const displayCam   = cameras.find(c => c.id === displayCamId);
        const cc           = displayCam?.color ?? "#3b76c4";

        // Preset activo y FOV vertical
        const activePreset = PRESETS.find(p => activePresets.includes(p.id)) || PRESETS[0];
        const vFovDeg      = toVFOV(activePreset.fov);

        // Geometría del cono lateral
        const tiltRad       = (tilt * Math.PI) / 180;
        const depthDir      = Math.sin(displayCam.dir);       // +sur / -norte
        const isPerpendicular = Math.abs(depthDir) < 0.15;
        const lateralSign   = depthDir >= 0 ? 1 : -1;
        const centerAngle   = Math.atan2(Math.sin(tiltRad), lateralSign * Math.cos(tiltRad));
        const vHalf         = (vFovDeg * Math.PI) / 360;
        const N = 24;
        const conePts = [{ ry: displayCam.y, h: camHeight }];
        for (let i = 0; i <= N; i++) {
          const a = (centerAngle - vHalf) + (2 * vHalf * i) / N;
          conePts.push(rayToWallLat(displayCam.y, camHeight, a));
        }
        const conePoints = conePts.map(p => { const { lx, ly } = toLat(p.ry, p.h); return `${lx},${ly}`; }).join(" ");

        // Rayo central
        const centerEnd              = rayToWallLat(displayCam.y, camHeight, centerAngle);
        const { lx: camLx, ly: camLy } = toLat(displayCam.y, camHeight);
        const { lx: ceLx,  ly: ceLy  } = toLat(centerEnd.ry, centerEnd.h);

        return (
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>

            {/* Título + controles */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              <div>
                <span style={{ color: "#c9d1d9", fontWeight: 700, fontSize: 15 }}>Vista Lateral — Corte Norte → Sur</span>
                <span style={{ color: "#484f58", fontSize: 12, marginLeft: 10 }}>{ROOM_D} m × {ROOM_H} m</span>
              </div>
              {/* Altura montaje */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#8b949e", fontSize: 12, fontWeight: 600 }}>Montaje:</span>
                <input type="range" min="0.5" max={ROOM_H} step="0.05" value={camHeight}
                  onChange={e => setCamHeight(parseFloat(e.target.value))}
                  style={{ width: 100, accentColor: "#3b76c4" }} />
                <span style={{ minWidth: 42, textAlign: "center", fontWeight: 700, fontSize: 13, color: "#79c0ff",
                  background: "#0d1117", border: "1px solid #3b76c4", borderRadius: 5, padding: "2px 6px" }}>
                  {camHeight.toFixed(2)} m
                </span>
              </div>
              {/* Tilt */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#8b949e", fontSize: 12, fontWeight: 600 }}>Tilt:</span>
                <input type="range" min="-45" max="15" step="1" value={tilt}
                  onChange={e => setTilt(parseFloat(e.target.value))}
                  style={{ width: 100, accentColor: cc }} />
                <span style={{ minWidth: 42, textAlign: "center", fontWeight: 700, fontSize: 13, color: cc,
                  background: "#0d1117", border: `1px solid ${cc}55`, borderRadius: 5, padding: "2px 6px" }}>
                  {tilt > 0 ? `+${tilt}` : tilt}°
                </span>
              </div>
              {/* Cámara activa */}
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                background: `${cc}18`, border: `1px solid ${cc}55`, borderRadius: 6, padding: "4px 10px" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: cc }} />
                <span style={{ color: cc, fontWeight: 700, fontSize: 12 }}>{displayCam.label}</span>
                <span style={{ color: "#6e7681", fontSize: 11 }}>· {activePreset.label} · vFOV {vFovDeg.toFixed(1)}°</span>
              </div>
            </div>

            {/* SVG corte lateral */}
            <div style={{ background: "#161b22", borderRadius: 14, padding: 10, border: "1px solid #30363d",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)", overflowX: "auto" }}>
              <svg width={latW} height={latH}>

                {/* Fondo sala */}
                <rect x={LPAD} y={LPAD} width={ROOM_D * LSX} height={ROOM_H * LSY}
                  fill="#161d2b" stroke="#3b76c4" strokeWidth={2} />

                {/* Grid horizontal (alturas) */}
                {heightMarks.filter(h => h > 0 && h < ROOM_H).map(h => {
                  const { ly } = toLat(0, h);
                  return <line key={h} x1={LPAD} y1={ly} x2={LPAD + ROOM_D * LSX} y2={ly}
                    stroke="#1e2530" strokeWidth={0.8} strokeDasharray="3 4" />;
                })}

                {/* Grid vertical (profundidad) */}
                {depthMarks.filter(d => d > 0 && d < ROOM_D).map(d => {
                  const { lx } = toLat(d, 0);
                  return <line key={d} x1={lx} y1={LPAD} x2={lx} y2={LPAD + ROOM_H * LSY}
                    stroke="#1e2530" strokeWidth={0.8} strokeDasharray="3 4" />;
                })}

                {/* ── Cono FOV vertical ── */}
                {!isPerpendicular && (
                  <polygon points={conePoints}
                    fill={activePreset.fill} stroke={activePreset.stroke} strokeWidth={1.5} />
                )}

                {/* ── Rayo central ── */}
                {!isPerpendicular && (
                  <line x1={camLx} y1={camLy} x2={ceLx} y2={ceLy}
                    stroke={cc} strokeWidth={1.5} strokeDasharray="5 3" opacity={0.85} />
                )}

                {/* ── Aviso si la cámara apunta Este/Oeste ── */}
                {isPerpendicular && (
                  <text x={camLx + 14} y={camLy - 8} fill="#ffc800" fontSize={10} fontWeight={700}>
                    ⚠ Cámara apunta Este/Oeste
                  </text>
                )}

                {/* ── Ícono cámara ── */}
                <rect x={camLx - 10} y={camLy - 7} width={20} height={14} fill={cc} stroke="white" strokeWidth={1.5} rx={3} />
                <circle cx={camLx} cy={camLy} r={5} fill="white" />
                <circle cx={camLx} cy={camLy} r={3} fill="#111" />
                <circle cx={camLx - 1} cy={camLy - 1} r={1} fill="white" opacity={0.6} />
                <text x={camLx} y={camLy - 12} textAnchor="middle" fill={cc} fontSize={9} fontWeight={700}>
                  {displayCam.label}
                </text>

                {/* Línea de altura de montaje (referencia) */}
                <line x1={LPAD} y1={camLy} x2={LPAD + ROOM_D * LSX} y2={camLy}
                  stroke={cc} strokeWidth={1} strokeDasharray="4 6" opacity={0.3} />

                {/* Eje Y: alturas */}
                {heightMarks.map(h => {
                  const { ly } = toLat(0, h);
                  return (
                    <g key={h}>
                      <line x1={LPAD - 5} y1={ly} x2={LPAD} y2={ly} stroke="#484f58" strokeWidth={1} />
                      <text x={LPAD - 8} y={ly + 4} textAnchor="end" fill="#6e7681" fontSize={10} fontWeight={600}>
                        {h.toFixed(1)}m
                      </text>
                    </g>
                  );
                })}

                {/* Eje X: profundidad */}
                {depthMarks.map(d => {
                  const { lx } = toLat(d, 0);
                  const floorY = LPAD + ROOM_H * LSY;
                  return (
                    <g key={d}>
                      <line x1={lx} y1={floorY} x2={lx} y2={floorY + 5} stroke="#484f58" strokeWidth={1} />
                      <text x={lx} y={floorY + 15} textAnchor="middle" fill="#6e7681" fontSize={d === 11.4 ? 9 : 10}>
                        {d === 11.4 ? "11.4" : d}
                      </text>
                    </g>
                  );
                })}

                <text x={LPAD + ROOM_D * LSX / 2} y={LPAD + ROOM_H * LSY + 30}
                  textAnchor="middle" fill="#484f58" fontSize={10}>profundidad (m)</text>
                <text x={LPAD - 38} y={LPAD + ROOM_H * LSY / 2}
                  textAnchor="middle" fill="#484f58" fontSize={10}
                  transform={`rotate(-90, ${LPAD - 38}, ${LPAD + ROOM_H * LSY / 2})`}>altura (m)</text>

                <text x={LPAD + 4} y={LPAD - 6} fill="#2d4a7a" fontSize={9} fontWeight={700}>NORTE (Y=0)</text>
                <text x={LPAD + ROOM_D * LSX - 4} y={LPAD - 6} textAnchor="end" fill="#2d4a7a" fontSize={9} fontWeight={700}>SUR (Y={ROOM_D})</text>
                <text x={LPAD + ROOM_D * LSX + 6} y={LPAD + 4} fill="#484f58" fontSize={9} fontWeight={600}>techo</text>
                <text x={LPAD + ROOM_D * LSX + 6} y={LPAD + ROOM_H * LSY + 4} fill="#484f58" fontSize={9} fontWeight={600}>piso</text>

                {/* Cotas */}
                <line x1={LPAD} y1={LPAD - 16} x2={LPAD + ROOM_D * LSX} y2={LPAD - 16} stroke="#484f58" strokeWidth={1} />
                <line x1={LPAD} y1={LPAD - 20} x2={LPAD} y2={LPAD - 12} stroke="#484f58" strokeWidth={1} />
                <line x1={LPAD + ROOM_D * LSX} y1={LPAD - 20} x2={LPAD + ROOM_D * LSX} y2={LPAD - 12} stroke="#484f58" strokeWidth={1} />
                <text x={LPAD + ROOM_D * LSX / 2} y={LPAD - 20} textAnchor="middle" fill="#6e7681" fontSize={11}>{ROOM_D} m</text>

              </svg>
            </div>
          </div>
        );
      })()}

      <p style={{ textAlign: "center", color: "#484f58", fontSize: 11, marginTop: 16 }}>
        Ingresa X e Y en cualquier cámara y presiona ↵ o Tab · Cardinales para orientar · ◀▶ para ajuste fino de pan
      </p>
    </div>
  );
}
