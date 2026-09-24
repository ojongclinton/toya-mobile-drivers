import { useRef, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { decode } from "html-entities";
import { getDirections } from "../services/api/directions";
import { speak } from "../services/speech";
import { decodeStepsToCoordinates, type Coordinate } from "../services/polylineUtils";
import { distanceToPolylineM } from "../services/navigationUtils";

type Destination = { lat: number; lon: number };

type Params = {
  latchauffeurRef: React.MutableRefObject<number>;
  lonchauffeurRef: React.MutableRefObject<number>;
  currentAccuracyRef: React.MutableRefObject<number>;
  speedMsRef: React.MutableRefObject<number>;
  navigationActiveRef: React.MutableRefObject<boolean>;
  navigationPhaseRef: React.MutableRefObject<"pickup" | "dropoff">;
  routePointsRef: React.MutableRefObject<Coordinate[]>;
  waitForAccuracy: () => Promise<boolean>;
  accuracyThreshold: number;
  recalcCooldown: number;
  setAllPoints: (points: Coordinate[]) => void;
  getDestinationForPhase: (phase: "pickup" | "dropoff") => Destination;
};

// Détection hors-itinéraire : distance perpendiculaire réelle au tracé (en mètres).
const OFF_ROUTE_DIST_M = 55;
const OFF_ROUTE_CHECKS = 2;
const STEP_REACHED_DIST = 0.0002;

const readInterval = (distValue: number): number => {
  if (distValue > 1000) return 60000;
  if (distValue > 500) return 30000;
  if (distValue > 100) return 15000;
  return 10000;
};

// Calcule le délai avant prochain check selon distance et vitesse.
// Plus vite on roule, plus on check souvent pour ne pas dépasser le waypoint.
const adaptiveDelay = (distDeg: number, speedMs: number): number => {
  const distM = distDeg * 111000;
  if (speedMs < 1) return 5000; // à l'arrêt → 5s
  const timeToReachMs = (distM / speedMs) * 1000;
  // On check à mi-chemin, min 500ms, max 5000ms
  return Math.min(5000, Math.max(500, timeToReachMs * 0.5));
};

// Seuil d'annonce vocale anticipée : à cette distance (secondes de route), on ré-annonce.
const ANNOUNCE_AHEAD_S = 12;

// En dessous de cette vitesse GPS (~5,4 km/h), on ne fait pas confiance à la vitesse
// réelle pour l'ETA (feu rouge, embouteillage…) et on retombe sur l'estimation Google.
const MIN_SPEED_FOR_ETA_MS = 1.5;

export const useTurnByTurnNavigation = ({
  latchauffeurRef,
  lonchauffeurRef,
  currentAccuracyRef,
  speedMsRef,
  navigationActiveRef,
  navigationPhaseRef,
  routePointsRef,
  waitForAccuracy,
  accuracyThreshold,
  recalcCooldown,
  setAllPoints,
  getDestinationForPhase,
}: Params) => {
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [value, setValue] = useState(0);
  const [html, sethtml] = useState("");
  const [currentManeuver, setCurrentManeuver] = useState("straight");
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const lastRecalcTimeRef = useRef<number>(0);
  const navSessionRef = useRef(0);

  // Tick temps réel : décrémente d'1s par seconde pendant la navigation active
  useEffect(() => {
    const interval = setInterval(() => {
      if (!navigationActiveRef.current) return;
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getDestinationRef = useRef(getDestinationForPhase);
  getDestinationRef.current = getDestinationForPhase;

  // Défense en profondeur : une erreur TTS ne doit jamais casser la boucle de navigation.
  const safeSpeak = async (...a: Parameters<typeof speak>) => {
    try {
      await speak(...a);
    } catch {}
  };

  const runNavigationLoop = async (steps: any[]) => {
    const mySession = navSessionRef.current;
    let i = 0;
    let lastReadTime = 0;
    let offRouteCount = 0;

    let remaining = steps.reduce(
      (sum: number, s: any) => sum + (s.duration?.value || 0),
      0
    );
    setRemainingSeconds(remaining);

    while (i < steps.length && navigationActiveRef.current && navSessionRef.current === mySession) {
      const step = steps[i];
      // Garde : un step Google peut être partiel (transit/ferry, réponse incomplète).
      // Sans end_location/distance on ne peut pas le traiter → on l'ignore proprement
      // au lieu de crasher la boucle de navigation (uncaught in promise).
      if (!step?.end_location || !step?.distance) {
        i++;
        continue;
      }
      const latend = step.end_location.lat;
      const lonend = step.end_location.lng;
      const distValue = step.distance.value;
      const instruction = decode(String(step.html_instructions ?? "").replace(/<[^>]*>/g, ""));
      const maneuver = step.maneuver || "straight";

      setValue(distValue);
      sethtml(instruction);
      setCurrentManeuver(maneuver);

      const distanceToPoint = Math.sqrt(
        Math.pow(latend - latchauffeurRef.current, 2) +
          Math.pow(lonend - lonchauffeurRef.current, 2)
      );
      const speedMs = speedMsRef.current;
      const distM = distanceToPoint * 111000;
      const timeToReachS = speedMs > 1 ? distM / speedMs : Infinity;

      // ETA réactif : on réestime le temps du step en cours à partir de la distance
      // restante ÷ vitesse GPS réelle. En dessous du seuil (arrêt/feu), on retombe
      // sur la vitesse moyenne supposée par Google pour ce step.
      if (currentAccuracyRef.current <= accuracyThreshold) {
        const stepGoogleDur = step.duration?.value || 0;
        const tailSeconds = Math.max(0, remaining - stepGoogleDur);
        const stepDistM = distValue;
        const stepAssumedSpeed = stepGoogleDur > 0 ? stepDistM / stepGoogleDur : 0;
        const effSpeed = speedMs >= MIN_SPEED_FOR_ETA_MS ? speedMs : stepAssumedSpeed;
        const curStepRemainDist = Math.min(distM, stepDistM);
        const curStepTime =
          effSpeed > 0 ? curStepRemainDist / effSpeed : stepGoogleDur;
        setRemainingSeconds(Math.round(tailSeconds + curStepTime));
      }

      const now = Date.now();
      const timeSinceLastRead = now - lastReadTime;
      // Annonce : première fois OU intervalle standard OU proche (<12s de route)
      const shouldAnnounce =
        lastReadTime === 0 ||
        timeSinceLastRead >= readInterval(distValue) ||
        (timeToReachS < ANNOUNCE_AHEAD_S && timeSinceLastRead > 8000);
      if (shouldAnnounce) {
        await safeSpeak(instruction, { repeatCount: 1 });
        if (navSessionRef.current !== mySession || !navigationActiveRef.current) return;
        lastReadTime = now;
      }

      // Mode dégradé : sur GPS imprécis (appareils bas de gamme), on NE bloque plus
      // la progression en attendant une précision ≤ seuil — sinon les étapes
      // n'avançaient jamais et la navigation se figeait. On continue d'avancer en
      // élargissant la tolérance de validation d'étape, et on suspend la détection
      // hors-itinéraire (non fiable à basse précision → recalculs intempestifs).
      const accuracyOk = currentAccuracyRef.current <= accuracyThreshold;
      // Distance de validation d'étape : tolérante quand le GPS est mauvais,
      // plafonnée (~55 m) pour ne PAS enchaîner/sauter plusieurs étapes courtes
      // d'un coup (le i++ reboucle sur la même position sans sleep).
      const reachDist = accuracyOk
        ? STEP_REACHED_DIST
        : Math.min(0.0005, Math.max(STEP_REACHED_DIST, (currentAccuracyRef.current / 111000) * 1.2));

      if (distanceToPoint < reachDist) {
        remaining -= step.duration?.value || 0;
        if (remaining < 0) remaining = 0;
        setRemainingSeconds(remaining);
        i++;
        lastReadTime = 0;
        offRouteCount = 0;
      } else if (
        accuracyOk &&
        routePointsRef.current.length >= 2 &&
        distanceToPolylineM(
          latchauffeurRef.current,
          lonchauffeurRef.current,
          routePointsRef.current
        ) > OFF_ROUTE_DIST_M
      ) {
        // Hors-itinéraire : distance perpendiculaire réelle au tracé > 55 m
        offRouteCount++;
        if (offRouteCount >= OFF_ROUTE_CHECKS) {
          navigationActiveRef.current = false;
          await recalculateRoute();
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, adaptiveDelay(distanceToPoint, speedMs)));
        if (navSessionRef.current !== mySession || !navigationActiveRef.current) return;
      } else {
        offRouteCount = 0;
        await new Promise((resolve) => setTimeout(resolve, adaptiveDelay(distanceToPoint, speedMs)));
        if (navSessionRef.current !== mySession || !navigationActiveRef.current) return;
      }
    }

    if (navigationActiveRef.current && navSessionRef.current === mySession) {
      setRemainingSeconds(0);
      const lang = (await AsyncStorage.getItem("language")) || "fr";
      await safeSpeak(
        lang === "fr" ? "Vous êtes arrivé à destination" : "You have arrived at your destination",
        { repeatCount: 1 }
      );
    }
  };

  const recalculateRoute = async () => {
    const now = Date.now();
    if (now - lastRecalcTimeRef.current < recalcCooldown) return;

    await waitForAccuracy();
    lastRecalcTimeRef.current = Date.now();
    try {
      setIsRecalculating(true);
      const lang = (await AsyncStorage.getItem("language")) || "fr";
      await safeSpeak(lang === "fr" ? "Recalcul de l'itinéraire" : "Recalculating route", {
        repeatCount: 1,
      });

      const dest = getDestinationRef.current(navigationPhaseRef.current);
      const response = await getDirections(
        latchauffeurRef.current,
        lonchauffeurRef.current,
        dest.lat,
        dest.lon,
        lang
      );
      if (!response.ok) return;
      const data = await response.json();

      const routes = data.routes;
      if (!routes?.length) return;
      const steps = routes[0]?.legs?.[0]?.steps;
      if (!steps?.length) return;
      navSessionRef.current++;
      setAllPoints(decodeStepsToCoordinates(steps));
      navigationActiveRef.current = true;
      await runNavigationLoop(steps);
    } catch {
      // Coupure réseau ou erreur backend
    } finally {
      setIsRecalculating(false);
    }
  };

  const startPickupNavigation = async (pickUpData: any) => {
    navSessionRef.current++;
    navigationActiveRef.current = true;
    const itinerary = pickUpData.Itinerary || pickUpData.Itinaraire;
    if (!itinerary?.length) {
      navigationActiveRef.current = false;
      return;
    }
    const steps = itinerary[0]?.legs?.[0]?.steps;
    if (!steps?.length) {
      navigationActiveRef.current = false;
      return;
    }
    const internalSteps = steps.map((step: any) => ({
      end_location: step.end_location,
      distance: step.distance,
      duration: step.duration,
      html_instructions: step.html_instructions,
      maneuver: step.maneuver || "straight",
    }));

    if (navigationPhaseRef.current === "pickup") {
      const lang = (await AsyncStorage.getItem("language")) || "fr";
      const introMsg =
        lang === "fr"
          ? "Rejoindre le client en suivant l'itinéraire indiqué"
          : "Join the client by following the indicated route";
      await safeSpeak(introMsg, { repeatCount: 3 });
    }

    await runNavigationLoop(internalSteps);
  };

  const restoreRoute = async (origLat: number, origLon: number, destLat: number, destLon: number) => {
    await waitForAccuracy();
    lastRecalcTimeRef.current = Date.now();
    try {
      setIsRecalculating(true);
      const lang = (await AsyncStorage.getItem("language")) || "fr";
      const response = await getDirections(origLat, origLon, destLat, destLon, lang);
      if (!response.ok) return;
      const data = await response.json();

      const routes = data.routes;
      if (!routes?.length) return;
      const steps = routes[0]?.legs?.[0]?.steps;
      if (!steps?.length) return;
      navSessionRef.current++;
      setAllPoints(decodeStepsToCoordinates(steps));
      navigationActiveRef.current = true;
      await runNavigationLoop(steps);
    } catch {
      // Ignorer
    } finally {
      setIsRecalculating(false);
    }
  };

  return {
    isRecalculating,
    value,
    html,
    currentManeuver,
    remainingSeconds,
    startPickupNavigation,
    recalculateRoute,
    restoreRoute,
  };
};
