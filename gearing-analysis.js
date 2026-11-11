(function(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MotoGearing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  "use strict";
  const MPH_PER_KMH = 0.621371192237334;
  const KMH_PER_MPH = 1 / MPH_PER_KMH;

  function positiveNumber(value, name) {
    if (value === null || value === undefined || String(value).trim() === "") {
      throw new RangeError(`${name} is required.`);
    }
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) throw new RangeError(`${name} must be a number greater than zero.`);
    return number;
  }

  function sprocketTeeth(value, name) {
    const teeth = positiveNumber(value, name);
    if (!Number.isInteger(teeth)) throw new RangeError(`${name} must be a whole number of teeth.`);
    return teeth;
  }

  function finalDriveRatio(frontTeeth, rearTeeth) {
    return sprocketTeeth(rearTeeth, "Rear sprocket teeth") / sprocketTeeth(frontTeeth, "Front sprocket teeth");
  }

  function compareGearing(current, proposed) {
    const currentRatio = finalDriveRatio(current.front, current.rear);
    const proposedRatio = finalDriveRatio(proposed.front, proposed.rear);
    const ratioChangePercent = (proposedRatio / currentRatio - 1) * 100;
    const speedChangePercent = (currentRatio / proposedRatio - 1) * 100;
    const rpmChangePercent = ratioChangePercent;
    const direction = Math.abs(ratioChangePercent) < 1e-10 ? "unchanged" : ratioChangePercent < 0 ? "taller" : "shorter";
    return {
      currentRatio, proposedRatio, ratioChangePercent, direction,
      speedChangePercent, rpmChangePercent,
      rearWheelTorqueChangePercent: ratioChangePercent
    };
  }

  function missingSpecifications(specs) {
    const required = [
      ["primaryReduction", "primary reduction ratio"],
      ["transmissionRatio", "transmission ratio for the selected gear"],
      ["tireCircumference", "rear tire rolling circumference"]
    ];
    return required.filter(([key]) => specs[key] === null || specs[key] === undefined || String(specs[key]).trim() === "").map(([, label]) => label);
  }

  function speedContext(specs) {
    const missing = missingSpecifications(specs);
    if (missing.length) throw new RangeError(`Missing specifications: ${missing.join(", ")}.`);
    const primary = positiveNumber(specs.primaryReduction, "Primary reduction ratio");
    const gear = positiveNumber(specs.transmissionRatio, "Selected-gear transmission ratio");
    const circumference = positiveNumber(specs.tireCircumference, "Rear tire rolling circumference");
    const unit = specs.circumferenceUnit || "in";
    const metersPerUnit = unit === "in" ? 0.0254 : unit === "mm" ? 0.001 : unit === "m" ? 1 : NaN;
    if (!Number.isFinite(metersPerUnit)) throw new RangeError("Tire circumference unit must be inches, millimeters, or meters.");
    const speedUnit = specs.speedUnit || "mph";
    if (speedUnit !== "mph" && speedUnit !== "kmh") throw new RangeError("Speed unit must be mph or km/h.");
    return { overallOtherReduction: primary * gear, circumferenceMeters: circumference * metersPerUnit, speedUnit };
  }

  function speedAtRpm(rpmValue, frontTeeth, rearTeeth, specs) {
    const rpm = positiveNumber(rpmValue, "Engine RPM");
    const context = speedContext(specs);
    const overallRatio = context.overallOtherReduction * finalDriveRatio(frontTeeth, rearTeeth);
    const kmh = rpm / overallRatio * context.circumferenceMeters * 60 / 1000;
    const mph = kmh * MPH_PER_KMH;
    return { kmh, mph, value: context.speedUnit === "mph" ? mph : kmh, unit: context.speedUnit };
  }

  function rpmAtRoadSpeed(speedValue, frontTeeth, rearTeeth, specs) {
    const roadSpeed = positiveNumber(speedValue, "Reference road speed");
    const context = speedContext(specs);
    const kmh = context.speedUnit === "mph" ? roadSpeed * KMH_PER_MPH : roadSpeed;
    const wheelRevolutionsPerMinute = kmh * 1000 / 60 / context.circumferenceMeters;
    return wheelRevolutionsPerMinute * context.overallOtherReduction * finalDriveRatio(frontTeeth, rearTeeth);
  }

  function graphData(current, proposed, specs) {
    const comparison = compareGearing(current, proposed);
    const maxRpm = positiveNumber(specs.maxRpm, "Graph RPM ceiling");
    if (!Number.isInteger(maxRpm)) throw new RangeError("Graph RPM ceiling must be a whole number.");
    const context = speedContext(specs);
    const samples = 21;
    const points = Array.from({ length: samples }, (_, index) => {
      const rpm = maxRpm * index / (samples - 1);
      const currentSpeed = speedAtRpm(Math.max(rpm, 1e-9), current.front, current.rear, specs).value;
      const proposedSpeed = speedAtRpm(Math.max(rpm, 1e-9), proposed.front, proposed.rear, specs).value;
      return { rpm, currentSpeed, proposedSpeed };
    });
    points[0].currentSpeed = 0;
    points[0].proposedSpeed = 0;
    return { points, maxRpm, unit: context.speedUnit, comparison };
  }

  return { MPH_PER_KMH, KMH_PER_MPH, finalDriveRatio, compareGearing, missingSpecifications, speedAtRpm, rpmAtRoadSpeed, graphData };
});
