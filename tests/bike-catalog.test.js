const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("../bike-catalog.js"), "utf8");
const window = {};
vm.runInNewContext(source, { window });
const catalog = window.MotoBikeCatalog;

function years(make, model) {
  return Object.keys(catalog)
    .filter((year) => Object.hasOwn(catalog[year]?.[make] || {}, model))
    .map(Number)
    .sort((a, b) => a - b);
}

test("catalog covers expected model-year boundaries", () => {
  const cases = [
    ["Honda", "CRF250R", 2004, 2027], ["Honda", "CRF450R", 2002, 2027],
    ["Kawasaki", "KX250", 2021, 2026],
    ["Yamaha", "YZ125", 1974, 2027], ["Yamaha", "YZ250F", 2001, 2027], ["Suzuki", "RM-Z250", 2004, 2026],
    ["KTM", "250 SX-F", 2006, 2027], ["Husqvarna", "FC 250", 2014, 2027], ["Husqvarna", "FC 250 Factory Edition", 2027, 2027],
    ["GasGas", "MC 250F", 2021, 2026], ["Triumph", "TF 250-X", 2024, 2027],
    ["Triumph", "TF 450-RC", 2025, 2025], ["Triumph", "TF 450-X", 2026, 2027],
  ];
  assert.deepEqual(years("Kawasaki", "KX250F"), [...Array.from({ length: 17 }, (_, i) => 2004 + i), 2027]);
  assert.deepEqual(years("Kawasaki", "KX450F"), [...Array.from({ length: 13 }, (_, i) => 2006 + i), 2027]);
  for (const [make, model, first, last] of cases) {
    const available = years(make, model);
    assert.equal(available[0], first, `${make} ${model} start`);
    assert.equal(available.at(-1), last, `${make} ${model} end`);
    assert.equal(available.length, last - first + 1, `${make} ${model} has no holes`);
  }
});

test("every selectable model has an engine type and a valid year", () => {
  for (const [year, makes] of Object.entries(catalog)) {
    assert.match(year, /^\d{4}$/);
    for (const models of Object.values(makes)) {
      assert.ok(Object.keys(models).length > 0);
      for (const engine of Object.values(models)) assert.ok(["2-stroke", "4-stroke"].includes(engine));
    }
  }
});

test("model and make changes naturally expose their own year lists", () => {
  assert.deepEqual(years("Honda", "CRF250R").slice(0, 3), [2004, 2005, 2006]);
  assert.deepEqual(years("Yamaha", "YZ250F").slice(0, 3), [2001, 2002, 2003]);
  assert.deepEqual(years("Kawasaki", "KX250"), Array.from({ length: 6 }, (_, i) => 2021 + i));
  assert.equal(catalog[2025].Triumph["TF 450-RC"], "4-stroke");
});





test("make and model selector changes refresh their dependent options", () => {
  const app = fs.readFileSync(require.resolve("../index.html"), "utf8");
  assert.match(app, /document\.getElementById\("make"\)\.addEventListener\("change",\(\)=>refreshModelOptions\(\)\)/);
  assert.match(app, /document\.getElementById\("model"\)\.addEventListener\("change",\(\)=>refreshYearOptions\(\)\)/);
  assert.match(app, /function refreshModelOptions\(preferred=""\)[\s\S]*?refreshYearOptions\(\);/);
});
