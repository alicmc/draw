let width = window.innerWidth;
let height = window.innerHeight;
let center_x = width / 2;
let center_y = height / 2;
let square_size = 100;
var colors = [];
var squares = [];
var selected_color;
var mix_t = [];
let numPigments = 0;
let step = 0;
let dragged = -1;
let line_width = 80;
var ratio = 0.65;
let brush;

function preload() {
  brush = loadImage('http://localhost:8000/brush_stroke.png');
}

function setup() {
  createCanvas(width, height);
  background(255);
  colorMode(RGB);
  stroke(125);
  strokeWeight(3);
  frameRate(1000);

  selected_color = color(0, 0, 0);
  colors = [color(255, 236, 4), color(252, 211, 0), color(255, 105, 0), color(225, 35, 1), color(191, 0, 18), color(128, 2, 46), color(78, 1, 66), color(74, 0, 101), color(16, 31, 61), color(13, 27, 68), color(25, 0, 89), color(8, 34, 138), color(12, 69, 118), color(6, 54, 51), color(0, 74, 41), color(84, 50, 36), color(58, 39, 0), color(13, 9, 1), color(249, 250, 249)];

  numPigments = colors.length;
  square_size = height / numPigments;

  for (let i = 0; i < numPigments; i++) {
    squares.push(i * square_size);
    mix_t.push(0);

    fill(colors[i]);
    rect(0, squares[i], square_size, square_size);
  }

  noStroke();
}

function mouseDragged() {
  if (mouseX > square_size + (line_width / 2)) {
    let old_color = get(pmouseX > mouseX ? mouseX - (line_width / 2) : mouseX + (line_width / 2), mouseY);
    let mixed = mixbox.lerp(selected_color, old_color, ratio);
    //fill(mixed);
    //ellipse(mouseX, mouseY, line_width, line_width);
    tint(mixed);
    image(brush, mouseX - (line_width / 2), mouseY - (line_width / 2), line_width, line_width);
  }
}

function mousePressed() {
  if (mouseX >= 0 && mouseX <= square_size) {
    let index = Math.floor(mouseY / square_size);
    selected_color = colors[index];
  }
}