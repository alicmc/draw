const pigmentData = [
  { name: 'Cadmium lemon', rgb: [255, 236, 4] },
  { name: 'Warm yellow', rgb: [252, 211, 0] },
  { name: 'Orange', rgb: [255, 105, 0] },
  { name: 'Vermilion', rgb: [225, 35, 1] },
  { name: 'Carmine', rgb: [191, 0, 18] },
  { name: 'Alizarin', rgb: [128, 2, 46] },
  { name: 'Aubergine', rgb: [78, 1, 66] },
  { name: 'Violet', rgb: [74, 0, 101] },
  { name: 'Payne blue', rgb: [16, 31, 61] },
  { name: 'Indigo', rgb: [13, 27, 68] },
  { name: 'Ultramarine', rgb: [25, 0, 89] },
  { name: 'Cobalt', rgb: [8, 34, 138] },
  { name: 'Prussian blue', rgb: [12, 69, 118] },
  { name: 'Deep teal', rgb: [6, 54, 51] },
  { name: 'Viridian', rgb: [0, 74, 41] },
  { name: 'Burnt umber', rgb: [84, 50, 36] },
  { name: 'Raw umber', rgb: [58, 39, 0] },
  { name: 'Lamp black', rgb: [13, 9, 1] },
  { name: 'Titanium white', rgb: [249, 250, 249] },
];

const paperRgb = [255, 253, 250];
const maxHistory = 18;
const brushWidth = 96;
const overlayMixAmount = 0.08;
const paperTolerance = 18;
const scoreDistanceScale = 235;
const scoreExponent = 1.65;

let pigments = [];
let selectedColor;
let selectedIndex = 0;
let brush;
let drawingLayer;
let history = [];
let strokeStarted = false;
let currentMix;
let strokeColor;
let targetColor;
let bestScore = Number(localStorage.getItem('pigmentMatchBest') || 0);

const shell = document.getElementById('canvas-shell');
const palette = document.getElementById('palette');
const checkButton = document.getElementById('check-button');
const undoButton = document.getElementById('undo-button');
const resetButton = document.getElementById('reset-button');
const nextButton = document.getElementById('next-button');
const statusText = document.getElementById('status');
const targetChip = document.getElementById('target-chip');
const mixChip = document.getElementById('mix-chip');
const scoreValue = document.getElementById('score-value');
const bestValue = document.getElementById('best-value');

function preload() {
  brush = loadImage('brush_stroke.png');
}

function setup() {
  const canvas = createCanvas(shell.clientWidth, shell.clientHeight);
  canvas.parent('canvas-shell');
  colorMode(RGB);
  pigments = pigmentData.map((pigment) => color(...pigment.rgb));
  selectedColor = pigments[selectedIndex];

  drawingLayer = createGraphics(width, height);
  drawingLayer.pixelDensity(pixelDensity());
  drawingLayer.background(...paperRgb);

  currentMix = color(...paperRgb);
  frameRate(60);
  noStroke();

  buildPalette();
  bindControls();
  startRound();
  renderCanvas();
}

function draw() {
  renderCanvas();
}

function mousePressed() {
  if (insideCanvas()) {
    beginStroke();
    paintAt(mouseX, mouseY, mouseX, mouseY);
  }
}

function mouseDragged() {
  if (insideCanvas()) {
    if (!strokeStarted) {
      beginStroke();
    }
    paintAt(mouseX, mouseY, pmouseX, pmouseY);
  }
}

function mouseReleased() {
  strokeStarted = false;
}

function touchStarted() {
  mousePressed();
  return false;
}

function touchMoved() {
  mouseDragged();
  return false;
}

function touchEnded() {
  mouseReleased();
  return false;
}

function windowResized() {
  const previous = drawingLayer.get();
  resizeCanvas(shell.clientWidth, shell.clientHeight);
  drawingLayer = createGraphics(width, height);
  drawingLayer.pixelDensity(pixelDensity());
  drawingLayer.background(...paperRgb);
  drawingLayer.image(previous, 0, 0, width, height);
}

function buildPalette() {
  palette.innerHTML = '';
  pigmentData.forEach((pigment, index) => {
    const swatch = document.createElement('button');
    const [r, g, b] = pigment.rgb;
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = `rgb(${r}, ${g}, ${b})`;
    swatch.setAttribute('aria-label', `Select ${pigment.name}`);
    swatch.setAttribute('aria-pressed', String(index === selectedIndex));
    swatch.title = pigment.name;
    swatch.addEventListener('click', () => selectPigment(index));
    palette.appendChild(swatch);
  });
}

function bindControls() {
  checkButton.addEventListener('click', scoreMix);
  undoButton.addEventListener('click', undoStroke);
  resetButton.addEventListener('click', resetMix);
  nextButton.addEventListener('click', startRound);
}

function startRound() {
  history = [];
  targetColor = makeTargetColor();
  resetMix(false);
  scoreValue.textContent = '--';
  bestValue.textContent = bestScore ? `${bestScore}%` : '--';
  paintChip(targetChip, targetColor);
  updateStatus('New target. Choose pigments and mix.');
}

function resetMix(announce = true) {
  history = [];
  currentMix = color(...paperRgb);
  drawingLayer.background(...paperRgb);
  paintChip(mixChip, currentMix);
  if (announce) {
    updateStatus('Mix reset');
  }
}

