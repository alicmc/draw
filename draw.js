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

let pigments = [];
let selectedColor;
let selectedIndex = 17;
let brush;
let lineWidth = 80;
let ratio = 0.65;
let drawingLayer;
let history = [];
let strokeStarted = false;

const maxHistory = 18;
const shell = document.getElementById('canvas-shell');
const palette = document.getElementById('palette');
const brushSize = document.getElementById('brush-size');
const brushOutput = document.getElementById('brush-output');
const blendStrength = document.getElementById('blend-strength');
const blendOutput = document.getElementById('blend-output');
const clearButton = document.getElementById('clear-button');
const undoButton = document.getElementById('undo-button');
const saveButton = document.getElementById('save-button');
const statusText = document.getElementById('status');

function preload() {
  brush = loadImage('brush_stroke.png');
}

function setup() {
  const canvas = createCanvas(shell.clientWidth, shell.clientHeight);
  canvas.parent('canvas-shell');
  drawingLayer = createGraphics(width, height);
  drawingLayer.pixelDensity(pixelDensity());
  drawingLayer.background(255, 253, 250);

  colorMode(RGB);
  pigments = pigmentData.map((pigment) => color(...pigment.rgb));
  selectedColor = pigments[selectedIndex];
  frameRate(60);
  noStroke();
  buildPalette();
  bindControls();
  renderCanvas();
}

function draw() {
  renderCanvas();
}

function mousePressed() {
  if (insideCanvas()) {
    pushHistory();
    strokeStarted = true;
    paintAt(mouseX, mouseY, mouseX, mouseY);
  }
}

function mouseDragged() {
  if (insideCanvas()) {
    if (!strokeStarted) {
      pushHistory();
      strokeStarted = true;
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
  drawingLayer.background(255, 253, 250);
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
  brushSize.addEventListener('input', () => {
    lineWidth = Number(brushSize.value);
    brushOutput.value = lineWidth;
  });

  blendStrength.addEventListener('input', () => {
    ratio = Number(blendStrength.value) / 100;
    blendOutput.value = `${blendStrength.value}%`;
  });

  clearButton.addEventListener('click', () => {
    pushHistory();
    drawingLayer.background(255, 253, 250);
    updateStatus('Canvas cleared');
  });

  undoButton.addEventListener('click', undoStroke);

  saveButton.addEventListener('click', () => {
    saveCanvas('pigment-draw', 'png');
    updateStatus('Drawing downloaded');
  });
}

function selectPigment(index) {
  selectedIndex = index;
  selectedColor = pigments[index];
  palette.querySelectorAll('.swatch').forEach((swatch, swatchIndex) => {
    swatch.setAttribute('aria-pressed', String(swatchIndex === selectedIndex));
  });
  updateStatus(`${pigmentData[index].name} selected`);
}

function paintAt(x, y, previousX, previousY) {
  const distance = dist(x, y, previousX, previousY);
  const steps = max(1, ceil(distance / max(3, lineWidth * 0.24)));

  for (let i = 0; i <= steps; i++) {
    const px = lerp(previousX, x, i / steps);
    const py = lerp(previousY, y, i / steps);
    const sampleX = constrain(round(px), 0, width - 1);
    const sampleY = constrain(round(py), 0, height - 1);
    const oldColor = drawingLayer.get(sampleX, sampleY);
    const mixed = mixPigments(selectedColor, oldColor, ratio);

    drawingLayer.push();
    drawingLayer.tint(mixed);
    drawingLayer.image(brush, px - lineWidth / 2, py - lineWidth / 2, lineWidth, lineWidth);
    drawingLayer.pop();
  }
}

function mixPigments(source, target, amount) {
  if (window.mixbox && typeof window.mixbox.lerp === 'function') {
    return window.mixbox.lerp(source, target, amount);
  }

  return color(
    lerp(red(target), red(source), amount),
    lerp(green(target), green(source), amount),
    lerp(blue(target), blue(source), amount)
  );
}

function pushHistory() {
  history.push(drawingLayer.get());
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

  drawingLayer.background(255, 253, 250);
  drawingLayer.image(previous, 0, 0, width, height);
  updateStatus('Undid last stroke');
}

function renderCanvas() {
  background(255, 253, 250);
  image(drawingLayer, 0, 0);
}

function insideCanvas() {
  return mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height;
}

function updateStatus(message) {
  statusText.textContent = message;
}
