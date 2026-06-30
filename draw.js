const pigmentData = [
  { name: "Cadmium lemon", rgb: [255, 236, 4] },
  { name: "Warm yellow", rgb: [252, 211, 0] },
  { name: "Orange", rgb: [255, 105, 0] },
  { name: "Vermilion", rgb: [225, 35, 1] },
  { name: "Carmine", rgb: [191, 0, 18] },
  { name: "Alizarin", rgb: [128, 2, 46] },
  { name: "Aubergine", rgb: [78, 1, 66] },
  { name: "Violet", rgb: [74, 0, 101] },
  { name: "Payne blue", rgb: [16, 31, 61] },
  { name: "Indigo", rgb: [13, 27, 68] },
  { name: "Ultramarine", rgb: [25, 0, 89] },
  { name: "Cobalt", rgb: [8, 34, 138] },
  { name: "Prussian blue", rgb: [12, 69, 118] },
  { name: "Deep teal", rgb: [6, 54, 51] },
  { name: "Viridian", rgb: [0, 74, 41] },
  { name: "Burnt umber", rgb: [84, 50, 36] },
  { name: "Raw umber", rgb: [58, 39, 0] },
  { name: "Lamp black", rgb: [13, 9, 1] },
  { name: "Titanium white", rgb: [249, 250, 249] },
];

const paperRgb = [255, 253, 250];
const maxHistory = 18;
const brushWidth = 96;
const overlayMixAmount = 0.13;
const paperTolerance = 18;
const scoreDistanceScale = 235;
const scoreExponent = 1.65;
const memeEndpoint = "https://meme-api.com/gimme";
const imageProxyEndpoint = "https://images.weserv.nl/";

let pigments = [];
let selectedColor;
let selectedIndex = 0;
let brush;
let drawingLayer;
let history = [];
let strokeStarted = false;
let touchDrawing = false;
let currentMix;
let strokeColor;
let targetColor;
let bestScore = Number(localStorage.getItem("pigmentMatchBest") || 0);
let roundRequestId = 0;

const shell = document.getElementById("canvas-shell");
const panel = document.querySelector(".panel");
const palette = document.getElementById("palette");
const matchBoard = document.getElementById("match-board");
const mobileMatchAnchor = document.getElementById("mobile-match-anchor");
const scoreBoard = document.querySelector(".score-board");
const checkButton = document.getElementById("check-button");
const undoButton = document.getElementById("undo-button");
const resetButton = document.getElementById("reset-button");
const nextButton = document.getElementById("next-button");
const statusText = document.getElementById("status");
const targetChip = document.getElementById("target-chip");
const mixChip = document.getElementById("mix-chip");
const memeImage = document.getElementById("meme-image");
const memeLink = document.getElementById("meme-link");
const scoreValue = document.getElementById("score-value");
const bestValue = document.getElementById("best-value");
const mobileLayout = window.matchMedia("(max-width: 780px)");

mobileLayout.addEventListener("change", placeMatchBoard);

function preload() {
  brush = loadImage("brush_stroke.png");
}

