import { Coordinate } from "./polylineUtils";

// Constantes de dead-reckoning et snap
const DEAD_RECKON_HORIZON_MS = 900;
const DEAD_RECKON_MIN_SPEED_MS = 1.0;
const DEAD_RECKON_MAX_SPEED_MS = 40;
export const SNAP_MAX_OFFSET_M = 40;

/**
 * Calcule le cap initial (bearing) en degrés [0..360[ entre deux coordonnées GPS.
 * 0° = Nord, 90° = Est, 180° = Sud, 270° = Ouest.
 */
export const calculateBearing = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Moyenne circulaire d'une liste de caps en degrés.
 * Évite le bug des moyennes arithmétiques autour de 0°/360°
 * (ex. : moy([350°, 10°]) = 0°, pas 180°).
 */
export const circularMean = (headings: number[]): number => {
  let sumSin = 0;
  let sumCos = 0;
  headings.forEach((h) => {
    const r = (h * Math.PI) / 180;
    sumSin += Math.sin(r);
    sumCos += Math.cos(r);
  });
  const n = headings.length;
  return ((Math.atan2(sumSin / n, sumCos / n) * 180) / Math.PI + 360) % 360;
};

/**
 * Trouve le premier point de la polyline situé à ≥ lookaheadM mètres du chauffeur.
 * Utilisé pour calculer le cap de visée et éviter les oscillations sur segments courts.
 * Retourne le dernier point si tous sont en-deçà de la distance de visée.
 * Retourne null si la polyline contient moins de 2 points.
 */
export const findLookaheadPoint = (
  driverLat: number,
  driverLon: number,
  points: Coordinate[],
  lookaheadM: number
): Coordinate | null => {
  if (points.length < 2) return null;
  const metersPerDegLat = 111000;
  const metersPerDegLon = 111000 * Math.cos((driverLat * Math.PI) / 180);
  for (let i = 1; i < points.length; i++) {
    const dLat = (points[i].latitude - driverLat) * metersPerDegLat;
    const dLon = (points[i].longitude - driverLon) * metersPerDegLon;
    const distM = Math.sqrt(dLat * dLat + dLon * dLon);
    if (distM >= lookaheadM) return points[i];
  }
  return points[points.length - 1];
};

/**
 * Trouve le point le plus proche sur la polyline (projection orthogonale segment par segment).
 * Retourne la position snappée, l'index du segment, le paramètre t ∈ [0,1] et la distance.
 * Retourne null si la polyline a moins de 2 points ou si le chauffeur est à plus de
 * SNAP_MAX_OFFSET_M (40 m) de la route.
 */
export const findNearestOnPolyline = (
  lat: number,
  lon: number,
  points: Coordinate[],
  maxOffsetM: number = SNAP_MAX_OFFSET_M
): {
  latitude: number;
  longitude: number;
  segIdx: number;
  t: number;
  distM: number;
} | null => {
  if (points.length < 2) return null;
  const R_LAT = 111000;
  const R_LON = 111000 * Math.cos((lat * Math.PI) / 180);
  let bestDist = Infinity;
  let bestLat = lat;
  let bestLon = lon;
  let bestIdx = 0;
  let bestT = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = (points[i].longitude - lon) * R_LON;
    const ay = (points[i].latitude - lat) * R_LAT;
    const dx = (points[i + 1].longitude - points[i].longitude) * R_LON;
    const dy = (points[i + 1].latitude - points[i].latitude) * R_LAT;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const dist = Math.sqrt(px * px + py * py);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
      bestT = t;
      bestLat = points[i].latitude + t * (points[i + 1].latitude - points[i].latitude);
      bestLon = points[i].longitude + t * (points[i + 1].longitude - points[i].longitude);
    }
  }
  if (bestDist > maxOffsetM) return null;
  return { latitude: bestLat, longitude: bestLon, segIdx: bestIdx, t: bestT, distM: bestDist };
};

/**
 * Distance perpendiculaire (en mètres) entre un point et la polyline, SANS plafond
 * (contrairement à findNearestOnPolyline qui retourne null au-delà de SNAP_MAX_OFFSET_M).
 * Sert à détecter avec précision si le chauffeur a quitté l'itinéraire.
 * Retourne Infinity si la polyline a moins de 2 points.
 */
export const distanceToPolylineM = (
  lat: number,
  lon: number,
  points: Coordinate[]
): number => {
  if (points.length < 2) return Infinity;
  const R_LAT = 111000;
  const R_LON = 111000 * Math.cos((lat * Math.PI) / 180);
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const ax = (points[i].longitude - lon) * R_LON;
    const ay = (points[i].latitude - lat) * R_LAT;
    const dx = (points[i + 1].longitude - points[i].longitude) * R_LON;
    const dy = (points[i + 1].latitude - points[i].latitude) * R_LAT;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq)) : 0;
    const px = ax + t * dx;
    const py = ay + t * dy;
    const dist = Math.sqrt(px * px + py * py);
    if (dist < bestDist) bestDist = dist;
  }
  return bestDist;
};

/**
 * Calcule la position cible projetée DEAD_RECKON_HORIZON_MS ms en avant
 * à partir de la vitesse et du cap. Utilisé pour animer le marqueur chauffeur
 * de façon fluide entre deux fixes GPS.
 * En dessous de DEAD_RECKON_MIN_SPEED_MS ou si speedMs est null,
 * retourne la position observée sans projection.
 */
export const predictDeadReckonTarget = (
  lat: number,
  lon: number,
  speedMs: number | null,
  headingDeg: number
): { latitude: number; longitude: number } => {
  if (speedMs === null || speedMs < DEAD_RECKON_MIN_SPEED_MS) {
    return { latitude: lat, longitude: lon };
  }
  const v = Math.min(speedMs, DEAD_RECKON_MAX_SPEED_MS);
  const distM = (v * DEAD_RECKON_HORIZON_MS) / 1000;
  const hRad = (headingDeg * Math.PI) / 180;
  const dNorthM = distM * Math.cos(hRad);
  const dEastM = distM * Math.sin(hRad);
  const metersPerDegLat = 111000;
  const metersPerDegLon = 111000 * Math.cos((lat * Math.PI) / 180);
  return {
    latitude: lat + dNorthM / metersPerDegLat,
    longitude: lon + dEastM / metersPerDegLon,
  };
};
