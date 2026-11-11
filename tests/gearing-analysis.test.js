const test = require("node:test");
const assert = require("node:assert/strict");
const Gearing = require("../gearing-analysis.js");

const current = { front: 13, rear: 50 };
const taller = { front: 14, rear: 50 };
const shorter = { front: 13, rear: 52 };
const specs = { primaryReduction: 3, transmissionRatio: 1.8, tireCircumference: 2, circumferenceUnit: "m", speedUnit: "kmh" };

 test("final drive ratio is rear sprocket teeth divided by front teeth", () => {
  assert.equal(Gearing.finalDriveRatio(13, 50), 50 / 13);
});

test("comparison identifies taller and shorter gearing and exact ratio percentages", () => {
  const tallerResult = Gearing.compareGearing(current, taller);
  assert.equal(tallerResult.direction, "taller");
  assert.ok(Math.abs(tallerResult.ratioChangePercent - ((50 / 14) / (50 / 13) - 1) * 100) < 1e-10);
  assert.ok(Math.abs(tallerResult.speedChangePercent - (14 / 13 - 1) * 100) < 1e-10);
  assert.ok(Math.abs(tallerResult.rearWheelTorqueChangePercent - tallerResult.ratioChangePercent) < 1e-10);
  assert.equal(Gearing.compareGearing(current, shorter).direction, "shorter");
  assert.equal(Gearing.compareGearing(current, current).direction, "unchanged");
});

test("speed and RPM comparisons are reciprocal at equal RPM or road speed", () => {
  const result = Gearing.compareGearing(current, taller);
  const currentSpeed = Gearing.speedAtRpm(10000, current.front, current.rear, specs).kmh;
  const proposedSpeed = Gearing.speedAtRpm(10000, taller.front, taller.rear, specs).kmh;
  assert.ok(Math.abs((proposedSpeed / currentSpeed - 1) * 100 - result.speedChangePercent) < 1e-10);
  const currentRpm = Gearing.rpmAtRoadSpeed(60, current.front, current.rear, specs);
  const proposedRpm = Gearing.rpmAtRoadSpeed(60, taller.front, taller.rear, specs);
  assert.ok(Math.abs((proposedRpm / currentRpm - 1) * 100 - result.rpmChangePercent) < 1e-10);
});

test("graph samples both sprocket combinations using selected reductions and tire size", () => {
  const graph = Gearing.graphData(current, taller, { ...specs, maxRpm: 14000 });
  assert.equal(graph.points.length, 21);
  assert.equal(graph.points[0].currentSpeed, 0);
  assert.equal(graph.points.at(-1).rpm, 14000);
  assert.ok(graph.points.at(-1).proposedSpeed > graph.points.at(-1).currentSpeed);
  assert.equal(graph.unit, "kmh");
});

test("invalid, missing, and non-whole-number sprocket inputs are rejected", () => {
  assert.throws(() => Gearing.finalDriveRatio(0, 50), /greater than zero/);
  assert.throws(() => Gearing.finalDriveRatio(13.5, 50), /whole number/);
  assert.throws(() => Gearing.compareGearing(current, { front: "", rear: 50 }), /required/);
  assert.deepEqual(Gearing.missingSpecifications({}), ["primary reduction ratio", "transmission ratio for the selected gear", "rear tire rolling circumference"]);
  assert.throws(() => Gearing.speedAtRpm(10000, 13, 50, { ...specs, primaryReduction: "" }), /Missing specifications/);
  assert.throws(() => Gearing.speedAtRpm(10000, 13, 50, { ...specs, tireCircumference: 0 }), /greater than zero/);
});

test("MPH and km/h conversions are consistent", () => {
  const mph = Gearing.speedAtRpm(10000, 13, 50, { ...specs, speedUnit: "mph" });
  const kmh = Gearing.speedAtRpm(10000, 13, 50, { ...specs, speedUnit: "kmh" });
  assert.ok(Math.abs(kmh.value * Gearing.MPH_PER_KMH - mph.value) < 1e-10);
  assert.ok(Math.abs(mph.value * Gearing.KMH_PER_MPH - kmh.value) < 1e-10);
});
