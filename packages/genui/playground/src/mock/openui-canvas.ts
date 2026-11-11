// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

export const GOMOKU_CANVAS_CODE = `
const size = 15;
const padding = 24;
const top = 72;
const step = (width - padding * 2) / (size - 1);
function stone(index, player, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(padding + (index % size) * step, top + Math.floor(index / size) * step, step * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = player === 1 ? '#202b3a' : '#fffdf6';
  ctx.fill();
  ctx.strokeStyle = player === 1 ? '#111827' : '#bfa880';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function draw() {
  ctx.fillStyle = '#f8efdf';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#253329';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(status, 24, 31);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#776d5a';
  ctx.fillText('FIVE IN A ROW  ·  ' + turn + ' moves', 24, 51);
  ctx.fillStyle = '#edcf99';
  ctx.fillRect(10, top - 14, width - 20, step * 14 + 28);
  ctx.strokeStyle = '#9c7c49';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let i = 0; i < size; i++) {
    ctx.moveTo(padding, top + i * step);
    ctx.lineTo(width - padding, top + i * step);
    ctx.moveTo(padding + i * step, top);
    ctx.lineTo(padding + i * step, top + step * 14);
  }
  ctx.stroke();
  for (const [row, col] of [[3,3],[3,11],[7,7],[11,3],[11,11]]) {
    ctx.beginPath();
    ctx.arc(padding + col * step, top + row * step, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#856334';
    ctx.fill();
  }
  board.forEach((move, index) => { if (move) stone(index, (move - 1) % 2 + 1); });
  if (last >= 0) {
    ctx.beginPath();
    ctx.arc(padding + last % size * step, top + Math.floor(last / size) * step, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e37048';
    ctx.fill();
  }
}
draw();
`;

export const SLIDER_ICON_CANVAS_CHUNKS = [
  `
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, width, height);
`,
  `
  ctx.save();
  ctx.translate(width / 2, height / 2 - 12);
  ctx.rotate(rotation * Math.PI / 180);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? size * 0.46 : size;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = '#fbbf24';
  ctx.strokeStyle = '#b45309';
  ctx.lineWidth = stroke;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
`,
  `
  ctx.fillStyle = '#475569';
  ctx.textAlign = 'center';
  ctx.font = '13px sans-serif';
  ctx.fillText(rotation + '° · size ' + size + ' · stroke ' + stroke, width / 2, height - 24);
`,
];

const ICON_PARAMETERS =
  '"const rotation = " + $rotation + "; const size = " + $size + "; const stroke = " + $stroke + ";"';

// The board stores the move number at each intersection (0 means empty).
// All input, move validation, winning lines and undo/reset are OpenUI Lang.
export const OPENUI_GOMOKU_RAW =
  `root = Column([Text("Canvas Gomoku", "h2"), Text("Tap an intersection to place a stone. Black plays first; five in a row wins.", "body"), board, controls], "start", "stretch", "m")
$point = { x: 0, y: 0 }
$board = []
$turn = 0
$last = -1
$valid = false
axis = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
position = @Count($board) == 0 ? @Each(axis, "r", @Each(axis, "c", 0)) : $board
col = @Round(($point.x - 24) / (312 / 14))
row = @Round(($point.y - 72) / (312 / 14))
cell = row * 15 + col
winningLines = @Each([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }], "direction", @Count(@Filter(@Each([0, 1, 2, 3, 4], "start", @Count(@Filter(@Each(@Each([0, 1, 2, 3, 4], "offset", { x: $last % 15 + (offset - start) * direction.x, y: @Floor($last / 15) + (offset - start) * direction.y }), "point", point.x >= 0 && point.x < 15 && point.y >= 0 && point.y < 15 && position[point.y][point.x] > 0 && position[point.y][point.x] % 2 == $turn % 2), "", "==", true)) == 5), "", "==", true)))
winner = $turn > 0 && @Sum(winningLines) > 0 ? ($turn - 1) % 2 + 1 : 0
status = winner == 1 ? "Black wins!" : winner == 2 ? "White wins!" : $turn == 225 ? "Draw game" : $turn % 2 == 0 ? "Black to move" : "White to move"
place = Action([@Set($valid, winner == 0 && col >= 0 && col < 15 && row >= 0 && row < 15 && position[row][col] == 0), @Set($last, $valid ? cell : $last), @Set($board, $valid ? @Each(axis, "r", @Each(axis, "c", r * 15 + c == $last ? $turn + 1 : position[r][c])) : $board), @Set($turn, $valid ? $turn + 1 : $turn)])
undo = Action([@Set($board, @Each(position, "line", @Each(line, "move", move == $turn ? 0 : move))), @Set($turn, $turn > 0 ? $turn - 1 : 0), @Set($last, $turn > 0 ? @Sum(@Each(axis, "r", @Sum(@Each(axis, "c", $board[r][c] == $turn ? r * 15 + c : 0)))) : -1)])
controls = Row([Button("Undo move", undo, "secondary"), Button("New game", Action([@Reset($board, $turn, $last, $valid, $point)]), "secondary")], "start", "center", "m")
board = Canvas("const board = [" + position + "]; const turn = " + $turn + "; const last = " + $last + "; const status = '" + status + "';" + ${
    JSON.stringify(GOMOKU_CANVAS_CODE)
  }, 360, 410, "$point", place)`;