function setup() {
  const canvas = createCanvas(shell.clientWidth, shell.clientHeight);
  canvas.parent("canvas-shell");
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
  placeMatchBoard();
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

function touchStarted(event) {
  touchDrawing = touchEventInsideCanvas(event);
  if (!touchDrawing) {
    return true;
  }
  mousePressed();
  return false;
}

function touchMoved() {
  if (!touchDrawing) {
    return true;
  }
  mouseDragged();
  return false;
}

function touchEnded() {
  if (touchDrawing) {
    mouseReleased();
    touchDrawing = false;
    return false;
  }
  touchDrawing = false;
  return true;
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
  palette.innerHTML = "";
  pigmentData.forEach((pigment, index) => {
    const swatch = document.createElement("button");
    const [r, g, b] = pigment.rgb;
    swatch.type = "button";
    swatch.className = "swatch";
    swatch.style.background = `rgb(${r}, ${g}, ${b})`;
    swatch.setAttribute("aria-label", `Select ${pigment.name}`);
    swatch.setAttribute("aria-pressed", String(index === selectedIndex));
    swatch.title = pigment.name;
    swatch.addEventListener("click", () => selectPigment(index));
    palette.appendChild(swatch);
  });
}

function bindControls() {
  checkButton.addEventListener("click", scoreMix);
  undoButton.addEventListener("click", undoStroke);
  resetButton.addEventListener("click", resetMix);
  nextButton.addEventListener("click", startRound);
}

function placeMatchBoard() {
  if (mobileLayout.matches) {
    mobileMatchAnchor.appendChild(matchBoard);
    return;
  }
  panel.insertBefore(matchBoard, scoreBoard);
}

async function fetchMeme() {
  const response = await fetch(memeEndpoint, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Meme request failed");
  }
  return response.json();
}

function getBestMemeImageUrl(meme) {
  const preview = Array.isArray(meme.preview)
    ? meme.preview[meme.preview.length - 1]
    : null;
  return meme.url || preview;
}

function showMeme(meme, imageUrl, sourceUrl) {
  memeImage.hidden = false;
  memeImage.src = imageUrl;
  memeImage.alt = meme.title ? `Meme prompt: ${meme.title}` : "Meme prompt";
  memeLink.hidden = false;
  memeLink.href = meme.postLink || sourceUrl || imageUrl;
  memeLink.textContent = meme.title ? trimTitle(meme.title) : "Open source";
}

function clearMeme() {
  memeImage.hidden = true;
  memeImage.removeAttribute("src");
  memeImage.alt = "";
  memeLink.hidden = true;
  memeLink.href = "#";
  memeLink.textContent = "Open source";
}

function trimTitle(title) {
  return title.length > 34 ? `${title.slice(0, 31)}...` : title;
}

function proxyImageUrl(imageUrl) {
  const url = new URL(imageProxyEndpoint);
  url.searchParams.set("url", imageUrl.replace(/^https?:\/\//, ""));
  url.searchParams.set("output", "jpg");
  return url.toString();
}

async function getDominantImageColor(imageUrl) {
  const image = await loadImageElement(imageUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const size = 48;

  canvas.width = size;
  canvas.height = size;
  context.drawImage(image, 0, 0, size, size);

  const pixels = context.getImageData(0, 0, size, size).data;
  const buckets = new Map();
  const fallbackBuckets = new Map();

  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3];
    if (alpha < 200) {
      continue;
    }

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];

    const rgb = [r, g, b];
    if (isNearWhite(rgb) || isNearBlack(rgb)) {
      continue;
    }

    const key = `${r >> 4},${g >> 4},${b >> 4}`;
    const hsl = rgbToHsl(r, g, b);
    const neutral = hsl.s < 0.25 || hsl.l < 0.16 || hsl.l > 0.88;
    const targetBuckets = neutral ? fallbackBuckets : buckets;
    const bucket = targetBuckets.get(key) || {
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      score: 0,
    };
    const lightnessScore = 1 - Math.min(1, Math.abs(hsl.l - 0.52) / 0.52);
    const saturationScore = Math.min(1, hsl.s / 0.65);
    const pixelScore =
      0.05 + saturationScore * saturationScore * 8 + lightnessScore * 0.3;

    bucket.count += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.score += pixelScore;
    targetBuckets.set(key, bucket);
  }

  const candidates = buckets.size ? buckets : fallbackBuckets;
  const dominant = [...candidates.values()].sort(
    (a, b) => b.score - a.score,
  )[0];
  if (!dominant) {
    throw new Error("No dominant color found");
  }

  return [
    round(dominant.r / dominant.count),
    round(dominant.g / dominant.count),
    round(dominant.b / dominant.count),
  ];
}

function loadImageElement(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Meme image failed to load"));
    image.src = imageUrl;
  });
}

function isNearWhite(rgb) {
  return rgb[0] > 238 && rgb[1] > 238 && rgb[2] > 238;
}

function isNearBlack(rgb) {
  return rgb[0] < 18 && rgb[1] < 18 && rgb[2] < 18;
}

