// Filtre de Kalman 2D pour le suivi d'une position GPS (lat/lon) à vitesse connue.
// Deux filtres scalaires indépendants (un par dimension) ; la vitesse est fournie
// à partir du cap + speed renvoyés par le GPS.
//
// Unités internes : degrés (lat/lon). La vitesse en m/s est convertie via
// 1° lat ≈ 111 000 m et 1° lon ≈ 111 000 × cos(lat) m.

const METERS_PER_DEG_LAT = 111000;

type FilterInput = {
  lat: number;
  lon: number;
  speedMs: number | null;     // m/s
  headingDeg: number | null;  // 0 = nord, 90 = est
  accuracyM: number | null;   // σ de la mesure en mètres
  dtSec: number;              // temps depuis le fix précédent
};

type FilterOutput = {
  lat: number;
  lon: number;
};

class Kalman1D {
  private x = 0;
  private P = 1e9;
  private initialized = false;
  private readonly Q: number;

  constructor(processNoiseVariance: number) {
    this.Q = processNoiseVariance;
  }

  step(z: number, v: number, dt: number, R: number): number {
    if (!this.initialized) {
      this.x = z;
      this.P = R;
      this.initialized = true;
      return z;
    }
    const xPred = this.x + v * dt;
    const PPred = this.P + this.Q * dt * dt;
    const K = PPred / (PPred + R);
    this.x = xPred + K * (z - xPred);
    this.P = (1 - K) * PPred;
    return this.x;
  }

  reset() {
    this.initialized = false;
    this.P = 1e9;
  }
}

export class GeoKalman {
  private latFilter: Kalman1D;
  private lonFilter: Kalman1D;
  // Bruit process : ~2 m/s² d'incertitude sur la prédiction (accélérations, virages).
  // Variance : (2 m/s)² = 4 m²/s² → converti en deg²/s² au moment de l'appel.
  private readonly processNoiseMSq: number;
  // Plancher sur la variance de mesure : même un GPS qui annonce accuracy=0
  // ne doit pas être cru à 100 % (σ minimum 3 m).
  private readonly minAccuracyM = 3;

  constructor(processNoiseMetersPerSec = 2) {
    this.processNoiseMSq = processNoiseMetersPerSec * processNoiseMetersPerSec;
    // On initialise les filtres avec Q=0 ; on recalcule Q à chaque étape car il
    // dépend de la latitude (pour la dimension lon).
    this.latFilter = new Kalman1D(0);
    this.lonFilter = new Kalman1D(0);
  }

  filter(input: FilterInput): FilterOutput {
    const { lat, lon, speedMs, headingDeg, accuracyM, dtSec } = input;

    const metersPerDegLon = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
    const safeMetersPerDegLon = Math.max(metersPerDegLon, 1); // évite div/0 aux pôles

    const v = speedMs ?? 0;
    const hRad = ((headingDeg ?? 0) * Math.PI) / 180;
    const vLatDeg = (v * Math.cos(hRad)) / METERS_PER_DEG_LAT;
    const vLonDeg = (v * Math.sin(hRad)) / safeMetersPerDegLon;

    const accM = Math.max(accuracyM ?? 20, this.minAccuracyM);
    const RLat = (accM / METERS_PER_DEG_LAT) ** 2;
    const RLon = (accM / safeMetersPerDegLon) ** 2;

    const QLat = this.processNoiseMSq / (METERS_PER_DEG_LAT * METERS_PER_DEG_LAT);
    const QLon = this.processNoiseMSq / (safeMetersPerDegLon * safeMetersPerDegLon);

    // Q dépend de la lat → on met à jour à chaque étape en re-instanciant si besoin.
    // En pratique, le filtre Kalman1D lit Q une fois ; on expose donc une petite
    // variante qui prend Q en argument.
    const fLat = this.stepWithQ(this.latFilter, lat, vLatDeg, dtSec, RLat, QLat);
    const fLon = this.stepWithQ(this.lonFilter, lon, vLonDeg, dtSec, RLon, QLon);

    return { lat: fLat, lon: fLon };
  }

  reset() {
    this.latFilter.reset();
    this.lonFilter.reset();
  }

  private stepWithQ(
    filter: Kalman1D,
    z: number,
    v: number,
    dt: number,
    R: number,
    Q: number
  ): number {
    // Accès via any : on pilote les champs privés pour adapter Q par étape.
    // Acceptable ici car les deux classes sont dans le même module.
    const f = filter as any;
    if (!f.initialized) {
      f.x = z;
      f.P = R;
      f.initialized = true;
      return z;
    }
    const xPred = f.x + v * dt;
    const PPred = f.P + Q * dt * dt;
    const K = PPred / (PPred + R);
    f.x = xPred + K * (z - xPred);
    f.P = (1 - K) * PPred;
    return f.x;
  }
}
