import { GeoKalman } from "../kalmanFilter";

const BASE = {
  lat: 48.8566,
  lon: 2.3522,
  speedMs: 0 as number | null,
  headingDeg: 0 as number | null,
  accuracyM: 10 as number | null,
  dtSec: 1,
};

describe("GeoKalman — initialisation", () => {
  it("retourne exactement la mesure au premier appel", () => {
    const kalman = new GeoKalman();
    const result = kalman.filter(BASE);
    expect(result.lat).toBe(BASE.lat);
    expect(result.lon).toBe(BASE.lon);
  });

  it("retourne un objet avec les propriétés lat et lon", () => {
    const kalman = new GeoKalman();
    const result = kalman.filter(BASE);
    expect(result).toHaveProperty("lat");
    expect(result).toHaveProperty("lon");
  });

  it("s'instancie sans argument (bruit process par défaut = 2 m/s)", () => {
    expect(() => new GeoKalman()).not.toThrow();
  });

  it("s'instancie avec un bruit process personnalisé", () => {
    expect(() => new GeoKalman(5)).not.toThrow();
  });
});

describe("GeoKalman — valeurs nulles", () => {
  it("accepte speedMs null sans erreur", () => {
    const kalman = new GeoKalman();
    expect(() => kalman.filter({ ...BASE, speedMs: null })).not.toThrow();
  });

  it("accepte headingDeg null sans erreur", () => {
    const kalman = new GeoKalman();
    expect(() => kalman.filter({ ...BASE, headingDeg: null })).not.toThrow();
  });

  it("accepte accuracyM null sans erreur (fallback 20 m)", () => {
    const kalman = new GeoKalman();
    expect(() => kalman.filter({ ...BASE, accuracyM: null })).not.toThrow();
  });

  it("toutes les entrées optionnelles à null simultanément — pas d'erreur", () => {
    const kalman = new GeoKalman();
    expect(() =>
      kalman.filter({ ...BASE, speedMs: null, headingDeg: null, accuracyM: null })
    ).not.toThrow();
  });
});

describe("GeoKalman — plancher de précision (minAccuracyM = 3 m)", () => {
  it("accuracy=0 et accuracy=3 produisent les mêmes résultats (plancher appliqué)", () => {
    const kalman0 = new GeoKalman();
    const kalman3 = new GeoKalman();
    const pos = { lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, dtSec: 1 };

    kalman0.filter({ ...pos, accuracyM: 0 });
    kalman3.filter({ ...pos, accuracyM: 3 });

    const r0 = kalman0.filter({ ...pos, accuracyM: 0 });
    const r3 = kalman3.filter({ ...pos, accuracyM: 3 });

    expect(r0.lat).toBeCloseTo(r3.lat, 10);
    expect(r0.lon).toBeCloseTo(r3.lon, 10);
  });
});

describe("GeoKalman — lissage et bruit de mesure", () => {
  it("bruit élevé (accuracyM=1000 m) → l'estimé reste proche de la position précédente", () => {
    const kalman = new GeoKalman();
    kalman.filter({ lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, accuracyM: 5, dtSec: 1 });

    const result = kalman.filter({
      lat: 48.5,
      lon: 2.0,
      speedMs: 0,
      headingDeg: 0,
      accuracyM: 1000,
      dtSec: 1,
    });

    // Gain de Kalman K ≈ 0 avec R très élevé → l'estimé ne bouge presque pas
    const distToInit = Math.abs(result.lat - 48.0);
    const distToMeas = Math.abs(result.lat - 48.5);
    expect(distToInit).toBeLessThan(distToMeas);
  });

  it("mesure précise (accuracyM=3 m) → l'estimé se rapproche fortement de la mesure", () => {
    const kalman = new GeoKalman();
    kalman.filter({ lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, accuracyM: 50, dtSec: 1 });

    const result = kalman.filter({
      lat: 48.5,
      lon: 2.0,
      speedMs: 0,
      headingDeg: 0,
      accuracyM: 3,
      dtSec: 1,
    });

    // Gain de Kalman K ≈ 1 avec R très faible → l'estimé suit la mesure
    const distToMeas = Math.abs(result.lat - 48.5);
    const distToInit = Math.abs(result.lat - 48.0);
    expect(distToMeas).toBeLessThan(distToInit);
  });

  it("convergence — 30 fixes identiques → sortie converge vers la vraie position", () => {
    const kalman = new GeoKalman();
    const input = { lat: 48.8566, lon: 2.3522, speedMs: 0, headingDeg: 0, accuracyM: 5, dtSec: 1 };

    let result = kalman.filter(input);
    for (let i = 0; i < 30; i++) {
      result = kalman.filter(input);
    }

    expect(result.lat).toBeCloseTo(48.8566, 3);
    expect(result.lon).toBeCloseTo(2.3522, 3);
  });
});

describe("GeoKalman — prédiction directionnelle", () => {
  it("vitesse plein nord (heading=0) → la latitude augmente", () => {
    const kalman = new GeoKalman();
    kalman.filter({ lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, accuracyM: 5, dtSec: 1 });

    // 10 m/s vers le nord pendant 1s ≈ +0.00009° de latitude
    const result = kalman.filter({
      lat: 48.00009,
      lon: 2.0,
      speedMs: 10,
      headingDeg: 0,
      accuracyM: 5,
      dtSec: 1,
    });

    expect(result.lat).toBeGreaterThan(48.0);
  });

  it("vitesse plein est (heading=90) → la longitude augmente", () => {
    const kalman = new GeoKalman();
    kalman.filter({ lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, accuracyM: 5, dtSec: 1 });

    // 10 m/s vers l'est pendant 1s ≈ +0.00013° de longitude (à lat=48°)
    const result = kalman.filter({
      lat: 48.0,
      lon: 2.00013,
      speedMs: 10,
      headingDeg: 90,
      accuracyM: 5,
      dtSec: 1,
    });

    expect(result.lon).toBeGreaterThan(2.0);
  });
});

describe("GeoKalman — reset()", () => {
  it("après reset(), le prochain fix est traité comme une initialisation exacte", () => {
    const kalman = new GeoKalman();

    for (let i = 0; i < 5; i++) {
      kalman.filter({ lat: 48.0, lon: 2.0, speedMs: 0, headingDeg: 0, accuracyM: 10, dtSec: 1 });
    }

    kalman.reset();

    const result = kalman.filter({
      lat: 10.0,
      lon: 20.0,
      speedMs: 0,
      headingDeg: 0,
      accuracyM: 10,
      dtSec: 1,
    });

    expect(result.lat).toBe(10.0);
    expect(result.lon).toBe(20.0);
  });

  it("reset() appelé deux fois consécutives — pas d'erreur", () => {
    const kalman = new GeoKalman();
    expect(() => {
      kalman.reset();
      kalman.reset();
    }).not.toThrow();
  });
});