export const OPENUI_SLIDER_ICON_RAW =
  `root = Column([Text("Canvas Icon Studio", "h2"), Text("Drag the sliders to redraw a star using standard Canvas 2D commands.", "body"), icon, rotation, size, stroke], "start", "stretch", "m")
$rotation = 0
$size = 70
$stroke = 3
icon = Canvas([${
    JSON.stringify(SLIDER_ICON_CANVAS_CHUNKS[0])
  }, ${ICON_PARAMETERS} + ${
    JSON.stringify(SLIDER_ICON_CANVAS_CHUNKS[1])
  }, ${ICON_PARAMETERS} + ${
    JSON.stringify(SLIDER_ICON_CANVAS_CHUNKS[2])
  }], 360, 260, "star-icon")
rotation = Slider("Rotation", 0, 360, $rotation, 1, null, "$rotation")
size = Slider("Size", 24, 100, $size, 1, null, "$size")
stroke = Slider("Stroke width", 1, 10, $stroke, 1, null, "$stroke")`;

// Each item is authored as a complete drawing step. Playback deliberately cuts
// the resulting OpenUI source at arbitrary character boundaries, like a model.
export const STREAMING_CANVAS_CHUNKS = [
  `// 1. Background
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 20px sans-serif';
ctx.fillText('A week in motion', 24, 36);
ctx.fillStyle = '#94a3b8';
ctx.font = '12px sans-serif';
ctx.fillText('Daily distance · km', 24, 58);`,
  `// 2. Grid
ctx.strokeStyle = '#334155';
ctx.lineWidth = 1;
ctx.beginPath();
for (let y = 92; y <= 252; y += 40) {
  ctx.moveTo(36, y);
  ctx.lineTo(width - 24, y);
}
ctx.stroke();`,
  ...[4, 7, 5, 10, 8, 12, 9].map((value, index) =>
    `// ${index + 3}. ${
      [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ][index]
    }
const x = 44 + ${index} * 42;
const barHeight = ${value} * 12;
ctx.fillStyle = '${index === 5 ? '#fbbf24' : '#38bdf8'}';
ctx.fillRect(x, 252 - barHeight, 24, barHeight);
ctx.fillStyle = '#e2e8f0';
ctx.textAlign = 'center';
ctx.font = '12px sans-serif';
ctx.fillText('${value}', x + 12, 244 - barHeight);`
  ),
  `// 10. Labels and summary
ctx.fillStyle = '#94a3b8';
ctx.textAlign = 'center';
ctx.font = '11px sans-serif';
['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach((day, index) => {
  ctx.fillText(day, 56 + index * 42, 274);
});
ctx.textAlign = 'left';
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 14px sans-serif';
ctx.fillText('55 km this week', 24, height - 24);`,
];

export const OPENUI_CANVAS_STREAM_RAW =
  `root = Column([Text("Canvas Streaming", "h2"), Text("Press Playback to watch the background, grid, daily bars and labels appear as the drawing arrives.", "body"), chart], "start", "stretch", "m")
chart = Canvas(chartCode, 360, 330, "streaming-chart")
chartCode = [
${STREAMING_CANVAS_CHUNKS.map(chunk => JSON.stringify(chunk)).join(',\n')}
]`;

