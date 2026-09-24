import {
  calculateBearing,
  circularMean,
  findLookaheadPoint,
  findNearestOnPolyline,
  predictDeadReckonTarget,
  SNAP_MAX_OFFSET_M,
} from "../navigationUtils";
import type { Coordinate } from "../polylineUtils";

// ─── calculateBearing ──────────────────────────────────────────────────────

describe("calculateBearing", () => {
  it("retourne ~0° vers le nord", () => {
    expect(calculateBearing(0, 0, 0.001, 0)).toBeCloseTo(0, 0);
  });

  it("retourne ~90° vers l'est", () => {
    expect(calculateBearing(0, 0, 0, 0.001)).toBeCloseTo(90, 0);
  });

  it("retourne ~180° vers le sud", () => {
    expect(calculateBearing(0.001, 0, 0, 0)).toBeCloseTo(180, 0);
  });

  it("retourne ~270° vers l'ouest", () => {
    expect(calculateBearing(0, 0.001, 0, 0)).toBeCloseTo(270, 0);
  });

  it("retourne un angle dans [0, 360[", () => {
    const b = calculateBearing(48.8566, 2.3522, 51.5074, -0.1278);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

// ─── circularMean ───────────────────────────────────────────────────────────

describe("circularMean", () => {
  it("un seul cap → retourne ce cap", () => {
    expect(circularMean([90])).toBeCloseTo(90, 1);
  });

  it("[0, 90] → moyenne à 45°", () => {
    expect(circularMean([0, 90])).toBeCloseTo(45, 1);
  });

  it("[350, 10] → 0° — évite le bug de la moyenne arithmétique (180°)", () => {
    expect(circularMean([350, 10])).toBeCloseTo(0, 0);
  });

  it("[180] → 180°", () => {
    expect(circularMean([180])).toBeCloseTo(180, 1);
  });

  it("[0, 0, 0] → 0°", () => {
    expect(circularMean([0, 0, 0])).toBeCloseTo(0, 1);
  });

  it("résultat toujours dans [0, 360[", () => {
    const result = circularMean([170, 190]);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });
});

// ─── findLookaheadPoint ─────────────────────────────────────────────────────

describe("findLookaheadPoint", () => {
  // Polyline : Douala → 111m nord → 222m nord
  const points: Coordinate[] = [
    { latitude: 0, longitude: 0 },
    { latitude: 0.001, longitude: 0 }, // ~111m
    { latitude: 0.002, longitude: 0 }, // ~222m
  ];

  it("retourne null avec moins de 2 points", () => {
    expect(findLookaheadPoint(0, 0, [], 50)).toBeNull();
    expect(findLookaheadPoint(0, 0, [{ latitude: 0, longitude: 0 }], 50)).toBeNull();
  });

  it("retourne le premier point à ≥ lookaheadM (100m)", () => {
    const result = findLookaheadPoint(0, 0, points, 100);
    // points[1] est à ~111m > 100m
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(0.001, 4);
  });

  it("retourne le dernier point si tous sont en-deçà du lookahead", () => {
    const result = findLookaheadPoint(0, 0, points, 300);
    // Aucun point n'est à 300m → retourne le dernier
    expect(result!.latitude).toBeCloseTo(0.002, 4);
  });

  it("lookahead très court → retourne le premier point de la liste qui est ≥ 1m", () => {
    const result = findLookaheadPoint(0, 0, points, 1);
    expect(result).not.toBeNull();
    // points[1] est le premier point à ≥ 1m (en i=1 on commence l'itération)
    expect(result!.latitude).toBeCloseTo(0.001, 4);
  });
});

// ─── findNearestOnPolyline ──────────────────────────────────────────────────

describe("findNearestOnPolyline", () => {
  // Polyline verticale nord : (0,0) → (0.001, 0) — environ 111m de long
  const verticalLine: Coordinate[] = [
    { latitude: 0, longitude: 0 },
    { latitude: 0.001, longitude: 0 },
  ];

  it("retourne null avec moins de 2 points", () => {
    expect(findNearestOnPolyline(0, 0, [])).toBeNull();
    expect(findNearestOnPolyline(0, 0, [{ latitude: 0, longitude: 0 }])).toBeNull();
  });

  it("driver à ~11m de la route → retourne la position snappée", () => {
    // Driver légèrement à l'est du milieu de la polyline (0.0001° lon ≈ 11m)
    const result = findNearestOnPolyline(0.0005, 0.0001, verticalLine);
    expect(result).not.toBeNull();
    // Le snap doit ramener sur lon=0 (sur la route)
    expect(result!.longitude).toBeCloseTo(0, 4);
    expect(result!.latitude).toBeCloseTo(0.0005, 3);
    expect(result!.distM).toBeCloseTo(11.1, 0);
  });

  it("driver à ~55m de la route → retourne null (> SNAP_MAX_OFFSET_M=40m)", () => {
    // 0.0005° lon ≈ 55m — dépasse le seuil
    const result = findNearestOnPolyline(0.0005, 0.0005, verticalLine);
    expect(result).toBeNull();
  });

  it("retourne segIdx et t cohérents (t ∈ [0,1])", () => {
    const result = findNearestOnPolyline(0.0005, 0.00003, verticalLine);
    expect(result).not.toBeNull();
    expect(result!.t).toBeGreaterThanOrEqual(0);
    expect(result!.t).toBeLessThanOrEqual(1);
    expect(result!.segIdx).toBe(0);
  });

  it("SNAP_MAX_OFFSET_M exporté vaut 40", () => {
    expect(SNAP_MAX_OFFSET_M).toBe(40);
  });
});

// ─── predictDeadReckonTarget ────────────────────────────────────────────────

describe("predictDeadReckonTarget", () => {
  it("speedMs null → retourne la position inchangée", () => {
    const result = predictDeadReckonTarget(48.0, 2.0, null, 0);
    expect(result.latitude).toBe(48.0);
    expect(result.longitude).toBe(2.0);
  });

  it("vitesse en-dessous du seuil (0.5 m/s) → retourne la position inchangée", () => {
    const result = predictDeadReckonTarget(48.0, 2.0, 0.5, 0);
    expect(result.latitude).toBe(48.0);
    expect(result.longitude).toBe(2.0);
  });

  it("10 m/s plein nord → latitude augmente, longitude inchangée", () => {
    const result = predictDeadReckonTarget(48.0, 2.0, 10, 0);
    // distM = 10 * 0.9 = 9m → lat += 9/111000 ≈ 0.0000811°
    expect(result.latitude).toBeGreaterThan(48.0);
    expect(result.longitude).toBeCloseTo(2.0, 5);
  });

  it("10 m/s plein est → longitude augmente, latitude inchangée", () => {
    const result = predictDeadReckonTarget(0.0, 0.0, 10, 90);
    expect(result.longitude).toBeGreaterThan(0.0);
    expect(result.latitude).toBeCloseTo(0.0, 5);
  });

  it("10 m/s plein sud → latitude diminue", () => {
    const result = predictDeadReckonTarget(48.0, 2.0, 10, 180);
    expect(result.latitude).toBeLessThan(48.0);
  });

  it("vitesse au-dessus du max (50 m/s) → bridée à 40 m/s", () => {
    const at40 = predictDeadReckonTarget(0.0, 0.0, 40, 0);
    const at50 = predictDeadReckonTarget(0.0, 0.0, 50, 0);
    // 50 m/s est bridée à 40 → même résultat
    expect(at50.latitude).toBeCloseTo(at40.latitude, 8);
  });

  it("la distance projetée correspond à vitesse × 0.9s", () => {
    // 20 m/s nord → distM = 20 * 0.9 = 18m → lat += 18/111000
    const result = predictDeadReckonTarget(0.0, 0.0, 20, 0);
    const expectedDeltaLat = 18 / 111000;
    expect(result.latitude).toBeCloseTo(expectedDeltaLat, 7);
  });
});
