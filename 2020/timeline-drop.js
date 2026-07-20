/// <reference types="matter-js" />
// @ts-check

// module aliases
var Engine = Matter.Engine,
  Render = Matter.Render,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Events = Matter.Events;

// create an engine
var engine = Engine.create();
engine.world.gravity.scale = 0.00065;

// create a renderer
var render = Render.create({
  element: document.body,
  engine: engine,
  options: {
    width: 800,
    height: 400,
    background: "#fafafa",
    wireframes: false
  },
});

const ground = Bodies.rectangle(400, 410, 810, 20, { isStatic: true });
const left = Bodies.rectangle(-10, 200, 20, 400, { isStatic: true });
const right = Bodies.rectangle(810, 200, 20, 400, { isStatic: true });
World.add(engine.world, [ground, left, right]);

// An invisible roof keeps the name clear and sends blocks down both sides.
const roofOptions = {
  isStatic: true,
  friction: 0,
  restitution: 0.05,
  render: { visible: false },
};
const leftRoof = Bodies.rectangle(327, 101, 132, 10, {
  ...roofOptions,
  angle: -0.48,
});
const rightRoof = Bodies.rectangle(433, 101, 132, 10, {
  ...roofOptions,
  angle: 0.48,
});
World.add(engine.world, [leftRoof, rightRoof]);

const colors = ["#40c463", "#216e39", "#30a14e", "#9be9a8", "#ebedf0"];
const weeks = 52;
const days = 7;
const xOffset = 40
const yOffset = -80
const xMargin = 4
const yMargin = 4

const letters = document.getElementById("orta")?.querySelectorAll("path")
const letterPaths = Array.from(letters).map(path => new Path2D(path.getAttribute("d")))

// Render the SVG paths directly so the letters stay smooth and seamless.
Events.on(render, "afterRender", () => {
  const context = render.context;
  context.save();
  context.translate(286.23, 68.5);
  context.fillStyle = "#1f1d2e";
  letterPaths.forEach(path => context.fill(path));
  context.restore();
});

// Timeline
const bodies = [];
for (let i = 0; i < weeks; i++) {
  for (let j = 0; j < days; j++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const x = xOffset + (i * 10) + ((i - 1) * xMargin)
    const y = yOffset + (j * 10) + ((j - 1) * yMargin)
    const square = Bodies.rectangle(x, y, 10, 10, {
      render: { fillStyle: color },
      density: 20,
    });
    // square.angle = Math.random() * 2 - 4;
    bodies.push(square);
  }
}
World.add(engine.world, bodies);

// create two boxes and a ground
var boxA = Bodies.rectangle(400, 200, 10, 10, { render: { fillStyle: "#40c463" } });
var boxB = Bodies.rectangle(450, 50, 10, 10, { render: { fillStyle: "#216e39" } });
ground;

// run the engine
var runner = Engine.run(engine);

// run the renderer
Render.run(render);
