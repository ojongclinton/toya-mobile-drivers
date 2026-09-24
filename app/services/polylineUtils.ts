import polyline from "@mapbox/polyline";

export type Coordinate = {
  latitude: number;
  longitude: number;
};

export const decodePolylinesToCoordinates = (polylines: string[]): Coordinate[] => {
  let points: Coordinate[] = [];
  polylines.forEach((poly) => {
    if (!poly) return;
    try {
      const decoded = polyline.decode(poly);
      const formatted = decoded.map(([latitude, longitude]: [number, number]) => ({
        latitude,
        longitude,
      }));
      points = points.concat(formatted);
    } catch {
      // Segment de polyline malformé → ignoré (ne doit pas casser tout le tracé).
    }
  });
  return points;
};

export const decodeStepsToCoordinates = (steps: any[]): Coordinate[] => {
  if (!Array.isArray(steps)) return [];
  // Certains steps Google (transit/ferry, réponse partielle) n'ont pas de polyline.
  return decodePolylinesToCoordinates(
    steps.map((step) => step?.polyline?.points).filter((p): p is string => !!p)
  );
};
