const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

test("gearing page script parses and exposes live inputs and graph labels", () => {
  const html = fs.readFileSync(require.resolve("../index.html"), "utf8");
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1]));
  for (const id of ["proposedFront", "proposedRear", "primaryReduction", "transmissionGear", "gearRatio", "tireCircumference", "speedUnit", "referenceRpm", "referenceSpeed", "graphMaxRpm"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /Engine RPM/);
  assert.match(html, /Theoretical vehicle speed/);
  assert.match(html, /Current gearing/);
  assert.match(html, /Proposed gearing/);
});