function rgbToHsl(r, g, b) {
  const redValue = r / 255;
  const greenValue = g / 255;
  const blueValue = b / 255;
  const maxValue = Math.max(redValue, greenValue, blueValue);
  const minValue = Math.min(redValue, greenValue, blueValue);
  const lightness = (maxValue + minValue) / 2;
  const delta = maxValue - minValue;

  if (delta === 0) {
    return { h: 0, s: 0, l: lightness };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;

  if (maxValue === redValue) {
    hue = ((greenValue - blueValue) / delta) % 6;
  } else if (maxValue === greenValue) {
    hue = (blueValue - redValue) / delta + 2;
  } else {
    hue = (redValue - greenValue) / delta + 4;
  }

  return { h: hue * 60, s: saturation, l: lightness };
}

async function startRound() {
  const requestId = ++roundRequestId;
  history = [];
  resetMix(false);
  scoreValue.textContent = "--";
  bestValue.textContent = bestScore ? `${bestScore}%` : "--";
  updateStatus("Fetching meme...");

  try {
    const meme = await fetchMeme();
    if (requestId !== roundRequestId) {
      return;
    }

    const sourceImageUrl = getBestMemeImageUrl(meme);
    const imageUrl = proxyImageUrl(sourceImageUrl);
    const dominant = await getDominantImageColor(imageUrl);
    if (requestId !== roundRequestId) {
      return;
    }

    targetColor = color(...dominant);
    showMeme(meme, imageUrl, sourceImageUrl);
    updateStatus("Match the meme color");
  } catch (error) {
    targetColor = makeTargetColor();
    clearMeme();
    updateStatus("Meme image blocked. Random target loaded.");
  }

  paintChip(targetChip, targetColor);
}

function resetMix(announce = true) {
  history = [];
  currentMix = color(...paperRgb);
  drawingLayer.background(...paperRgb);
  paintChip(mixChip, currentMix);
  if (announce) {
    updateStatus("Mix reset");
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
  palette.querySelectorAll(".swatch").forEach((swatch, swatchIndex) => {
    swatch.setAttribute("aria-pressed", String(swatchIndex === selectedIndex));
  });
  updateStatus(`${pigmentData[index].name} loaded`);
}

function beginStroke() {
  pushHistory();
  strokeStarted = true;
  const underPaint = samplePaintUnder(mouseX, mouseY);
  strokeColor = underPaint
    ? mixPigments(selectedColor, underPaint, overlayMixAmount)
    : selectedColor;
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
    drawingLayer.image(
      brush,
      px - brushWidth / 2,
      py - brushWidth / 2,
      brushWidth,
      brushWidth,
    );
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

  return color(totals[0] / count, totals[1] / count, totals[2] / count);
}

function isPainted(rgb) {
  return (
    Math.abs(rgb[0] - paperRgb[0]) > paperTolerance ||
    Math.abs(rgb[1] - paperRgb[1]) > paperTolerance ||
    Math.abs(rgb[2] - paperRgb[2]) > paperTolerance
  );
}

function scoreMix() {
  const score = calculateScore(currentMix, targetColor);
  scoreValue.textContent = `${score}%`;

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem("pigmentMatchBest", String(bestScore));
    bestValue.textContent = `${bestScore}%`;
  }

  if (score >= 95) {
    updateStatus(`${score}% - good soup`);
  } else if (score >= 84) {
    updateStatus(`${score}% - not bad bud`);
  } else if (score >= 68) {
    updateStatus(`${score}% - yer getting somewhere`);
  } else {
    updateStatus(`${score}% - better keep mixing`);
  }
}

function calculateScore(source, target) {
  const [sr, sg, sb] = colorToRgb(source);
  const [tr, tg, tb] = colorToRgb(target);
  const distance = Math.sqrt((sr - tr) ** 2 + (sg - tg) ** 2 + (sb - tb) ** 2);
  const closeness = constrain(1 - distance / scoreDistanceScale, 0, 1);
  return Math.round(closeness ** scoreExponent * 100);
}

function mixPigments(source, target, amount) {
  if (window.mixbox && typeof window.mixbox.lerp === "function") {
    return color(...colorToRgb(window.mixbox.lerp(target, source, amount)));
  }

  return color(
    lerp(red(target), red(source), amount),
    lerp(green(target), green(source), amount),
    lerp(blue(target), blue(source), amount),
  );
}

function colorToRgb(value) {
  if (Array.isArray(value)) {
    return value
      .slice(0, 3)
      .map((channel) => constrain(round(channel), 0, 255));
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
    updateStatus("Nothing to undo");
    return;
  }

  currentMix = previous.mix;
  drawingLayer.background(...paperRgb);
  drawingLayer.image(previous.image, 0, 0, width, height);
  paintChip(mixChip, currentMix);
  updateStatus("Undid last stroke");
}

function keyPressed() {
  if (key === "z" || key === "Z") {
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

function touchEventInsideCanvas(event) {
  const touch = event?.changedTouches?.[0] || event?.touches?.[0];
  if (!touch) {
    return insideCanvas();
  }
  const rect = shell.getBoundingClientRect();
  return (
    touch.clientX >= rect.left &&
    touch.clientX <= rect.right &&
    touch.clientY >= rect.top &&
    touch.clientY <= rect.bottom
  );
}

function updateStatus(message) {
  statusText.textContent = message;
}