function makeTargetColor() {
  const usable = pigments.filter((_, index) => index !== 17);
  let mixed = usable[floor(random(usable.length))];
  const steps = floor(random(2, 5));

  for (let i = 0; i < steps; i++) {
    const next = usable[floor(random(usable.length))];
    mixed = mixPigments(next, mixed, random(0.22, 0.62));
  }

  if (random() > 0.45) {
    mixed = mixPigments(pigments[18], mixed, random(0.08, 0.38));
  }

  if (random() > 0.72) {
    mixed = mixPigments(pigments[17], mixed, random(0.04, 0.2));
  }

  return mixed;
}

function selectPigment(index) {
  selectedIndex = index;
  selectedColor = pigments[index];
  palette.querySelectorAll('.swatch').forEach((swatch, swatchIndex) => {
    swatch.setAttribute('aria-pressed', String(swatchIndex === selectedIndex));
  });
  updateStatus(`${pigmentData[index].name} loaded`);
}

function beginStroke() {
  pushHistory();
  strokeStarted = true;
  const underPaint = samplePaintUnder(mouseX, mouseY);
  strokeColor = underPaint ? mixPigments(selectedColor, underPaint, overlayMixAmount) : selectedColor;
  currentMix = strokeColor;
  paintChip(mixChip, currentMix);
}

function paintAt(x, y, previousX, previousY) {
  const distance = dist(x, y, previousX, previousY);
  const steps = max(1, ceil(distance / max(3, brushWidth * 0.18)));

  for (let i = 0; i <= steps; i++) {
    const px = lerp(previousX, x, i / steps);
    const py = lerp(previousY, y, i / steps);
    drawingLayer.push();
    drawingLayer.tint(strokeColor);
    drawingLayer.image(brush, px - brushWidth / 2, py - brushWidth / 2, brushWidth, brushWidth);
    drawingLayer.pop();
  }
}

function samplePaintUnder(x, y) {
  const radius = brushWidth * 0.35;
  const stride = max(6, floor(brushWidth / 8));
  const totals = [0, 0, 0];
  let count = 0;

  for (let offsetY = -radius; offsetY <= radius; offsetY += stride) {
    for (let offsetX = -radius; offsetX <= radius; offsetX += stride) {
      if (offsetX * offsetX + offsetY * offsetY > radius * radius) {
        continue;
      }

      const sampleX = constrain(round(x + offsetX), 0, width - 1);
      const sampleY = constrain(round(y + offsetY), 0, height - 1);
      const rgb = colorToRgb(drawingLayer.get(sampleX, sampleY));

      if (isPainted(rgb)) {
        totals[0] += rgb[0];
        totals[1] += rgb[1];
        totals[2] += rgb[2];
        count += 1;
      }
    }
  }

  if (!count) {
    return null;
  }

  return color(
    totals[0] / count,
    totals[1] / count,
    totals[2] / count
  );
}

function isPainted(rgb) {
  return Math.abs(rgb[0] - paperRgb[0]) > paperTolerance ||
    Math.abs(rgb[1] - paperRgb[1]) > paperTolerance ||
    Math.abs(rgb[2] - paperRgb[2]) > paperTolerance;
}

function scoreMix() {
  const score = calculateScore(currentMix, targetColor);
  scoreValue.textContent = `${score}%`;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('pigmentMatchBest', String(bestScore));
    bestValue.textContent = `${bestScore}%`;
  }

  if (score >= 95) {
    updateStatus(`${score}% - exacting studio magic`);
  } else if (score >= 84) {
    updateStatus(`${score}% - beautifully close`);
  } else if (score >= 68) {
    updateStatus(`${score}% - close, tune the undertone`);
  } else {
    updateStatus(`${score}% - keep mixing`);
  }
}

function calculateScore(source, target) {
  const [sr, sg, sb] = colorToRgb(source);
  const [tr, tg, tb] = colorToRgb(target);
  const distance = Math.sqrt((sr - tr) ** 2 + (sg - tg) ** 2 + (sb - tb) ** 2);
  const closeness = constrain(1 - distance / scoreDistanceScale, 0, 1);
  return Math.round((closeness ** scoreExponent) * 100);
}

function mixPigments(source, target, amount) {
  if (window.mixbox && typeof window.mixbox.lerp === 'function') {
    return color(...colorToRgb(window.mixbox.lerp(target, source, amount)));
  }

  return color(
    lerp(red(target), red(source), amount),
    lerp(green(target), green(source), amount),
    lerp(blue(target), blue(source), amount)
  );
}

function colorToRgb(value) {
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((channel) => constrain(round(channel), 0, 255));
  }

  return [
    constrain(round(red(value)), 0, 255),
    constrain(round(green(value)), 0, 255),
    constrain(round(blue(value)), 0, 255),
  ];
}

function paintChip(element, paintColor) {
  const [r, g, b] = colorToRgb(paintColor);
  element.style.background = `rgb(${r}, ${g}, ${b})`;
}

function pushHistory() {
  history.push({
    image: drawingLayer.get(),
    mix: color(...colorToRgb(currentMix)),
  });

  if (history.length > maxHistory) {
    history.shift();
  }
}

function undoStroke() {
  const previous = history.pop();
  if (!previous) {
    updateStatus('Nothing to undo');
    return;
  }

  currentMix = previous.mix;
  drawingLayer.background(...paperRgb);
  drawingLayer.image(previous.image, 0, 0, width, height);
  paintChip(mixChip, currentMix);
  updateStatus('Undid last stroke');
}

function keyPressed() {
  if (key === 'z' || key === 'Z') {
    undoStroke();
  }
}

function renderCanvas() {
  background(...paperRgb);
  image(drawingLayer, 0, 0);
}

function insideCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function updateStatus(message) {
  statusText.textContent = message;
}
