import { useState, useRef, useEffect } from "react";
import { Alert } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GeoKalman } from "../services/kalmanFilter";

export type LocationUpdate = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  isFirst: boolean;
};

type UseDriverLocationParams = {
  onUpdate?: (update: LocationUpdate) => void;
  accuracyThreshold?: number;
  waitTimeoutMs?: number;
  readyTimeoutMs?: number;
  enableKalman?: boolean;
};

export const useDriverLocation = ({
  onUpdate,
  accuracyThreshold = 20,
  waitTimeoutMs = 60000,
  readyTimeoutMs = 10000,
  enableKalman = true,
}: UseDriverLocationParams = {}) => {
  const [latchauffeur, setlatchauffeur] = useState(0);
  const [lonchauffeur, setlonchauffeur] = useState(0);
  const [isLocationReady, setIsLocationReady] = useState(false);
  const [isWaitingForGPS, setIsWaitingForGPS] = useState(false);
  // P3 : services de localisation système actifs (faux = GPS coupé au niveau OS)
  const [servicesEnabled, setServicesEnabled] = useState(true);
  // P3/P4 : précision GPS durablement mauvaise (> seuil) → mode dégradé / message
  const [lowAccuracy, setLowAccuracy] = useState(false);

  const latchauffeurRef = useRef(0);
  const lonchauffeurRef = useRef(0);
  const currentAccuracyRef = useRef<number>(Infinity);
  const lowAccuracyRef = useRef(false);
  const locationWatchRef = useRef<Location.LocationSubscription | null>(null);

  const kalmanRef = useRef<GeoKalman | null>(enableKalman ? new GeoKalman(2) : null);
  const lastFixTsRef = useRef<number>(0);

  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const setDriverLocation = (lat: number, lon: number) => {
    latchauffeurRef.current = lat;
    lonchauffeurRef.current = lon;
    setlatchauffeur(lat);
    setlonchauffeur(lon);
  };

  const waitForAccuracy = async (): Promise<boolean> => {
    if (currentAccuracyRef.current <= accuracyThreshold) return true;
    setIsWaitingForGPS(true);
    const start = Date.now();
    while (Date.now() - start < waitTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      if (currentAccuracyRef.current <= accuracyThreshold) {
        setIsWaitingForGPS(false);
        return true;
      }
    }
    setIsWaitingForGPS(false);
    return false;
  };

  useEffect(() => {
    let isFirstPosition = true;
    let cancelled = false;

    // P4 : filet anti-blocage — si aucun fix n'arrive (GPS lent sur appareil bas
    // de gamme), on débloque l'UI après readyTimeoutMs. La carte s'affiche avec
    // la position par défaut + bandeau « GPS faible » plutôt qu'un loader infini.
    const readyTimer = setTimeout(() => {
      if (!cancelled) setIsLocationReady(true);
    }, readyTimeoutMs);

    (async () => {
      // Pré-charger la dernière position connue pour éviter que le loader
      // reste bloqué en attendant le premier fix GPS
      try {
        const cached = await AsyncStorage.getItem("lastKnownPosition");
        if (cached) {
          const parsed = JSON.parse(cached);
          const cachedLat = parsed.lat ?? parsed.latitude;
          const cachedLon = parsed.lon ?? parsed.longitude;
          if (cachedLat && cachedLon && !cancelled) {
            latchauffeurRef.current = cachedLat;
            lonchauffeurRef.current = cachedLon;
            setlatchauffeur(cachedLat);
            setlonchauffeur(cachedLon);
            setIsLocationReady(true);
            isFirstPosition = false;
          }
        }
      } catch {
        // silently ignore
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "Veuillez autoriser l'accès à votre localisation dans les paramètres de votre téléphone.",
            [{ text: "OK" }]
          );
          return;
        }
        if (cancelled) return;

        // P3 : services de localisation OS activés ? (mode « Économie d'énergie »
        // ou GPS coupé → précision catastrophique qu'aucun réglage app ne compense)
        try {
          const enabled = await Location.hasServicesEnabledAsync();
          if (!cancelled) setServicesEnabled(enabled);
        } catch {}

        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 2,
          },
          (location) => {
            const { latitude, longitude, accuracy, heading, speed } = location.coords;

            // Garde anti-crash (bas de gamme, surtout Android) : un GPS défaillant peut
            // renvoyer une position NaN. Injectée dans AnimatedRegion/animateCamera, elle
            // fait planter le module natif react-native-maps (non rattrapable en JS).
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

            // speed/heading/accuracy peuvent être NaN (pas seulement null) sur certains
            // capteurs Android. `??` ne capture pas NaN → on assainit, sinon un NaN
            // empoisonnerait DURABLEMENT le filtre de Kalman (état interne contaminé).
            const safeSpeed = Number.isFinite(speed as number) ? (speed as number) : null;
            const safeHeading = Number.isFinite(heading as number) ? (heading as number) : null;
            const safeAccuracy = Number.isFinite(accuracy as number) ? (accuracy as number) : null;

            currentAccuracyRef.current = safeAccuracy ?? Infinity;

            // P3/P4 : suivi de la qualité GPS — setState uniquement sur changement
            // d'état (évite un re-render inutile à chaque fix).
            const low = (safeAccuracy ?? Infinity) > accuracyThreshold;
            if (low !== lowAccuracyRef.current) {
              lowAccuracyRef.current = low;
              setLowAccuracy(low);
            }

            // Filtre de Kalman : lisse les fixes bruités en les pondérant par
            // leur précision et en prédisant via vitesse × cap.
            let filteredLat = latitude;
            let filteredLon = longitude;
            const nowTs = Date.now();
            const dtSec =
              lastFixTsRef.current > 0
                ? Math.min((nowTs - lastFixTsRef.current) / 1000, 5)
                : 0;
            lastFixTsRef.current = nowTs;
            if (kalmanRef.current) {
              const out = kalmanRef.current.filter({
                lat: latitude,
                lon: longitude,
                speedMs: safeSpeed,
                headingDeg: safeHeading,
                accuracyM: safeAccuracy,
                dtSec,
              });
              // Défense finale : si le filtre produit un NaN malgré tout, on garde la
              // position GPS brute (finie) au lieu de propager le NaN vers la carte.
              if (Number.isFinite(out.lat) && Number.isFinite(out.lon)) {
                filteredLat = out.lat;
                filteredLon = out.lon;
              }
            }

            latchauffeurRef.current = filteredLat;
            lonchauffeurRef.current = filteredLon;
            setlatchauffeur(filteredLat);
            setlonchauffeur(filteredLon);

            const wasFirst = isFirstPosition;
            if (isFirstPosition) {
              isFirstPosition = false;
              setIsLocationReady(true);
              // Sauvegarder pour le prochain lancement (premier fix réel)
              AsyncStorage.setItem("lastKnownPosition", JSON.stringify({
                latitude: filteredLat,
                longitude: filteredLon,
              })).catch(() => {});
            }

            onUpdateRef.current?.({
              latitude: filteredLat,
              longitude: filteredLon,
              accuracy: accuracy ?? null,
              heading: heading ?? null,
              speed: speed ?? null,
              isFirst: wasFirst,
            });
          }
        );
      } catch (error) {
        Alert.alert(
          "Erreur GPS",
          "Impossible d'obtenir votre position. Vérifiez que le GPS est activé."
        );
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(readyTimer);
      if (locationWatchRef.current) {
        locationWatchRef.current.remove();
        locationWatchRef.current = null;
      }
    };
  }, []);

  return {
    latchauffeur,
    lonchauffeur,
    setlatchauffeur,
    setlonchauffeur,
    latchauffeurRef,
    lonchauffeurRef,
    currentAccuracyRef,
    isLocationReady,
    setIsLocationReady,
    isWaitingForGPS,
    setIsWaitingForGPS,
    servicesEnabled,
    lowAccuracy,
    waitForAccuracy,
    setDriverLocation,
  };
};