// Schwarzschild static clocks: MIT 8.962, section 6.2.2.
// https://web.mit.edu/8.962/www/lecnotes/8_962TA-lec-all.pdf
// Mass is in solar masses; distances are in km. All controls keep r > rs.
// Light paths use a first-order weak-field trajectory with b >= 700 km
// (> 11 rs even at maximum mass), not a strong-field geodesic solver.
const RELATIVITY_CHUNKS = [
  `
ctx.fillStyle = '#091322';
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#122238';
ctx.fillRect(12, 60, 336, 204);
ctx.fillStyle = '#70dfdc';
ctx.font = 'bold 11px sans-serif';
ctx.fillText('GRAVITY LAB / SCHWARZSCHILD', 20, 25);
ctx.fillStyle = '#e9f2ff';
ctx.font = 'bold 20px sans-serif';
ctx.fillText('A different rhythm of time', 20, 49);
`,
  `
ctx.save();
ctx.beginPath(); ctx.rect(16, 93, 328, 143); ctx.clip();
// A deliberately schematic warped sheet, not an embedding metric.
function point(x, y) {
  const dip = (18 + mass * 2.3) * Math.exp(-(x * x + y * y) / 4500);
  return [180 + x, 155 + y * 0.43 + dip];
}
ctx.strokeStyle = '#246074'; ctx.lineWidth = 0.8;
for (let axis = 0; axis < 2; axis++) {
  for (let line = -160; line <= 160; line += 16) {
    ctx.beginPath();
    for (let step = -160; step <= 160; step += 4) {
      const p = axis ? point(line, step) : point(step, line);
      if (step === -160) ctx.moveTo(...p); else ctx.lineTo(...p);
    }
    ctx.stroke();
  }
}
const center = point(0, 0);
ctx.beginPath(); ctx.arc(center[0], center[1], 5 + mass * 0.4, 0, Math.PI * 2);
ctx.fillStyle = '#060b14'; ctx.fill();
ctx.strokeStyle = '#ffca7b'; ctx.lineWidth = 2; ctx.stroke();
const observer = point(radius * 0.36, 0);
ctx.beginPath(); ctx.arc(observer[0], observer[1], 4, 0, Math.PI * 2);
ctx.fillStyle = '#70dfdc'; ctx.fill();
ctx.font = '11px sans-serif'; ctx.fillText('observer', observer[0] - 22, observer[1] - 12);
ctx.restore();
ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#e9f2ff';
ctx.fillText('01  MASS CURVES SPACETIME', 24, 83);
ctx.font = '11px sans-serif'; ctx.fillStyle = '#a2b4cd';
ctx.fillText('Warped grid: visual analogy, not a literal surface.', 24, 250);
`,
  `
const rs = 2.95325 * mass;
ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#e9f2ff';
ctx.fillText('02  LIGHT BENDS', 24, 301);
ctx.font = '11px sans-serif'; ctx.fillStyle = '#a2b4cd';
ctx.fillText('Weak field / dashed lines: no gravity', 24, 320);
ctx.save();
ctx.beginPath(); ctx.rect(24, 328, 312, 88); ctx.clip();
for (const b of [-900, -700, 700, 900]) {
  ctx.setLineDash([3, 5]); ctx.strokeStyle = '#344762'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(24, 373 - b * 0.045); ctx.lineTo(336, 373 - b * 0.045); ctx.stroke();
  ctx.setLineDash([]); ctx.strokeStyle = b > 0 ? '#70dfdc' : '#ffca7b'; ctx.lineWidth = 1.8;
  ctx.beginPath();
  for (let x = -3400; x <= 3400; x += 40) {
    const y = b - rs / b * (x + Math.sqrt(x * x + b * b));
    const px = 180 + x * 0.045, py = 373 - y * 0.045;
    if (x === -3400) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
ctx.beginPath(); ctx.arc(180, 373, Math.max(2, rs * 0.045), 0, Math.PI * 2);
ctx.fillStyle = '#ffca7b'; ctx.fill();
ctx.restore();
ctx.font = '11px sans-serif'; ctx.fillStyle = '#a2b4cd';
ctx.fillText('Inner rays: b = 700 km / bend ≈ ' + (2 * rs / 700 * 180 / Math.PI).toFixed(2) + '°', 24, 432);
`,
  `
const rs = 2.95325 * mass;
const rate = Math.sqrt(1 - rs / radius);
ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#e9f2ff';
ctx.fillText('03  COMPARE TWO STATIC CLOCKS', 24, 483);
function clock(x, seconds, color, label) {
  ctx.strokeStyle = '#344762'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, 534, 28, 0, Math.PI * 2); ctx.stroke();
  for (let tick = 0; tick < 12; tick++) {
    const a = tick * Math.PI / 6;
    ctx.beginPath(); ctx.moveTo(x + Math.sin(a) * 24, 534 - Math.cos(a) * 24);
    ctx.lineTo(x + Math.sin(a) * 27, 534 - Math.cos(a) * 27); ctx.stroke();
  }
  const angle = seconds / 60 * Math.PI * 2;
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(x, 534); ctx.lineTo(x + Math.sin(angle) * 21, 534 - Math.cos(angle) * 21); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = 'bold 17px sans-serif';
  ctx.fillText(seconds.toFixed(1) + ' s', x, 585);
  ctx.fillStyle = '#a2b4cd'; ctx.font = '11px sans-serif'; ctx.fillText(label, x, 604);
  ctx.textAlign = 'left';
}
clock(99, elapsed, '#e9f2ff', 'Far away (infinity)');
clock(261, elapsed * rate, '#70dfdc', 'At r = ' + radius + ' km');
ctx.fillStyle = '#70dfdc'; ctx.font = 'bold 13px sans-serif';
ctx.fillText('Local clock rate: ' + rate.toFixed(3) + '×', 24, 653);
ctx.fillStyle = '#a2b4cd'; ctx.font = '11px sans-serif';
ctx.fillText('Horizon rs = ' + rs.toFixed(1) + ' km / observer stays outside', 24, 674);
ctx.fillText('dτ/dt = √(1 − rs/r)     rs = 2GM/c²', 24, 695);
`,
] as const;

