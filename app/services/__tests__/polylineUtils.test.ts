import polyline from "@mapbox/polyline";
import {
  decodePolylinesToCoordinates,
  decodeStepsToCoordinates,
} from "../polylineUtils";

// Coordonnées de référence [lat, lng] pour les fixtures
const PARIS: [number, number] = [48.8566, 2.3522];
const LONDON: [number, number] = [51.5074, -0.1278];
const MADRID: [number, number] = [40.4168, -3.7038];

// Polylines encodées à partir des coordonnées de référence
const ENC_PARIS_LONDON = polyline.encode([PARIS, LONDON]);
const ENC_MADRID = polyline.encode([MADRID]);

describe("decodePolylinesToCoordinates", () => {
  it("retourne [] pour un tableau vide", () => {
    expect(decodePolylinesToCoordinates([])).toEqual([]);
  });

  it("décode une polyline en objets { latitude, longitude }", () => {
    const result = decodePolylinesToCoordinates([ENC_PARIS_LONDON]);

    expect(result).toHaveLength(2);
    expect(result[0].latitude).toBeCloseTo(PARIS[0], 3);
    expect(result[0].longitude).toBeCloseTo(PARIS[1], 3);
    expect(result[1].latitude).toBeCloseTo(LONDON[0], 3);
    expect(result[1].longitude).toBeCloseTo(LONDON[1], 3);
  });

  it("les objets ont 'latitude' et 'longitude' — pas de 'lat' ou 'lng'", () => {
    const result = decodePolylinesToCoordinates([ENC_PARIS_LONDON]);

    expect(result[0]).toHaveProperty("latitude");
    expect(result[0]).toHaveProperty("longitude");
    expect(result[0]).not.toHaveProperty("lat");
    expect(result[0]).not.toHaveProperty("lng");
  });

  it("concatène plusieurs polylines dans l'ordre", () => {
    const result = decodePolylinesToCoordinates([ENC_PARIS_LONDON, ENC_MADRID]);

    expect(result).toHaveLength(3);
    expect(result[0].latitude).toBeCloseTo(PARIS[0], 3);
    expect(result[1].latitude).toBeCloseTo(LONDON[0], 3);
    expect(result[2].latitude).toBeCloseTo(MADRID[0], 3);
  });

  it("polyline à un seul point → tableau d'un seul élément", () => {
    const result = decodePolylinesToCoordinates([ENC_MADRID]);

    expect(result).toHaveLength(1);
    expect(result[0].latitude).toBeCloseTo(MADRID[0], 3);
    expect(result[0].longitude).toBeCloseTo(MADRID[1], 3);
  });
});

describe("decodeStepsToCoordinates", () => {
  it("retourne [] pour un tableau de steps vide", () => {
    expect(decodeStepsToCoordinates([])).toEqual([]);
  });

  it("extrait step.polyline.points de chaque step et décode", () => {
    const steps = [
      { polyline: { points: ENC_PARIS_LONDON } },
    ];

    const result = decodeStepsToCoordinates(steps);

    expect(result).toHaveLength(2);
    expect(result[0].latitude).toBeCloseTo(PARIS[0], 3);
    expect(result[1].latitude).toBeCloseTo(LONDON[0], 3);
  });

  it("plusieurs steps → toutes les coordonnées concaténées dans l'ordre", () => {
    const steps = [
      { polyline: { points: polyline.encode([PARIS]) } },
      { polyline: { points: polyline.encode([LONDON]) } },
      { polyline: { points: polyline.encode([MADRID]) } },
    ];

    const result = decodeStepsToCoordinates(steps);

    expect(result).toHaveLength(3);
    expect(result[0].latitude).toBeCloseTo(PARIS[0], 3);
    expect(result[1].latitude).toBeCloseTo(LONDON[0], 3);
    expect(result[2].latitude).toBeCloseTo(MADRID[0], 3);
  });
});
