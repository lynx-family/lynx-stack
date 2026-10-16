// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

const GRID = `
ctx.fillStyle = '#0f172a';
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = '#e2e8f0';
ctx.font = 'bold 19px sans-serif';
ctx.fillText('y = A sin(kx + phase)', 20, 31);
ctx.font = '11px sans-serif';
ctx.fillStyle = '#94a3b8';
ctx.fillText('CYAN: YOUR WAVE   /   DASHED: sin(x)', 20, 53);
ctx.font = '11px sans-serif';
for (let i = -2; i <= 2; i++) {
  const y = 165 - i * 36;
  ctx.strokeStyle = i === 0 ? '#64748b' : '#263449';
  ctx.beginPath(); ctx.moveTo(36, y); ctx.lineTo(336, y); ctx.stroke();
  ctx.fillText(String(i), 17, y + 4);
}
ctx.textAlign = 'center';
['0', 'pi/2', 'pi', '3pi/2', '2pi'].forEach((label, i) => {
  const x = 36 + i * 75;
  ctx.strokeStyle = '#263449';
  ctx.beginPath(); ctx.moveTo(x, 83); ctx.lineTo(x, 247); ctx.stroke();
  ctx.fillText(label, x, 263);
});
ctx.textAlign = 'left';
ctx.strokeStyle = '#64748b';
ctx.setLineDash([4, 4]);
ctx.beginPath();
for (let i = 0; i <= 300; i++) {
  const y = 165 - Math.sin(i / 300 * Math.PI * 2) * 36;
  if (i === 0) ctx.moveTo(36 + i, y); else ctx.lineTo(36 + i, y);
}
ctx.stroke(); ctx.setLineDash([]);
`;

const WAVE = `
ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.5;
ctx.beginPath();
for (let i = 0; i <= 300; i++) {
  const y = 165 - a * Math.sin(k * i / 300 * Math.PI * 2 + phase * Math.PI / 180) * 36;
  if (i === 0) ctx.moveTo(36 + i, y); else ctx.lineTo(36 + i, y);
}
ctx.stroke(); ctx.lineWidth = 1;
ctx.fillStyle = '#cbd5e1'; ctx.font = '12px sans-serif';
ctx.fillText('A = ' + a + '   k = ' + k + '   phase = ' + phase + ' deg', 20, 288);
ctx.fillText('Period = ' + (2 / k).toFixed(2) + ' pi radians', 20, 310);
`;

const POINT = `
const x = sample * Math.PI / 180;
const y = a * Math.sin(k * x + phase * Math.PI / 180);
const px = 36 + sample / 360 * 300, py = 165 - y * 36;
ctx.strokeStyle = '#fbbf24'; ctx.setLineDash([3, 3]);
ctx.beginPath(); ctx.moveTo(px, 83); ctx.lineTo(px, 247); ctx.stroke();
ctx.setLineDash([]); ctx.fillStyle = '#fbbf24';
ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
ctx.font = 'bold 13px sans-serif';
ctx.fillText('x = ' + (sample / 180).toFixed(2) + ' pi   y = ' + y.toFixed(3), 20, 338);
`;

const PARAMETERS =
  '"const a = " + $amplitude + "; const k = " + $frequency + "; const phase = " + $phase + ";"';

export const OPENUI_CANVAS_MATH_RAW =
  `root = Column([Text("Sine Wave Lab", "h2"), Text("Web only. Change the wave, then move the yellow probe to read its value.", "body"), graph, amplitude, frequency, phase, sample, Button("Reset wave", Action([@Reset($amplitude, $frequency, $phase, $sample)]), "secondary"), Text("A sets the height; k sets the number of cycles over 0 to 2pi. Positive phase shifts the wave left. The dashed curve is sin(x).", "caption")], "start", "stretch", "m")
$amplitude = 1
$frequency = 1
$phase = 0
$sample = 90
amplitude = Slider("Amplitude A", 0.25, 2, $amplitude, 0.25, null, "$amplitude")
frequency = Slider("Frequency k", 0.5, 3, $frequency, 0.5, null, "$frequency")
phase = Slider("Phase (degrees)", -180, 180, $phase, 15, null, "$phase")
sample = Slider("Probe x (degrees)", 0, 360, $sample, 5, null, "$sample")
graph = Canvas(${PARAMETERS} + "const sample = " + $sample + ";" + ${
    JSON.stringify(GRID + WAVE + POINT)
  }, 360, 358, "sine-wave")`;