// Separate canvases keep unrelated drawings stable during slider updates.
// Each code expression depends only on the fields used by that panel.
const MASS = '"const mass = " + $mass + ";"';
const POSITION =
  '"const mass = " + $mass + "; const radius = " + $radius + ";"';
const CLOCK_PARAMETERS =
  '"const mass = " + $mass + "; const radius = " + $radius + "; const elapsed = " + $elapsed + ";"';
const PANEL_BACKGROUND =
  `ctx.fillStyle = '#091322'; ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#122238'; ctx.fillRect(12, 0, 336, 168);`;

function translated(code: string, top: number): string {
  return JSON.stringify(
    `ctx.save(); ctx.translate(0, -${top});\n${code}\nctx.restore();`,
  );
}

export const OPENUI_CANVAS_RELATIVITY_RAW =
  `root = Column([Text("General Relativity", "h2"), Text("Explore a non-rotating black hole. Adjust mass and distance, then scrub time to compare clocks.", "body"), massControl, geometry, light, radiusControl, timeControl, clocks, Text("The clocks are stationary, not orbiting. Each slider setting is a separate experiment starting at zero. Play streams the drawing in layers.", "caption")], "start", "stretch", "m")
$mass = 12
$radius = 120
$elapsed = 45
massControl = Slider("Mass (solar masses)", 1, 20, $mass, 1, null, "$mass")
radiusControl = Slider("Observer radius (km)", 70, 400, $radius, 10, null, "$radius")
timeControl = Slider("Far-away elapsed time (s)", 0, 60, $elapsed, 1, null, "$elapsed")
geometry = Canvas(geometryCode, 360, 278, "relativity-geometry")
light = Canvas(lightCode, 360, 182, "relativity-light")
clocks = Canvas(clockCode, 360, 256, "relativity-clocks")
geometryCode = [${JSON.stringify(RELATIVITY_CHUNKS[0])}, ${POSITION} + ${
    JSON.stringify(RELATIVITY_CHUNKS[1])
  }]
lightCode = [${JSON.stringify(PANEL_BACKGROUND)}, ${MASS} + ${
    translated(RELATIVITY_CHUNKS[2], 278)
  }]
clockCode = [${JSON.stringify(PANEL_BACKGROUND)}, ${CLOCK_PARAMETERS} + ${
    translated(RELATIVITY_CHUNKS[3], 460)
  }]
`;
