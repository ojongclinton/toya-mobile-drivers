// Google Roads API — snapToRoads : aligne une suite de points GPS sur le réseau routier.
// Tarification : gratuit jusqu'à 500 req/jour, ensuite ~10$ / 1000 req. À n'activer
// que pendant la navigation active (throttling côté appelant).

const GOOGLE_ROADS_API_KEY = "AIzaSyDk23cRpIB-7kdqSuaucS3p-_syAgKNgEM";

export type SnapPoint = {
  lat: number;
  lng: number;
};

export type SnappedPoint = {
  latitude: number;
  longitude: number;
  placeId: string;
  originalIndex?: number;
};

export const snapToRoads = async (points: SnapPoint[]): Promise<SnappedPoint[]> => {
  if (points.length === 0) return [];
  const path = points.map((p) => `${p.lat},${p.lng}`).join("|");
  const url =
    `https://roads.googleapis.com/v1/snapToRoads` +
    `?path=${encodeURIComponent(path)}` +
    `&interpolate=false` +
    `&key=${GOOGLE_ROADS_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  if (!Array.isArray(data.snappedPoints)) return [];
  return data.snappedPoints.map((p: any) => ({
    latitude: p.location.latitude,
    longitude: p.location.longitude,
    placeId: p.placeId,
    originalIndex: p.originalIndex,
  }));
};
