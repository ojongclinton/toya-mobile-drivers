import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  Animated,
  Alert,
  Image,
  Button,
  Share,
  FlatList,
  RefreshControl,
  Platform,
  useWindowDimensions,
  useColorScheme,
  ActivityIndicator,
  Linking,
  Dimensions,
} from "react-native";
import MapView, { Polyline, Heatmap, Marker, MarkerAnimated, AnimatedRegion, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ridesApi from "./services/api/rides";
import * as driverApi from "./services/api/driver";
import * as navigationApi from "./services/api/navigation";
import { getDirections } from "./services/api/directions";
import { getAllNotifications } from "./services/api/notificationsApi";
import { getFCMToken, promptEnableNotifications } from "./services/notifications";
import BASE_URL, { GOOGLE_WEATHER_API_KEY } from "../constants/api/BASE_URL";
import * as Location from "expo-location";
import { useFocusEffect } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import * as Clipboard from "expo-clipboard";
import "./translation";
import { Icon } from "react-native-paper";

import { getCachedLocation } from "@/constants/locationCache";
import * as speechService from "./services/speech";
import {
  configureNotificationHandler,
  sendLocalNotification,
  requestNotificationPermissions,
} from "./services/localNotifications";
import { startRideAlert, stopRideAlert, releaseRideAlert } from "./services/rideAlertSound";
import { saveOnlineStatus, loadOnlineStatus } from "./services/onlineStatusStorage";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useAppStateSync } from "./hooks/useAppStateSync";
import { useDriverLocation, type LocationUpdate } from "./hooks/useDriverLocation";
import { useNotificationsSocket } from "./hooks/useNotificationsSocket";
import { useRideStatusSocket } from "./hooks/useRideStatusSocket";
import { useRideRestore } from "./hooks/useRideRestore";
import { useTurnByTurnNavigation } from "./hooks/useTurnByTurnNavigation";
import { reportDriverLocation } from "./services/locationReporter";
import { decodePolylinesToCoordinates, decodeStepsToCoordinates } from "./services/polylineUtils";
import { Toast } from "./components/Toast";
import { GPSWaitingLoader } from "./components/GPSWaitingLoader";
import { GpsStatusBanner } from "./components/GpsStatusBanner";
import WeatherWidget from "./components/WeatherWidget";
import { useWeather } from "./hooks/useWeather";
import { getNavMapStyle } from "@/constants/navMapStyle";
import { RestoreRideModal } from "./components/RestoreRideModal";
import {
  calculateBearing,
  circularMean,
  findLookaheadPoint,
  findNearestOnPolyline,
  predictDeadReckonTarget,
  SNAP_MAX_OFFSET_M,
} from "./services/navigationUtils";

configureNotificationHandler();

const formatRemainingTime = (seconds: number): string => {
  const totalMin = Math.max(1, Math.round(seconds / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}`;
};

// Zoom vue d'ensemble (hors navigation) : zoom 11 pour que les blobs heatmap
// (radius 50px fixe) couvrent ~3-4 km et donnent l'effet nuage de l'image.
const MAP_OVERVIEW_ZOOM = 11;

// Callback STABLE (identité constante) pour les props de la MapView. Passer une nouvelle
// fonction fléchée à chaque render re-commit la carte native ; sur iOS/Fabric, ce churn
// permanent (le home chauffeur re-render ~1×/s : GPS, vitesse, cap) fige les gestes.
const NOOP = () => {};

// #4 — Secondes restantes avant expiration de l'offre (dispatch séquentiel).
const offerSecondsLeft = (expiresAt: string | null): number | null => {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / 1000));
};

// Décompte de l'offre — composant isolé (ne re-rend que lui, pas tout l'écran).
function OfferCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [remaining, setRemaining] = useState<number | null>(() => offerSecondsLeft(expiresAt));
  useEffect(() => {
    setRemaining(offerSecondsLeft(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setRemaining(offerSecondsLeft(expiresAt)), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  if (remaining == null) return null;
  const urgent = remaining <= 8;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}>
      <Icon source="clock-outline" size={16} color={urgent ? "#E53935" : "#7A42F4"} />
      <Text style={{ fontSize: 14, fontWeight: "700", color: urgent ? "#E53935" : "#7A42F4" }}>{remaining}s</Text>
    </View>
  );
}

export default function Home({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Correctif ciblé : le bouton « Aller au client » était caché sous la barre
  // d'onglets UNIQUEMENT sur les appareils edge-to-edge (Android 15 / Samsung),
  // car la barre y est plus haute. On n'ancre la carte au-dessus de la barre
  // QUE dans ce cas ; tous les autres appareils gardent leur rendu d'origine
  // (top 80% / bottom 50%), donc AUCUN changement pour eux. Mémoïsé → stable.
  const insets = useSafeAreaInsets();
  const acceptedCardAnchor = useMemo(() => {
    const isEdgeToEdge =
      Platform.OS === "android" && Dimensions.get("screen").height - screenHeight <= 8;

    // Appareils NON concernés : comportement d'origine, inchangé.
    if (!isEdgeToEdge) {
      return {
        background: [styles.modalBackgroundChauffeur, { top: "80%" as const }],
        container: [styles.modalContainerdepoChauffeur, { bottom: "50%" as const }],
      };
    }

    // Appareils edge-to-edge : on ancre la carte au-dessus de la barre d'onglets.
    const isTablet = screenWidth >= 768;
    const base = isTablet ? 100 : 80;
    const androidNavFallback = 48;
    const safeBottom = Math.max(insets.bottom, androidNavFallback);
    const tabBarHeight = base + safeBottom;
    return {
      background: [
        styles.modalBackgroundChauffeur,
        { position: "absolute" as const, left: 0, right: 0, bottom: tabBarHeight + 12 },
      ],
      container: styles.modalContainerdepoChauffeur,
    };
  }, [screenWidth, screenHeight, insets.bottom]);


  // Cameroun par défaut (centre géographique), remplacé automatiquement par la vraie position GPS
  const doualaRegion = {
    latitude: 5.3764,
    longitude: 12.3522,
    latitudeDelta: 8.0,
    longitudeDelta: 6.0,
  };
  const [initialRegion, setInitialRegion] = useState<any>(doualaRegion);
  const [region, setRegion] = useState<any>(doualaRegion);

  type Coordinate = {
    latitude: number;
    longitude: number;
  };

  const mapRef = useRef<MapView>(null);

  const [pickUpData, setPickUpData] = useState({
    Data: [],
    Message: "",
  });

  const closeModalInfo = () => {
    setModalInfoVisible(false);
  };

  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const isSpeechEnabledRef = useRef(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [language, setLanguage] = useState("fr");
  const [allPoints, setallPoints] = useState<Coordinate[]>([]);

  useEffect(() => {
    allPointsRef.current = allPoints;
  }, [allPoints]);

  useEffect(() => {
    (async () => {
      try {
        const fcmToken = await getFCMToken();
        const authToken = await AsyncStorage.getItem('authToken');
        if (fcmToken && authToken) {
          await fetch(BASE_URL + '/firebase/register-device/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
            body: JSON.stringify({ fcm_token: fcmToken, device_type: Platform.OS }),
          });
        }
        // Pas de token = permission refusée → invite à l'activer (throttlé 1×/jour).
        if (!fcmToken) {
          promptEnableNotifications(t);
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  const [modalprendredepo, setmodalprendredepoState] = useState(false);
  const setmodalprendredepo = (val: boolean) => {
    modalprendredepoRef.current = val;
    setmodalprendredepoState(val);
  };
  const [switchetpare, setswitchetpare] = useState(true);

  const [clientdata, setclientdata] = useState<any>({});
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [hasUnreadMessage, setHasUnreadMessage] = useState(false);
  const [currentRideStatus, setCurrentRideStatus] = useState<string>("");

  // Ref synchrone sur isLocationReady (synchronisé par un effet plus bas dans le
  // composant). Permet d'attendre que le GPS soit prêt avant d'ouvrir la modal de
  // reprise de course — sinon le chauffeur relance une nav depuis une vieille position.
  const isLocationReadyRef = useRef(false);
  const waitForLocationReady = async (timeoutMs = 15000): Promise<void> => {
    if (isLocationReadyRef.current) return;
    const start = Date.now();
    while (!isLocationReadyRef.current && Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  const {
    showRestoreModal,
    setShowRestoreModal,
    showRestoreModalRef,
    restoreRideData,
    setRestoreRideData,
    checkForActiveRide: restoreCurrentRide,
  } = useRideRestore({
    shouldSkip: () => modalprendredepoRef.current || navigationActiveRef.current || !isOnlineRef.current,
    onRideFound: (_ride, status) => {
      stopSearchInterval();
      setCurrentRideStatus(status);
    },
    waitBeforeShow: waitForLocationReady,
  });

  const {
    isOnline,
    isOnlineRef,
    setOnline,
    startLocationInterval,
    startSearchInterval,
    stopSearchInterval,
    stopIntervals,
  } = useOnlineStatus({
    onLocationTick: () => sendlocalisationdriver(),
    onSearchTick: () => searchForClients(),
  });
  const modalprendredepoRef = useRef(false);
  const driverIdRef = useRef<string | null>(null);
  const isSearchingRef = useRef(false);
  const isInitializingRef = useRef(false);

  const [modalinfoVisible, setModalInfoVisible] = useState(false);
  const [modalVisiblecourse, setModalVisiblecourse] = useState(false);
  const [modalerreur, setModalerreur] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pickupPhase, setPickupPhase] = useState<"go" | "pickup" | "dropoff">("pickup");
  const textdepoouprendre =
    pickupPhase === "go" ? t("go_to_pickup")
    : pickupPhase === "pickup" ? t("pickup_client")
    : t("dropoff_client");
  const [statut, setStatut] = useState("");
  const [iscomplete, setcomplete] = useState(false);
  const [referralCode, setReferalcode] = useState("");

  const [availableRides, setAvailableRides] = useState<any[]>([]);
  const [isRefreshingRides, setIsRefreshingRides] = useState(false);

  const [clientIdcurent, setClientIdcurent] = useState("");
  const [dateclientcourse, setdateclientcourse] = useState("");
  const [rideCompleteDuration, setRideCompleteDuration] = useState<number | null>(null);
  const [ridePricing, setRidePricing] = useState<any>(null);
  const [distancecurent, setDistancecurent] = useState();
  const [endLocationcuerent, setEndLocationcurent] = useState("");
  const [finalPricecurent, setFinalPricecurent] = useState("");
  const [idcurrent, setIdcurentState] = useState("");
  const idcurrentRef = useRef("");
  const canceledRideIdsRef = useRef<Set<string>>(new Set());
  const setIdcurent = (val: string) => {
    idcurrentRef.current = val;
    setIdcurentState(val);
  };
  const [latEndLocationcurent, setLatEndLocationcurent] = useState(0);
  const [latStartLocationcurent, setLatStartLocationcurent] = useState(0);
  const [lonEndLocationcurent, setLonEndLocationcurent] = useState(0);
  const [lonStartLocationcurent, setLonStartLocationcurent] = useState(0);
  const [prestationcurent, setPrestationcurent] = useState("");
  const [startLocationcurent, setStartLocationcurent] = useState("");
  const [Visiblepolyline, setVisiblepolyline] = useState(false);
  const [mode_of_payments, setModeOfPayment] = useState("");
  const [solde, setsolde] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  // #4 — Expiration de l'offre courante (poussée par le WS new_ride_available).
  const [offerExpiresAt, setOfferExpiresAt] = useState<string | null>(null);
  const [cancelToastVisible, setCancelToastVisible] = useState(false);
  const cancelToastOpacity = useRef(new Animated.Value(0)).current;
  const [acceptToastVisible, setAcceptToastVisible] = useState(false);
  const acceptToastOpacity = useRef(new Animated.Value(0)).current;
  const [completeToastVisible, setCompleteToastVisible] = useState(false);
  const completeToastOpacity = useRef(new Animated.Value(0)).current;

  // ✅ NOUVEAU : Photo client + infos véhicule chauffeur
  const [clientProfilePicture, setClientProfilePicture] = useState("");
  const [vehiclePhoto, setVehiclePhoto] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");

  // ✅ NOUVEAU : Zones chaudes
  type HotZone = {
    zone_id: string;
    center_lat: number;
    center_lon: number;
    rides_count: number;
    density_level: "high" | "medium" | "low";
    radius_km: number;
  };

  const [hotZones, setHotZones] = useState<HotZone[]>([]);
  const hotZonesIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Navigation 3D + recalcul
  const [driverHeading, setDriverHeading] = useState(0);
  const driverHeadingRef = useRef(0);
  const [driverSpeedKmh, setDriverSpeedKmh] = useState(0);
  const driverSpeedMsRef = useRef<number>(0);
  const smoothedSpeedRef = useRef<number>(0);
  const SPEED_NOISE_THRESHOLD_MS = 2.8; // < ~10 km/h à l'arrêt → 0
  const snappedPosRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [destMarkerReady, setDestMarkerReady] = useState(false);
  // ✅ Carte de navigation prête : on diffère l'affichage du tracé jusqu'à ce que la
  // MapView (re)montée soit initialisée, sinon une polyline ajoutée sur une surface
  // native fraîche n'est parfois pas peinte (bascule Visiblepolyline → remontage).
  const [navMapReady, setNavMapReady] = useState(false);
  const [navMapPadding, setNavMapPadding] = useState<{top:number,right:number,bottom:number,left:number} | undefined>(undefined);
  const [mainMapPadding, setMainMapPadding] = useState<{top:number,right:number,bottom:number,left:number} | undefined>(undefined);
  const allPointsRef = useRef<Coordinate[]>([]);
  const navigationActiveRef = useRef(false);
  // Verrou anti double-tap sur le bouton d'action (Aller / Récupérer / Déposer) :
  // évite un double POST /start ou /complete sur un clic rapide.
  const isProcessingActionRef = useRef(false);
  const ACCURACY_THRESHOLD = 35;    // mètres — réaliste pour les puces GPS bas de gamme (Douala urbain)
  // Style de carte selon le thème système du téléphone (clair / sombre)
  const colorScheme = useColorScheme();
  // Références STABLES : une nouvelle identité de prop à chaque render re-commit la MapView
  // native et, sur iOS/Fabric, finit par figer les gestes. On mémoïse donc style + customMapStyle.
  const mapStyle = useMemo(() => getNavMapStyle(colorScheme), [colorScheme]);
  const fullScreenMapStyle = useMemo(
    () => ({ position: "absolute" as const, width: screenWidth, height: screenHeight, top: 0, left: 0 }),
    [screenWidth, screenHeight]
  );
  const RECALC_COOLDOWN = 12000;    // 12s entre deux recalculs
  const BEARING_LOOKAHEAD_M = 30;   // distance de visée pour le cap
  const MIN_SPEED_FOR_HEADING_MS = 1.4; // 5 km/h — en dessous, heading GPS peu fiable
  const HEADING_BUFFER_SIZE = 5;    // fenêtre de lissage

  const headingBufferRef = useRef<number[]>([]);

  // Marker animé : interpole entre deux fixes GPS pour un rendu fluide (pas de sauts de 1s)
  const driverMarkerCoord = useRef(
    new AnimatedRegion({
      latitude: 0,
      longitude: 0,
      latitudeDelta: 0,
      longitudeDelta: 0,
    })
  ).current;
  const markerFirstFixRef = useRef(true);
  const MARKER_ANIM_DURATION_MS = 900; // < GPS interval (1000ms) pour éviter le chevauchement
  const lastTrimSegIdxRef = useRef(-1); // dernier index de segment consommé


  // Snap marker + consommation progressive de la polyline en un seul passage.
  const maybeSnapLocal = (lat: number, lon: number) => {
    if (!navigationActiveRef.current) return;
    // Snap adaptatif : sur GPS imprécis (appareils bas de gamme), on élargit la
    // tolérance proportionnellement à la précision courante pour garder le marqueur
    // collé à la route au lieu de le laisser sauter. Plafonné à 120 m.
    const acc = currentAccuracyRef.current;
    const snapMaxOffset = Math.min(120, Math.max(SNAP_MAX_OFFSET_M, (Number.isFinite(acc) ? acc : 0) * 1.5));
    const result = findNearestOnPolyline(lat, lon, allPointsRef.current, snapMaxOffset);
    if (!result) {
      snappedPosRef.current = null;
      return;
    }

    snappedPosRef.current = { latitude: result.latitude, longitude: result.longitude };

    // 1. Snap du marker sur la route
    driverMarkerCoord
      .timing({
        latitude: result.latitude,
        longitude: result.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration: 500,
        useNativeDriver: false,
      } as any)
      .start();

    // 2. Consommer les segments déjà parcourus (mise à jour seulement si on a avancé)
    if (result.segIdx > lastTrimSegIdxRef.current) {
      lastTrimSegIdxRef.current = result.segIdx;
      const points = allPointsRef.current;
      const remaining: Coordinate[] = [
        { latitude: result.latitude, longitude: result.longitude },
        ...points.slice(result.segIdx + 1),
      ];
      if (remaining.length >= 2) {
        setallPoints(remaining);
      }
    }
  };


  // Caméra de navigation : verrouillée par défaut (suit le chauffeur).
  // L'utilisateur peut la déverrouiller en faisant un pan/zoom ; auto-relock après 5s d'inactivité.
  const [isCameraLocked, setIsCameraLocked] = useState(true);
  const isCameraLockedRef = useRef(true);
  const unlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUnlockTimer = () => {
    if (unlockTimerRef.current) {
      clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  };

  const lockCamera = () => {
    clearUnlockTimer();
    isCameraLockedRef.current = true;
    setIsCameraLocked(true);
  };

  const unlockCamera = () => {
    isCameraLockedRef.current = false;
    setIsCameraLocked(false);
    clearUnlockTimer();
    // Re-verrouillage automatique : 10 s après que le chauffeur a lâché la carte,
    // on reprend le suivi (uniquement en navigation).
    if (navigationActiveRef.current) {
      unlockTimerRef.current = setTimeout(() => {
        if (navigationActiveRef.current) recenterAndLockCamera();
      }, 10000);
    }
  };

  const recenterAndLockCamera = () => {
    const lat = latchauffeurRef.current;
    const lon = lonchauffeurRef.current;
    if (lat && lon) {
      const camPos = snappedPosRef.current ?? { latitude: lat, longitude: lon };
      mapRef.current?.animateCamera(
        {
          center: camPos,
          heading: driverHeadingRef.current,
          pitch: 30,
          zoom: 19,
        },
        { duration: 800 }
      );
    }
    lockCamera();
  };

  const navigationPhaseRef = useRef<"pickup" | "dropoff">("pickup");

  const handleLocationUpdate = (update: LocationUpdate) => {
    const { latitude, longitude, heading, speed, isFirst } = update;
    if (speed !== null && speed >= 0) {
      driverSpeedMsRef.current = speed;
      smoothedSpeedRef.current = smoothedSpeedRef.current * 0.7 + speed * 0.3;
      const display = smoothedSpeedRef.current < SPEED_NOISE_THRESHOLD_MS ? 0 : Math.round(smoothedSpeedRef.current * 3.6);
      setDriverSpeedKmh(display);
    }

    const currentRegion = {
      latitude,
      longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };

    if (navigationActiveRef.current && allPointsRef.current.length > 1) {
      const target = findLookaheadPoint(
        latitude,
        longitude,
        allPointsRef.current,
        BEARING_LOOKAHEAD_M
      );
      if (target) {
        const bearing = calculateBearing(
          latitude, longitude,
          target.latitude, target.longitude
        );
        driverHeadingRef.current = bearing;
        setDriverHeading(bearing);
      }
    } else if (
      heading !== null &&
      heading >= 0 &&
      speed !== null &&
      speed >= MIN_SPEED_FOR_HEADING_MS
    ) {
      const buf = headingBufferRef.current;
      buf.push(heading);
      if (buf.length > HEADING_BUFFER_SIZE) buf.shift();
      const smoothed = circularMean(buf);
      const headingDiff = Math.abs(smoothed - driverHeadingRef.current);
      if (headingDiff > 15 && headingDiff < 345) {
        driverHeadingRef.current = smoothed;
        setDriverHeading(smoothed);
      }
    }

    if (markerFirstFixRef.current) {
      driverMarkerCoord.setValue({
        latitude,
        longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      markerFirstFixRef.current = false;
    } else if (navigationActiveRef.current) {
      // En navigation : snap sur la route, pas de dead reckoning (les deux animations se battent)
      maybeSnapLocal(latitude, longitude);
    } else {
      // Hors navigation : dead reckoning pour fluidité entre les ticks GPS
      const target = predictDeadReckonTarget(
        latitude,
        longitude,
        speed,
        driverHeadingRef.current
      );
      driverMarkerCoord
        .timing({
          latitude: target.latitude,
          longitude: target.longitude,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: MARKER_ANIM_DURATION_MS,
          useNativeDriver: false,
        } as any)
        .start();
    }

    setRegion(currentRegion);

    if (isFirst) {
      const prefetched = getCachedLocation();
      const centerCoords = prefetched ?? { latitude, longitude };
      setTimeout(() => {
        mapRef.current?.animateCamera({
          center: centerCoords,
          heading: 0,
          pitch: 0,
          zoom: MAP_OVERVIEW_ZOOM,
        }, { duration: 500 });
      }, 500);
    } else if (navigationActiveRef.current) {
      if (isCameraLockedRef.current) {
        const camPos = snappedPosRef.current ?? { latitude, longitude };
        mapRef.current?.animateCamera({
          center: camPos,
          heading: driverHeadingRef.current,
          pitch: 30,
          zoom: 19,
        }, { duration: 1000 });
      }
    }
  };

  const {
    latchauffeur,
    lonchauffeur,
    setlatchauffeur,
    setlonchauffeur,
    latchauffeurRef,
    lonchauffeurRef,
    currentAccuracyRef,
    isLocationReady,
    isWaitingForGPS,
    servicesEnabled,
    lowAccuracy,
    waitForAccuracy,
  } = useDriverLocation({
    onUpdate: handleLocationUpdate,
    accuracyThreshold: ACCURACY_THRESHOLD,
  });

  const weather = useWeather(latchauffeur, lonchauffeur, GOOGLE_WEATHER_API_KEY);

  // P3 : ouvre les réglages de localisation du téléphone (mode Haute précision).
  const openLocationSettings = () => {
    if (Platform.OS === "android") {
      Linking.sendIntent("android.settings.LOCATION_SOURCE_SETTINGS").catch(() => {
        Linking.openSettings().catch(() => {});
      });
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  useEffect(() => {
    isLocationReadyRef.current = isLocationReady;
  }, [isLocationReady]);

  // Recentre la caméra sur le chauffeur dès qu'on (re)bascule sur la map normale
  // et qu'on a une position GPS valide (fin de course, annulation, premier fix, etc.)
  useEffect(() => {
    if (Visiblepolyline) return;
    if (!isLocationReady) return;
    const lat = latchauffeurRef.current;
    const lon = lonchauffeurRef.current;
    if (!lat || !lon) return;
    const t = setTimeout(() => {
      mapRef.current?.animateCamera(
        { center: { latitude: lat, longitude: lon }, heading: 0, pitch: 0, zoom: MAP_OVERVIEW_ZOOM },
        { duration: 500 }
      );
    }, 600);
    return () => clearTimeout(t);
  }, [Visiblepolyline, isLocationReady]);

  const {
    isRecalculating,
    value,
    html,
    currentManeuver,
    remainingSeconds,
    startPickupNavigation,
    restoreRoute,
  } = useTurnByTurnNavigation({
    latchauffeurRef,
    lonchauffeurRef,
    currentAccuracyRef,
    speedMsRef: driverSpeedMsRef,
    navigationActiveRef,
    navigationPhaseRef,
    routePointsRef: allPointsRef,
    waitForAccuracy,
    accuracyThreshold: ACCURACY_THRESHOLD,
    recalcCooldown: RECALC_COOLDOWN,
    setAllPoints: (points) => {
      lastTrimSegIdxRef.current = -1;
      snappedPosRef.current = null;
      setallPoints(points);
    },
    getDestinationForPhase: (phase) => ({
      lat: phase === "pickup" ? latStartLocationcurent : latEndLocationcurent,
      lon: phase === "pickup" ? lonStartLocationcurent : lonEndLocationcurent,
    }),
  });

  // Convertit les zones chaudes en points pondérés pour le Heatmap.
  // Un seul point par zone (le centre) — pas d'anneau satellite pour éviter
  // les blobs visibles quand l'utilisateur zoome. L'effet "nuage fusionné"
  // se produit naturellement quand plusieurs zones géographiquement proches
  // se chevauchent à l'écran.
  const hotZonesToHeatmapPoints = (zones: HotZone[]) => {
    const densityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return zones.map((zone) => ({
      latitude: zone.center_lat,
      longitude: zone.center_lon,
      weight: densityWeight[zone.density_level] ?? 1,
    }));
  };

  // ✅ Récupérer les zones chaudes depuis l'API
  const getHotZones = async () => {
    try {
      const response = await navigationApi.getHotZones();
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.Data)) {
        setHotZones(data.Data);
      }
    } catch {}
  };

  // ✅ Démarrer/arrêter le rafraîchissement des zones chaudes
  const startHotZonesRefresh = () => {
    getHotZones(); // Appel immédiat
    if (hotZonesIntervalRef.current) clearInterval(hotZonesIntervalRef.current);
    hotZonesIntervalRef.current = setInterval(() => {
      // console.log("🔥 Rafraîchissement zones chaudes (30s)");
      getHotZones();
    }, 30000);
  };

  const stopHotZonesRefresh = () => {
    if (hotZonesIntervalRef.current) {
      clearInterval(hotZonesIntervalRef.current);
      hotZonesIntervalRef.current = null;
    }
    setHotZones([]);
  };

  const checkUnreadNotifications = async (retriesLeft = 3) => {
    try {
      const response = await getAllNotifications();
      if (!response.ok) throw new Error(`Erreur: ${response.status}`);
      const data = await response.json();
      if (data.Data && Array.isArray(data.Data)) {
        const hasUnread = data.Data.some((notif: any) => !notif.is_read);
        setHasUnreadNotifications(hasUnread);
      }
    } catch (error) {
      // ✅ Retry borné : couvre la course "juste après login" (jeton/réseau pas prêt)
      if (retriesLeft > 0) {
        setTimeout(() => checkUnreadNotifications(retriesLeft - 1), 1500);
      }
    }
  };

  // ✅ Quand la MapView est remontée (switch Visiblepolyline), ré-animer sur la position courante
  useEffect(() => {
    // À chaque bascule, on reverrouille la caméra et on annule tout timer en cours
    clearUnlockTimer();
    isCameraLockedRef.current = true;
    setIsCameraLocked(true);

    // ✅ Repaint robuste du tracé : la carte nav est remontée à chaque bascule → on
    // attend onMapReady avant d'afficher la polyline. Filet de sécurité si onMapReady
    // ne se déclenche pas (rare) : on force après 700ms. Reset quand on quitte la nav.
    let readyFallback: ReturnType<typeof setTimeout> | null = null;
    if (Visiblepolyline) {
      readyFallback = setTimeout(() => setNavMapReady(true), 700);
    } else {
      setNavMapReady(false);
    }

    const lat = latchauffeurRef.current;
    const lon = lonchauffeurRef.current;
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (lat && lon) {
      timer = setTimeout(() => {
        mapRef.current?.animateCamera({
          center: { latitude: lat, longitude: lon },
          heading: Visiblepolyline ? driverHeadingRef.current : 0,
          pitch: Visiblepolyline ? 30 : 0,
          zoom: Visiblepolyline ? 19 : MAP_OVERVIEW_ZOOM,
        }, { duration: 300 });
      }, Visiblepolyline ? 100 : 600);
    }
    return () => {
      if (timer) clearTimeout(timer);
      if (readyFallback) clearTimeout(readyFallback);
    };
  }, [Visiblepolyline]);

  useEffect(() => {
    return () => clearUnlockTimer();
  }, []);

  // ✅ CORRIGÉ : Recentrer sur la position actuelle déjà suivie en temps réel
  const goToCurrentLocation = async () => {
    try {
      // ✅ Priorité : refs toujours à jour (pas de stale state)
      const lat = latchauffeurRef.current;
      const lon = lonchauffeurRef.current;
      if (lat && lon) {
        mapRef.current?.animateCamera({
          center: { latitude: lat, longitude: lon },
          heading: driverHeadingRef.current,
          pitch: 0,
          zoom: MAP_OVERVIEW_ZOOM,
        }, { duration: 600 });
        return;
      }

      // ✅ Fallback si le GPS n'a pas encore donné de position
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Veuillez autoriser l'accès à votre localisation.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const { latitude, longitude } = location.coords;
      latchauffeurRef.current = latitude;
      lonchauffeurRef.current = longitude;
      setlatchauffeur(latitude);
      setlonchauffeur(longitude);
      const currentRegion = { latitude, longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      setRegion(currentRegion);
      mapRef.current?.animateCamera({
        center: { latitude, longitude },
        heading: 0,
        pitch: 0,
        zoom: MAP_OVERVIEW_ZOOM,
      }, { duration: 600 });
    } catch (error) {
      // console.error("❌ Erreur recentrage:", error);
      Alert.alert("Erreur", "Impossible de récupérer votre position actuelle.");
    }
  };

  const speak = async (text: string, repeatCount: number = 1) => {
    if (!isSpeechEnabledRef.current) return;
    try {
      await speechService.speak(text, {
        repeatCount,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  };

  const stopSpeech = () => {
    speechService.stopSpeech();
    setIsSpeaking(false);
  };

  const toggleSpeech = async () => {
    const newState = !isSpeechEnabled;
    isSpeechEnabledRef.current = newState;
    speechService.setSpeechEnabled(newState);
    if (!newState) setIsSpeaking(false);
    setIsSpeechEnabled(newState);
    try {
      await AsyncStorage.setItem("isSpeechEnabled", newState.toString());
    } catch (error) {
      // console.error("Erreur lors de la sauvegarde de l'état vocal:", error);
    }
  };

  const goOnline = async () => {
    const freshBalance = await getAllTransactions();
    const balanceToCheck = freshBalance ?? solde;
    if (balanceToCheck < 500) {
      Alert.alert(t("add_funds"), t("add_funds_message"));
      navigation.navigate("wallettab");
      return;
    }
    // ✅ Re-fetch frais du statut si l'état local n'est pas déjà "validated"
    // (évite un blocage juste après login quand getValidationStatues n'a pas encore répondu)
    let currentStatut = statut;
    if (currentStatut?.trim().toLowerCase() !== "validated") {
      currentStatut = await getValidationStatues();
    }
    const normalizedStatut = currentStatut?.trim().toLowerCase();
    if (normalizedStatut !== "validated") {
      if (normalizedStatut === "in pending") {
        Alert.alert(t("vehicle_waiting"));
      } else {
        Alert.alert(t("verify_profile"), t("verify_profile_message"));
        navigation.navigate("verification");
      }
      return;
    }
    try {
      await driverApi.updateAvailability(true);
    } catch {
      // silently ignore
    }
    setOnline(true);
    await saveOnlineStatus(true);
    await sendlocalisationdriver();
    await restoreCurrentRide();
    await searchForClients();
    startHotZonesRefresh();
    startLocationInterval();
    startSearchInterval();
  };

  const searchForClients = async () => {
    if (!isOnlineRef.current) return;
    if (modalprendredepoRef.current) return;
    if (isSearchingRef.current) return;
    isSearchingRef.current = true;
    try {
      await getAllrides();
    } finally {
      isSearchingRef.current = false;
    }
  };

  const goOffline = async () => {
    try {
      await driverApi.updateAvailability(false);
    } catch {
      // silently ignore
    }
    setOnline(false);
    await saveOnlineStatus(false);
    stopIntervals();
    stopHotZonesRefresh();
  };

  const toggleSwitch = async () => {
    if (isOnline) await goOffline();
    else await goOnline();
  };

  useEffect(() => {
    return () => {
      // ✅ Nettoyage zones chaudes (les intervals online/search sont gérés par le hook useOnlineStatus)
      // (le cleanup des WebSockets est géré par useNotificationsSocket/useRideStatusSocket)
      if (hotZonesIntervalRef.current) clearInterval(hotZonesIntervalRef.current);
    };
  }, []);

  useAppStateSync(async () => {
    // ✅ iOS suspend watchPositionAsync en background — forcer un fix GPS frais
    // Sur Android on évite (un fix BestForNavigation concurrent recentre la caméra)
    if (Platform.OS === "ios") {
      try {
        const fresh = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        latchauffeurRef.current = fresh.coords.latitude;
        lonchauffeurRef.current = fresh.coords.longitude;
        currentAccuracyRef.current = fresh.coords.accuracy ?? Infinity;
        setlatchauffeur(fresh.coords.latitude);
        setlonchauffeur(fresh.coords.longitude);
      } catch {
        // GPS indisponible → watchPositionAsync délivrera le prochain fix
      }
    }

    const lat = latchauffeurRef.current;
    const lon = lonchauffeurRef.current;
    if (lat && lon) {
      mapRef.current?.animateCamera({
        center: { latitude: lat, longitude: lon },
        heading: driverHeadingRef.current,
        pitch: 0,
        zoom: MAP_OVERVIEW_ZOOM,
      }, { duration: 500 });
    }

    // ✅ iOS ferme les WebSockets en background → reconnecter si besoin
    reconnectNotificationsIfNeeded();
    reconnectRideStatusIfNeeded();

    const wasOnline = await loadOnlineStatus();
    if (wasOnline) {
      setOnline(true);
      await sendlocalisationdriver();
      startHotZonesRefresh();
      startLocationInterval();
      if (!modalprendredepoRef.current) {
        await restoreCurrentRide();
        await searchForClients();
        startSearchInterval();
      }
    }
  });

  const handlePress = () => {
    // Verrou anti double-tap : si une action est déjà en cours, on ignore le clic.
    if (isProcessingActionRef.current) return;
    isProcessingActionRef.current = true;
    try {
    const driverLat = latchauffeurRef.current;
    const driverLon = lonchauffeurRef.current;
    const PROXIMITY_THRESHOLD = 100; // mètres
    // Garde : GPS pas encore fixé → éviter un calcul de distance depuis (0,0)
    if (!driverLat || !driverLon) {
      Alert.alert(
        t("warning") || "Attention",
        t("gps_not_ready") || "Position GPS non disponible. Veuillez patienter quelques secondes."
      );
      return;
    }

    // Phase "aller" : c'est seulement ici qu'on trace l'itinéraire pour rejoindre le client
    if (pickupPhase === "go") {
      // Mémorise que le chauffeur est parti vers le client (utile à la reprise de course)
      AsyncStorage.setItem("ride_aller_clicked", "1").catch(() => {});
      getpickup(idcurrentRef.current, latStartLocationcurent, lonStartLocationcurent).catch(() => {});
      setPickupPhase("pickup");
      return;
    }

    // Convertit la distance en degrés → mètres (approximation équateur)
    const toMeters = (dLat: number, dLon: number) => {
      const mLat = dLat * 111320;
      const mLon = dLon * 111320 * Math.cos(driverLat * (Math.PI / 180));
      return Math.sqrt(mLat * mLat + mLon * mLon);
    };

    if (pickupPhase === "dropoff") {
      // Vérifier proximité destination
      const distToDestination = toMeters(
        Math.abs(driverLat - latEndLocationcurent),
        Math.abs(driverLon - lonEndLocationcurent)
      );
      if (distToDestination > PROXIMITY_THRESHOLD) {
        Alert.alert(
          t("warning") || "Attention",
          t("not_at_destination") || `Vous semblez être à ${Math.round(distToDestination)}m de la destination. Êtes-vous bien arrivé ?`,
          [
            { text: t("cancel") || "Annuler", style: "cancel" },
            {
              text: t("confirm") || "Confirmer",
              onPress: () => {
                setmodalprendredepo(false);
                setswitchetpare(true);
                setdateclientcourse("");
                getComplete().catch(() => {});
                setcomplete(true);
                setPickupPhase("pickup");
              },
            },
          ]
        );
      } else {
        setmodalprendredepo(false);
        setswitchetpare(true);
        setdateclientcourse("");
        getComplete().catch(() => {});
        setcomplete(true);
        setPickupPhase("pickup");
      }
    } else if (pickupPhase === "pickup") {
      // Vérifier proximité client
      const distToClient = toMeters(
        Math.abs(driverLat - latStartLocationcurent),
        Math.abs(driverLon - lonStartLocationcurent)
      );
      if (distToClient > PROXIMITY_THRESHOLD) {
        Alert.alert(
          t("warning") || "Attention",
          t("not_at_pickup") || `Vous semblez être à ${Math.round(distToClient)}m du client. Êtes-vous bien arrivé ?`,
          [
            { text: t("cancel") || "Annuler", style: "cancel" },
            {
              text: t("confirm") || "Confirmer",
              onPress: () => {
                startride();
                setPickupPhase("dropoff");
              },
            },
          ]
        );
      } else {
        startride();
        setPickupPhase("dropoff");
      }
    }
    } finally {
      // Relâche le verrou après un court délai : couvre aussi les actions
      // asynchrones lancées sans await (startride/getComplete) et empêche un
      // double POST /start ou /complete sur un re-tap rapproché.
      setTimeout(() => { isProcessingActionRef.current = false; }, 1200);
    }
  };

  const [modalVisible, setModalVisible] = useState(false);
  const [isRequetteclient, setRequetteClient] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const showParain = () => setModalVisible(true);

  const closeModal = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true })
      .start(() => setModalVisible(false));
  };

  const closeRequetteclient = () => {
    setOfferExpiresAt(null);
    Animated.timing(slideAnim, { toValue: 300, duration: 300, useNativeDriver: true })
      .start(() => setRequetteClient(false));
  };

  const closecomplete = () => {
    setcomplete(false);
  };

  useEffect(() => {
    if (modalVisible) {
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [modalVisible]);

  // ✅ Alarme "nouvelle course" : sonne en boucle tant que la demande est affichée,
  // s'arrête à l'acceptation / refus / disparition de la demande.
  useEffect(() => {
    if (isRequetteclient) {
      startRideAlert();
    } else {
      stopRideAlert();
    }
  }, [isRequetteclient]);

  // ✅ Libère le lecteur audio au démontage de l'écran
  useEffect(() => () => releaseRideAlert(), []);

  useFocusEffect(
    React.useCallback(() => {
      const initializeApp = async () => {
        if (isInitializingRef.current) return;
        isInitializingRef.current = true;
        try {
          const savedState = await AsyncStorage.getItem("isSpeechEnabled");
          if (savedState !== null) {
            const parsed = savedState === "true";
            isSpeechEnabledRef.current = parsed;
            setIsSpeechEnabled(parsed);
            speechService.setSpeechEnabled(parsed);
          }
        } catch (error) {
          // console.error("Erreur récupération état vocal:", error);
        }

        const wasOnline = await loadOnlineStatus();
        if (wasOnline) {
          setOnline(true);
          await sendlocalisationdriver();
          startHotZonesRefresh();
          startLocationInterval();
          if (!modalprendredepoRef.current) {
            await searchForClients();
            startSearchInterval();
          }
        }

        await requestNotificationPermissions();
        getInfo();
        connectRideStatusWebSocket();
        getAllTransactions();
        getValidationStatues();
        checkUnreadNotifications();
        await restoreCurrentRide();
        isInitializingRef.current = false;
      };

      initializeApp();

      return () => {
        stopIntervals();
      };
    }, [])
  );

  const goToInitialLocation = () => {
    if (initialRegion) {
      setRegion(initialRegion);
      mapRef.current?.animateToRegion(initialRegion, 1000);
    }
  };

  const getValidationStatues = async (): Promise<string> => {
    try {
      const response = await driverApi.getVehicleValidation();
      if (!response.ok) return "";
      const data = await response.json();
      const value = typeof data.Data === "string" ? data.Data : "";
      if (value) setStatut(value);
      return value;
    } catch {
      return "";
    }
  };

  const paymentMapping: Record<string, string> = {
    orange_money: "Orange Money",
    mtn_money: "MTN Mobile Money",
    cash: t("cash"),
  };

  const getAllTransactions = async (): Promise<number | null> => {
    try {
      const response = await driverApi.getWalletHistory();
      if (!response.ok) return null;
      const data = await response.json();
      const payload = data.Data ?? data;
      const balance = payload.current_balance ?? payload["All Gain"] ?? null;
      if (balance !== null) setsolde(balance);
      return balance;
    } catch { return null; }
  };

  const getAllrides = async (): Promise<boolean> => {
    try {
      const response = await ridesApi.getPendingRides();
      if (!response.ok) return false;
      const data = await response.json();

      if (!Array.isArray(data.Data) || data.Data.length === 0) {
        setAvailableRides([]);
        return false;
      }

      const filteredData = data.Data.filter(
        (ride: any) => !canceledRideIdsRef.current.has(ride.id)
      );
      if (filteredData.length === 0) {
        setAvailableRides([]);
        return false;
      }

      const formattedRides = filteredData.map((ride: any) => {
        const date = new Date(ride.accepted_time);
        const lang = language === "fr" ? "fr-FR" : "en-US";
        const formattedDate = date.toLocaleDateString(lang, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }) + " " + (language === "fr" ? "à" : "at") + " " + date.toLocaleTimeString(lang, {
          hour: "2-digit",
          minute: "2-digit",
        });
        return {
          ...ride,
          formattedDate,
          mode_of_payment_label: paymentMapping[ride.mode_of_payments] || "Inconnu",
        };
      });

      setAvailableRides(formattedRides);
      if (!navigationActiveRef.current && !modalprendredepoRef.current && isOnlineRef.current && isLocationReadyRef.current) {
        setRequetteClient(true);
      }
      return true;
    } catch {
      return false;
    }
  };

  const cancelRide = async (rideId: string) => {
    try {
      const response = await ridesApi.cancelRide(rideId);
      const data = await response.text();
      // console.log("🚫 [cancelRide] Status HTTP:", response.status);
      // console.log("🚫 [cancelRide] Réponse serveur:", data);
      if (response.ok) {
        setCancelToastVisible(true);
        Animated.sequence([
          Animated.timing(cancelToastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(cancelToastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => setCancelToastVisible(false));
      }
      setRequetteClient(false);
    } catch (error) {
      // console.error("❌ [cancelRide] Erreur réseau:", error);
    }
  };

  // Refus explicite d'une offre (dispatch séquentiel) : annule la course pour CE
  // chauffeur → le backend passe immédiatement au suivant (accélère la cascade au
  // lieu d'attendre les 25 s de timeout). On ferme la carte tout de suite.
  const refuseRide = async (ride: any) => {
    if (isAccepting) return;
    closeRequetteclient();
    try { await ridesApi.cancelRide(ride.id); } catch (_) {}
    await searchForClients().catch(() => {});
  };

  const acceptRide = async (ride: any) => {
    setIsAccepting(true);
    try {
      const response = await ridesApi.acceptRide(ride.id);
      const acceptData = await response.json().catch(() => null);

      if (response.status === 403) {
        if (acceptData?.active_ride_id) {
          Alert.alert(
            t("active_ride_title"),
            `${acceptData.Message}\n\n📍 ${acceptData.pickup_location}\n🏁 ${acceptData.destination}`
          );
          return;
        }
        if (acceptData?.error === "insufficient_wallet" || acceptData?.required_amount) {
          const required = Number(acceptData.required_amount ?? 0).toLocaleString(
            language === "fr" ? "fr-FR" : "en-GB"
          );
          const balance = Number(acceptData.current_balance ?? 0).toLocaleString(
            language === "fr" ? "fr-FR" : "en-GB"
          );
          Alert.alert(
            t("wallet_insufficient_title"),
            acceptData?.Message || t("wallet_insufficient_body", { required, balance }),
            [
              { text: t("close"), style: "cancel" },
              {
                text: t("add_funds_button"),
                onPress: () => navigation.navigate("wallettab"),
              },
            ]
          );
          return;
        }
        setModalerreur(true);
        return;
      }

      // Dispatch séquentiel : l'offre a expiré ou est passée à un autre chauffeur
      // (NOT_OFFERED_TO_YOU / OFFER_EXPIRED / 400 « no longer available »). PAS d'erreur
      // bloquante → on ferme la carte et on rafraîchit la liste (offre suivante).
      const offerCode = acceptData?.code;
      if (
        response.status === 409 || response.status === 400 ||
        offerCode === "NOT_OFFERED_TO_YOU" || offerCode === "OFFER_EXPIRED"
      ) {
        closeRequetteclient();
        await searchForClients().catch(() => {});
        return;
      }

      if (!response.ok) {
        setModalerreur(true);
        return;
      }

      // 200 → course gagnée
      {
        setRidePricing(acceptData?.ride_pricing ?? null);
        setclientdata(ride.client_details ?? {});
        setClientIdcurent(ride.client_details?.id ?? "");
        setDistancecurent(ride.distance);
        setEndLocationcurent(ride.end_location);
        setFinalPricecurent(ride.final_price);
        setIdcurent(ride.id);
        setLatEndLocationcurent(ride.lat_end_location);
        setLatStartLocationcurent(ride.lat_start_location);
        setLonEndLocationcurent(ride.lon_end_location);
        setLonStartLocationcurent(ride.lon_start_location);
        setPrestationcurent(ride.prestation);
        setStartLocationcurent(ride.start_location);
        setModeOfPayment(ride.mode_of_payment_label || "");
        setdateclientcourse(ride.formattedDate || "");
        closeRequetteclient();
        setswitchetpare(false);
        stopSearchInterval();
        setCurrentRideStatus("accepted_by_driver");
        setPickupPhase("go");
        // Nouvelle course : on repart de zéro sur le flag "Aller"
        AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
        setAcceptToastVisible(true);
        Animated.sequence([
          Animated.timing(acceptToastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.delay(2500),
          Animated.timing(acceptToastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start(() => setAcceptToastVisible(false));

        const clientId = ride.client_details?.id;
        if (clientId) {
          await AsyncStorage.setItem("idclientcurentride", clientId);
        }
        await AsyncStorage.setItem("idride", ride.id);
        // Sauvegarde du numéro client : repli si la restauration ne le récupère pas
        // (nettoyé quand la course proprement dite démarre, cf. startride).
        const clientPhone = ride.client_details?.phone_number;
        if (clientPhone) {
          await AsyncStorage.setItem("clientPhoneCurrentRide", String(clientPhone));
        } else {
          await AsyncStorage.removeItem("clientPhoneCurrentRide").catch(() => {});
        }

        // Afficher la carte client avec le bouton "Aller" — l'itinéraire ne sera
        // tracé que lorsque le chauffeur cliquera sur "Aller" (handlePress, phase "go")
        setmodalprendredepo(true);

        // Photo client en parallèle (le tracé d'itinéraire se fera au clic sur "Aller")
        // Catch local : un échec de récupération du profil ne doit PAS déclencher le
        // catch principal (fausse « erreur de connexion ») alors que la course est acceptée.
        if (clientId) await getprofilclient(clientId).catch(() => {});
      }
      return;
    } catch {
      Alert.alert(t("connection_error"));
    } finally {
      setIsAccepting(false);
    }
  };

  const getprofilclient = async (clientid: any) => {
    try {
      const response = await ridesApi.getClientProfile(clientid);
      if (!response.ok) throw new Error(`Erreur: ${response.status}`);
      const data = await response.json();
      setclientdata(data.Data ?? {});

      // ✅ NOUVEAU : Récupérer et stocker la photo du client
      if (data.Data?.profile_picture) {
        setClientProfilePicture(data.Data.profile_picture);
        // console.log("📸 Photo client récupérée:", data.Data.profile_picture);
      } else {
        setClientProfilePicture("");
      }

      return data;
    } catch (error) {
      // console.error("❌ Erreur getprofilclient:", error);
      throw error;
    }
  };

  // ✅ NOUVEAU : Récupérer photo et couleur du véhicule après acceptation
  const getRideAcceptedDetails = async (rideId: any) => {
    try {
      const response = await ridesApi.getRideAcceptedDetails(rideId);
      if (!response.ok) {
        // console.error("❌ Erreur getRideAcceptedDetails:", response.status);
        return;
      }
      const data = await response.json();
      const driver = data.Driver || data.Data || {};

      // ✅ Stocker photo et couleur du véhicule
      if (driver.vehicle_photo) {
        setVehiclePhoto(driver.vehicle_photo);
        // console.log("🚗 Photo véhicule récupérée:", driver.vehicle_photo);
      }
      if (driver.vehicle_color) {
        setVehicleColor(driver.vehicle_color);
        // console.log("🎨 Couleur véhicule:", driver.vehicle_color);
      }
      if (driver.vehicle_model) {
        setVehicleModel(driver.vehicle_model);
      }

      return data;
    } catch (error) {
      // console.error("❌ Erreur getRideAcceptedDetails:", error);
    }
  };

  const getComplete = async () => {
    try {
      const response = await ridesApi.completeRide(idcurrentRef.current);
      if (!response.ok) {
        throw new Error(`Erreur: ${response.status}`);
      }
      let completedRide: any = null;
      try {
        completedRide = await response.json();
      } catch {}

      const endTime = completedRide?.ride?.timestamps?.end_time;
      const tripMinutes = completedRide?.ride?.duration?.trip_minutes;

      if (endTime) {
        const date = new Date(endTime);
        const lang = (await AsyncStorage.getItem("language")) || "fr";
        const locale = lang === "fr" ? "fr-FR" : "en-GB";
        const formatted =
          date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) +
          " " + (lang === "fr" ? "à" : "at") + " " +
          date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
        setdateclientcourse(formatted);
      } else if (!dateclientcourse) {
        setdateclientcourse("—");
      }

      setRideCompleteDuration(
        tripMinutes !== undefined && tripMinutes !== null ? Math.round(tripMinutes) : null
      );
      navigationActiveRef.current = false;
      clearUnlockTimer();
      isCameraLockedRef.current = false;
      setIsCameraLocked(false);
      setCurrentRideStatus("");
      setmodalprendredepo(false);
      stopSpeech();
      setCompleteToastVisible(true);
      Animated.sequence([
        Animated.timing(completeToastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(completeToastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setCompleteToastVisible(false));
      const lang = await AsyncStorage.getItem("language") || "fr";
      const thankMsg = lang === "fr"
        ? "Merci d'utiliser Toya pour vos déplacements, à bientôt"
        : "Thank you for using Toya for your travels, see you soon";
      await speak(thankMsg, 1);
      driverHeadingRef.current = 0;
      setDriverHeading(0);
      setVisiblepolyline(false);
      setallPoints([]);
      // Reset caméra APRÈS le montage de la vue d'ensemble
      setTimeout(() => {
        const lat = latchauffeurRef.current;
        const lon = lonchauffeurRef.current;
        if (lat && lon) {
          mapRef.current?.animateCamera(
            { center: { latitude: lat, longitude: lon }, heading: 0, pitch: 0, zoom: MAP_OVERVIEW_ZOOM },
            { duration: 600 }
          );
        }
      }, 800);
      lastTrimSegIdxRef.current = -1;
      snappedPosRef.current = null;

      // ✅ Réinitialiser les infos véhicule et photo client pour la prochaine course
      setClientProfilePicture("");
      setVehiclePhoto("");
      setVehicleColor("");
      setVehicleModel("");
      setRideCompleteDuration(null);
      setRidePricing(null);
      // Fin normale de course : le flag "Aller" n'a plus d'utilité, on le nettoie
      AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
      if (isOnlineRef.current) {
        setTimeout(async () => {
          await searchForClients();
          startSearchInterval();
        }, 3000);
      }
      return completedRide;
    } catch (error) {
      // console.error("Erreur lors de complete:", error);
      throw error;
    }
  };

  const getpickup = async (paramsid: any, pickupLat: number, pickupLon: number) => {
    try {
      const response = await navigationApi.getPickupNavigation(paramsid);
      if (!response.ok) return;
      const data = await response.json();
      setPickUpData(data);
      navigationActiveRef.current = false;
      clearUnlockTimer();
      navigationPhaseRef.current = "pickup";
      lastTrimSegIdxRef.current = -1;
      snappedPosRef.current = null;
      setDestMarkerReady(false);

      const lang = (await AsyncStorage.getItem("language")) || "fr";
      const directionsRes = await getDirections(
        latchauffeurRef.current,
        lonchauffeurRef.current,
        pickupLat,
        pickupLon,
        lang
      );
      if (!directionsRes.ok) { Alert.alert(t("connection_error")); return; }
      const directionsData = await directionsRes.json();
      const routes = directionsData.routes;
      if (!routes?.length) { Alert.alert(t("connection_error")); return; }
      if (!routes[0]?.legs?.[0]?.steps) { Alert.alert(t("connection_error")); return; }
      const steps = routes[0].legs[0].steps;
      setallPoints(decodeStepsToCoordinates(steps));
      setmodalprendredepo(true);
      startPickupNavigation({ Itinerary: [{ legs: [{ steps }] }] });
      setVisiblepolyline(true);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getManeuverIcon = (maneuver: string): { icon: string; bg: string } => {
    switch (maneuver) {
      case "turn-left":         return { icon: "arrow-left-bold",         bg: "#E65100" };
      case "turn-sharp-left":   return { icon: "arrow-bottom-left-bold",  bg: "#B71C1C" };
      case "turn-slight-left":  return { icon: "arrow-top-left-bold",     bg: "#1565C0" };
      case "fork-left":
      case "ramp-left":         return { icon: "arrow-top-left-bold",     bg: "#1565C0" };
      case "turn-right":        return { icon: "arrow-right-bold",        bg: "#E65100" };
      case "turn-sharp-right":  return { icon: "arrow-bottom-right-bold", bg: "#B71C1C" };
      case "turn-slight-right": return { icon: "arrow-top-right-bold",    bg: "#1565C0" };
      case "fork-right":
      case "ramp-right":        return { icon: "arrow-top-right-bold",    bg: "#1565C0" };
      case "uturn-left":        return { icon: "arrow-u-left-top",        bg: "#6A1B9A" };
      case "uturn-right":       return { icon: "arrow-u-right-top",       bg: "#6A1B9A" };
      case "roundabout-left":   return { icon: "rotate-left",             bg: "#00695C" };
      case "roundabout-right":  return { icon: "rotate-right",            bg: "#00695C" };
      case "merge":             return { icon: "merge",                   bg: "#37474F" };
      case "ferry":             return { icon: "ferry",                   bg: "#0277BD" };
      case "straight":
      default:                  return { icon: "arrow-up-bold",           bg: "#7D5FFF" };
    }
  };

  const sendlocalisationdriver = async () => {
    // ✅ Utilise la position déjà suivie par watchPositionAsync (refs toujours à jour)
    const latitude = latchauffeurRef.current;
    const longitude = lonchauffeurRef.current;
    if (!latitude || !longitude) return;
    await reportDriverLocation(latitude, longitude);
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert("Copié !", "Le code de parrainage a été copié dans le presse-papiers.");
  };

  const startride = async () => {
    try {
      const response = await ridesApi.startRide(idcurrentRef.current);
      if (response.ok) {
        await response.text();
        const lang = await AsyncStorage.getItem("language") || "fr";
        const welcomeMsg = lang === "fr"
          ? "Bienvenu sur Toya, nous vous souhaitons un agréable trajet"
          : "Welcome to Toya, we wish you a pleasant journey";
        await speak(welcomeMsg, 1);
        setCurrentRideStatus("in_progress");
        // La course a démarré : le flag "Aller" n'a plus d'utilité, on le nettoie
        AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
        // Le repli du numéro client ne sert qu'à l'étape d'acceptation : on le nettoie
        AsyncStorage.removeItem("clientPhoneCurrentRide").catch(() => {});
        dropoff();
      } else {
        Alert.alert(
          "Erreur serveur",
          "Impossible de démarrer la course (erreur " + response.status + "). Veuillez réessayer.",
          [
            { text: "Annuler", style: "cancel" },
            { text: "Réessayer", onPress: () => startride() },
          ]
        );
      }
    } catch (error) {
      throw error;
    }
  };

  const dropoff = async () => {
    try {
      const lang = (await AsyncStorage.getItem("language")) || "fr";
      const [navResponse, directionsRes] = await Promise.all([
        navigationApi.getDropoffNavigation(idcurrentRef.current),
        getDirections(
          latchauffeurRef.current,
          lonchauffeurRef.current,
          latEndLocationcurent,
          lonEndLocationcurent,
          lang
        ),
      ]);

      if (!navResponse.ok) throw new Error(`Erreur dropoff: ${navResponse.status}`);
      const data = await navResponse.json();
      // Course déjà in_progress : un échec d'itinéraire doit prévenir le chauffeur
      // (sinon return silencieux → carte de nav vide sans explication).
      if (!directionsRes.ok) { Alert.alert(t("connection_error")); return; }
      const directionsData = await directionsRes.json();
      const routes = directionsData.routes;
      if (!routes?.length) { Alert.alert(t("connection_error")); return; }
      if (!routes[0]?.legs?.[0]?.steps) { Alert.alert(t("connection_error")); return; }
      const steps = routes[0].legs[0].steps;
      navigationActiveRef.current = false;
      clearUnlockTimer();
      navigationPhaseRef.current = "dropoff";
      lastTrimSegIdxRef.current = -1;
      snappedPosRef.current = null;
      setDestMarkerReady(false);
      setallPoints(decodeStepsToCoordinates(steps));
      startPickupNavigation({ Itinerary: [{ legs: [{ steps }] }] });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const getInfo = async (retriesLeft = 3) => {
    try {
      const response = await driverApi.getDriverProfile();
      if (!response.ok) throw new Error("Erreur lors de la récupération des données");
      const data = await response.json();
      if (!data?.Data) return;
      setFirstName(data.Data.first_name);
      setLastName(data.Data.last_name);
      setReferalcode(data.Data.referral_code);
      await AsyncStorage.setItem("Info", JSON.stringify(data));

      const id = data.Data.id;
      driverIdRef.current = String(id);
      connectNotificationsSocket(String(id));
    } catch {
      // ✅ Retry borné : couvre la course "juste après login" (jeton/réseau pas prêt)
      // — sans quoi le code de parrainage ET le socket de notifications restent vides
      if (retriesLeft > 0) {
        setTimeout(() => getInfo(retriesLeft - 1), 1500);
      }
    }
  };

  const handleNotificationMessage = async (parsedData: any) => {
    switch (parsedData.notification_type) {
      case "ride_canceled":
        await sendLocalNotification(" Course annulée", parsedData.message || "Le client a annulé la course", { ride_id: parsedData.event_id });
        // Garde d'ID : ne réinitialise l'état de la course active que si le message
        // concerne bien la course en cours (event_id = id de la course). Si event_id
        // est absent, on conserve le comportement antérieur (pas de blocage).
        if (
          parsedData.event_id == null ||
          idcurrentRef.current === "" ||
          String(parsedData.event_id) === String(idcurrentRef.current)
        ) {
          navigationActiveRef.current = false;
          clearUnlockTimer();
          navigationPhaseRef.current = "pickup";
          lastTrimSegIdxRef.current = -1;
          snappedPosRef.current = null;
          stopSpeech();
          setCurrentRideStatus("");
          setmodalprendredepo(false);
          setswitchetpare(true);
          setVisiblepolyline(false);
          setallPoints([]);
          AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
          if (isOnlineRef.current) setTimeout(async () => { await searchForClients(); }, 3000);
        }
        break;
      case "message_received":
        if (String(parsedData.additional_data?.sender_id) !== driverIdRef.current) {
          setHasUnreadMessage(true);
          await sendLocalNotification(" Nouveau message", parsedData.message || "Vous avez reçu un nouveau message du client", {
            from: parsedData.additional_data?.sender_id,
            ride_id: idcurrentRef.current || parsedData.event_id,
            client_id: clientIdcurent || parsedData.additional_data?.sender_id,
          });
        }
        break;
      case "payment_failed":
        await sendLocalNotification("Problème de paiement", parsedData.message || "Le paiement du client a échoué", { ride_id: parsedData.event_id });
        break;
      case "payment_success":
        await sendLocalNotification("Paiement reçu", parsedData.message || "Le paiement a été effectué avec succès", { ride_id: parsedData.event_id });
        break;
      case "support_message_received":
        if (String(parsedData.additional_data?.sender_id) !== driverIdRef.current) {
          await sendLocalNotification(" Message du support", parsedData.message || "Vous avez un message du support", { ticket_id: parsedData.event_id });
        }
        break;
      default:
        if (String(parsedData.additional_data?.sender_id) !== driverIdRef.current) {
          await sendLocalNotification(" Notification", parsedData.message || "Nouvelle notification", parsedData);
        }
        break;
    }
    checkUnreadNotifications();
  };

  const handleRideStatusMessage = (data: any) => {
    switch (data.type) {
      case "connection_established":
        break;
      case "ride_cancelled":
        navigationActiveRef.current = false;
        clearUnlockTimer();
        navigationPhaseRef.current = "pickup";
        lastTrimSegIdxRef.current = -1;
        snappedPosRef.current = null;
        stopSpeech();
        setCurrentRideStatus("");
        setmodalprendredepo(false);
        setswitchetpare(true);
        setVisiblepolyline(false);
        setallPoints([]);
        AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
        setOfferExpiresAt(null);
        Alert.alert("Course annulée", "Le client a annulé la course", [{
          text: "OK", onPress: () => {
            if (isOnlineRef.current) setTimeout(async () => { await searchForClients(); }, 3000);
          }
        }]);
        break;
      case "new_ride_available":
        // #4 — Une offre m'est faite : l'afficher IMMÉDIATEMENT (sans attendre le
        // poll 5 s) + mémoriser l'expiration pour le décompte sur la carte.
        if (data.message?.offer_expires_at) setOfferExpiresAt(data.message.offer_expires_at);
        if (!(modalprendredepoRef.current || navigationActiveRef.current || !isOnlineRef.current)) {
          searchForClients().catch(() => {});
        }
        break;
      default:
        break;
    }
  };

  const { connect: connectNotificationsSocket, reconnectIfNeeded: reconnectNotificationsIfNeeded } =
    useNotificationsSocket({ onMessage: handleNotificationMessage });

  const { connect: connectRideStatusWebSocket, reconnectIfNeeded: reconnectRideStatusIfNeeded } =
    useRideStatusSocket({ onMessage: handleRideStatusMessage });

  // ✅ Récupère la course active depuis l'API et affiche le modal de restauration
  // ✅ Chauffeur confirme "Reprendre" → restaure navigation depuis position actuelle
  const handleRestoreConfirm = async () => {
    setShowRestoreModal(false);
    const ride = restoreRideData;
    if (!ride) return;

    // Restaurer toutes les données de course
    setIdcurent(ride.ride_id);
    await AsyncStorage.setItem("idride", ride.ride_id);
    const nameParts = (ride.client?.full_name || "").split(" ");
    const savedPhone = await AsyncStorage.getItem("clientPhoneCurrentRide").catch(() => null);
    setclientdata({
      first_name: nameParts[0] || "",
      last_name: nameParts.slice(1).join(" ") || "",
      profile_picture: ride.client?.profile_picture,
      phone_number: ride.client?.phone_number ?? savedPhone ?? "",
    });
    setClientProfilePicture(ride.client?.profile_picture || "");
    // ✅ Restaurer le numéro de téléphone du client : la réponse /current-ride
    //    n'expose pas phone_number. On recharge le profil client complet
    //    (prénom/nom/photo + phone_number) pour réactiver le bouton d'appel.
    const restoredClientId =
      ride.client?.id ?? (await AsyncStorage.getItem("idclientcurentride").catch(() => null));
    if (restoredClientId) {
      setClientIdcurent(String(restoredClientId));
      getprofilclient(restoredClientId).catch(() => {});
    }
    setLatStartLocationcurent(ride.pickup?.latitude);
    setLonStartLocationcurent(ride.pickup?.longitude);
    setLatEndLocationcurent(ride.destination?.latitude);
    setLonEndLocationcurent(ride.destination?.longitude);
    setStartLocationcurent(ride.pickup?.location);
    setEndLocationcurent(ride.destination?.location);
    setFinalPricecurent(String(ride.ride_details?.final_price ?? ""));
    setDistancecurent(ride.ride_details?.distance);
    setPrestationcurent(ride.ride_details?.prestation);
    setModeOfPayment(ride.ride_details?.mode_of_payments);
    setswitchetpare(false);
    setmodalprendredepo(true);

    // Reprise basée sur le statut serveur de l'objet course (ride.status), pas un
    // state local potentiellement périmé ; currentRideStatus reste un repli.
    const isPickup = (ride?.status ?? currentRideStatus) === "accepted_by_driver";
    navigationPhaseRef.current = isPickup ? "pickup" : "dropoff";

    if (isPickup) {
      // On regarde si le chauffeur avait déjà cliqué sur "Aller" avant l'interruption.
      const allerClicked = await AsyncStorage.getItem("ride_aller_clicked").catch(() => null);
      if (allerClicked !== "1") {
        // Le chauffeur n'était pas encore parti : on réaffiche l'étape "Aller".
        // L'itinéraire (et vitesse/recentrage/instructions) ne sera tracé qu'au clic.
        setPickupPhase("go");
        setVisiblepolyline(false);
        return;
      }
      // Le chauffeur était déjà en route vers le client : on reprend directement
      // la navigation vers le point de prise en charge.
      setPickupPhase("pickup");
      setVisiblepolyline(true);
    } else {
      // Course déjà démarrée : reprise directe de la navigation vers la destination
      setPickupPhase("dropoff");
      setVisiblepolyline(true);
    }

    // Obtenir la position GPS actuelle du chauffeur
    let origLat = latchauffeurRef.current;
    let origLon = lonchauffeurRef.current;
    if (origLat === 0 || origLon === 0) {
      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
        origLat = location.coords.latitude;
        origLon = location.coords.longitude;
        currentAccuracyRef.current = location.coords.accuracy ?? Infinity;
        latchauffeurRef.current = origLat;
        lonchauffeurRef.current = origLon;
        setlatchauffeur(origLat);
        setlonchauffeur(origLon);
      } catch (e) {
        // console.error("❌ GPS non disponible pour restauration:", e);
        return;
      }
    }

    // Destination = pickup si phase pickup, sinon destination finale
    const destLat = isPickup ? ride.pickup.latitude : ride.destination.latitude;
    const destLon = isPickup ? ride.pickup.longitude : ride.destination.longitude;
    await restoreRoute(latchauffeurRef.current, lonchauffeurRef.current, destLat, destLon);
  };

  // ✅ Chauffeur annule depuis le modal de restauration (statut accepted_by_driver)
  const handleRestoreCancel = async () => {
    setShowRestoreModal(false);
    const ride = restoreRideData;
    if (!ride) return;
    try {
      const response = await ridesApi.cancelRide(ride.ride_id);
      const data = await response.json().catch(() => null);
      if (ride.ride_id) canceledRideIdsRef.current.add(ride.ride_id);
      // console.log("✅ [RESTORE CANCEL] Status:", response.status, "| Réponse:", data);
    } catch (error) {
      // console.error("❌ Erreur annulation restoration:", error);
    }
    setCurrentRideStatus("");
    setRestoreRideData(null);
  };

  // ✅ Chauffeur termine la course depuis le modal de restauration (statut in_progress)
  const handleRestoreComplete = async () => {
    setShowRestoreModal(false);
    const ride = restoreRideData;
    if (!ride) return;
    try {
      const response = await ridesApi.completeRide(ride.ride_id);
      if (response.ok) {
        // console.log("✅ Course terminée depuis modal de restauration");
        // Nettoyage complet d'état, en cohérence avec getComplete()
        setCurrentRideStatus("");
        setRestoreRideData(null);
        setmodalprendredepo(false);
        setVisiblepolyline(false);
        setallPoints([]);
        AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
        setIdcurent("");
        setcomplete(true);
        if (isOnlineRef.current) setTimeout(async () => { await searchForClients(); }, 3000);
      } else {
        // Échec serveur : prévenir le chauffeur (auparavant rien ne se passait)
        Alert.alert(t("connection_error"));
      }
    } catch (error) {
      // console.error("❌ Erreur completion restoration:", error);
    }
  };

  // ✅ Annulation pendant la navigation (phase pickup uniquement)
  const handleCancelRide = () => {
    Alert.alert(
      t("cancel_ride_confirm_title"),
      t("cancel_ride_confirm_message"),
      [
        { text: t("no"), style: "cancel" },
        {
          text: t("cancel_ride_confirm_yes"),
          style: "destructive",
          onPress: async () => {
            const canceledId = idcurrentRef.current;
            await cancelRide(canceledId);
            if (canceledId) canceledRideIdsRef.current.add(canceledId);
            setCurrentRideStatus("");
            setmodalprendredepo(false);
            setswitchetpare(true);
            setVisiblepolyline(false);
            setallPoints([]);
            navigationActiveRef.current = false;
            clearUnlockTimer();
            lastTrimSegIdxRef.current = -1;
            snappedPosRef.current = null;
            stopSpeech();
            setClientProfilePicture("");
            setVehiclePhoto("");
            setVehicleColor("");
            setVehicleModel("");
            // Annulation : nettoyer le flag "Aller" pour repartir propre
            AsyncStorage.removeItem("ride_aller_clicked").catch(() => {});
            if (isOnlineRef.current) setTimeout(async () => { await searchForClients(); }, 3000);
          },
        },
      ]
    );
  };

  const goToNotifications = () => navigation.navigate("Notifications");

  // ✅ Appeler le client (phase pickup uniquement)
  const handleCallClient = () => {
    callPhone(clientdata?.phone_number);
  };

  // ✅ Appeler un numéro de téléphone (client de n'importe quelle course)
  const callPhone = (phone?: string | null) => {
    if (!phone) {
      Alert.alert(t("connection_error"));
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => Alert.alert(t("connection_error")));
  };

  // ✅ Ouvrir le chat avec le client (phase pickup uniquement)
  const handleOpenChat = () => {
    setHasUnreadMessage(false);
    const rootNav = navigation.getParent() ?? navigation;
    rootNav.navigate("chatcontent", {
      paramName: {
        ride_id: idcurrentRef.current,
        driver_id: clientIdcurent,
      },
    });
  };

  const renderRideCard = ({ item, index }: { item: any; index: number }) => {
    return (
    <View style={stylesRequest.rideCard}>
      <View style={stylesRequest.profileSection}>
        <Image
          style={stylesRequest.profileImage}
          source={item.client_details?.profile_picture ? { uri: item.client_details.profile_picture } : require("../assets/images/profile.jpg")}
        />
        <Text style={stylesRequest.profileName} numberOfLines={1} ellipsizeMode="tail">{item.client_details?.first_name} {item.client_details?.last_name}</Text>
      </View>
      <View style={stylesRequest.locationRow}>
        <Icon source="directions" size={20} color="#4CAF50" />
        <Text style={stylesRequest.locationText}>{item.start_location}</Text>
      </View>
      <View style={stylesRequest.separator} />
      <View style={stylesRequest.locationRow}>
        <Icon source="map-marker" size={20} color="#7A42F4" />
        <Text style={stylesRequest.locationText}>{item.end_location}</Text>
      </View>
      <Text style={stylesRequest.infoTitle}>{t("info_title")}</Text>
      <View style={stylesRequest.infoRow}>
        <Text style={stylesRequest.infoLabel}>{t("estimated_price")}</Text>
        <Text style={stylesRequest.infoValue}>{item.final_price} CFA</Text>
      </View>
      <View style={stylesRequest.infoRow}>
        <Text style={stylesRequest.infoLabel}>{t("mode_of_payments")}</Text>
        <Text style={stylesRequest.infoValue}>{item.mode_of_payment_label}</Text>
      </View>
      <View style={stylesRequest.infoRow}>
        <Text style={stylesRequest.infoLabel}>{t("distance")}</Text>
        <Text style={stylesRequest.infoValue}>{item.distance} km</Text>
      </View>
      <View style={stylesRequest.infoRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon source="account-multiple" size={18} color="#7A42F4" />
          <Text style={stylesRequest.infoLabel}>{t("passengers")}</Text>
        </View>
        <Text style={stylesRequest.infoValue}>{item.number_of_passengers ?? 1}</Text>
      </View>
      <OfferCountdown expiresAt={offerExpiresAt} />
      <View style={stylesRequest.buttonsRow}>
        <TouchableOpacity
          style={[stylesRequest.refuseButton, isAccepting && { opacity: 0.5 }]}
          onPress={() => refuseRide(item)}
          disabled={isAccepting}
        >
          <Text style={stylesRequest.refuseText}>{t("decline")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[stylesRequest.acceptButton, isAccepting && { opacity: 0.7 }]}
          onPress={() => acceptRide(item)}
          disabled={isAccepting}
        >
          {isAccepting
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={stylesRequest.acceptText}>{t("accept")}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
    );
  };

  // Handlers STABLES pour onMapReady (identité constante → la MapView n'est pas re-commit
  // à chaque render du home, très fréquent côté chauffeur).
  const onMainMapReady = useCallback(() => {
    setMainMapPadding({ top: 165, right: 5, bottom: -30, left: 0 });
    const lat = latchauffeurRef.current;
    const lon = lonchauffeurRef.current;
    if (!lat || !lon) return;
    setTimeout(() => {
      mapRef.current?.animateCamera(
        { center: { latitude: lat, longitude: lon }, heading: 0, pitch: 0, zoom: MAP_OVERVIEW_ZOOM },
        { duration: 400 }
      );
    }, 300);
  }, []);
  const onNavMapReady = useCallback(() => {
    setNavMapPadding({ top: 0, right: 0, bottom: -30, left: 0 });
    setNavMapReady(true);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d0521" }}>

      {/* MapView : rendu uniquement quand la position GPS est prête
          (évite que la SurfaceView native Android passe au-dessus de l'overlay GPS) */}
      {isLocationReady && (Visiblepolyline ? (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          key="driver-nav-map"
          style={fullScreenMapStyle}
          showsUserLocation={false}
          followsUserLocation={false}
          showsMyLocationButton={false}
          rotateEnabled={true}
          scrollEnabled={true}
          zoomEnabled={true}
          onPanDrag={unlockCamera}
          showsBuildings={true}
          showsPointsOfInterest={true}
          showsTraffic={true}
          customMapStyle={mapStyle}
          maxZoomLevel={20}
          mapPadding={navMapPadding}
          initialCamera={{
            center: { latitude: latchauffeurRef.current || 3.848, longitude: lonchauffeurRef.current || 11.502 },
            heading: driverHeadingRef.current,
            pitch: 30,
            zoom: 19,
          }}
          onMapReady={onNavMapReady}
          onMapLoadingError={NOOP}
        >
          {navMapReady && allPoints.length > 1 && (
            <>
              <Polyline
                coordinates={allPoints}
                strokeColor="#4A2FCC"
                strokeWidth={16}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                coordinates={allPoints}
                strokeColor="#7D5FFF"
                strokeWidth={11}
                lineCap="round"
                lineJoin="round"
              />
              <Marker
                coordinate={{
                  latitude: navigationPhaseRef.current === "pickup" ? latStartLocationcurent : latEndLocationcurent,
                  longitude: navigationPhaseRef.current === "pickup" ? lonStartLocationcurent : lonEndLocationcurent,
                }}
                anchor={{ x: 0.5, y: 1 }}
                tracksViewChanges={!destMarkerReady}
              >
                <View
                  style={[
                    styles.destinationMarker,
                    { backgroundColor: navigationPhaseRef.current === "pickup" ? "#22C55E" : "#F97316" }
                  ]}
                  onLayout={() => setDestMarkerReady(true)}
                >
                  <Text style={styles.destinationMarkerText}>
                    {navigationPhaseRef.current === "pickup" ? "👤" : "🏁"}
                  </Text>
                </View>
              </Marker>
            </>
          )}
          {latchauffeur !== 0 && lonchauffeur !== 0 && (
            <MarkerAnimated
              coordinate={driverMarkerCoord as any}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              rotation={driverHeading}
            >
              <View style={styles.driverMarker}>
                <View style={styles.driverMarkerInner} />
              </View>
            </MarkerAnimated>
          )}
        </MapView>
      ) : (
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          key="driver-main-map"
          style={fullScreenMapStyle}
          showsUserLocation={true}
          onUserLocationChange={NOOP}
          followsUserLocation={false}
          showsMyLocationButton={false}
          rotateEnabled={false}
          showsBuildings={true}
          showsPointsOfInterest={true}
          showsTraffic={true}
          customMapStyle={mapStyle}
          maxZoomLevel={20}
          mapPadding={mainMapPadding}
          initialRegion={initialRegion || undefined}
          onMapLoadingError={NOOP}
          onMapReady={onMainMapReady}
        >
          {/* ZONES CHAUDES : Heatmap — nuage de densité, fusion automatique des zones proches */}
          {isOnline && hotZones.length > 0 && (
            <Heatmap
              points={hotZonesToHeatmapPoints(hotZones)}
              radius={50}
              opacity={0.75}
              gradient={{
                colors: ["transparent", "#E8D5FF", "#B57AE0", "#8A2BE2"],
                startPoints: [0.0, 0.25, 0.6, 1.0],
                colorMapSize: 256,
              }}
            />
          )}
        </MapView>
      ))}

      {/* ZONES CHAUDES : badge indicateur */}
      {isOnline && hotZones.length > 0 && switchetpare && (
        <View style={styles.hotZoneBadge}>
          <Text style={styles.hotZoneBadgeText}>🔥 Zones actives</Text>
        </View>
      )}

      <View style={styles.topViewLeft}>
        {switchetpare && (
          <Switch
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isOnline ? Colors.light.tint : "#f4f3f4"}
            ios_backgroundColor="#3e3e3e"
            onValueChange={toggleSwitch}
            value={isOnline}
          />
        )}
      </View>

      {isOnline && switchetpare && (
        <View style={styles.onlineIndicator}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>{t("online_status") || "En ligne"}</Text>
        </View>
      )}

      {/* ===== MÉTÉO — hors navigation : à gauche, niveau zones chaudes ===== */}
      {isLocationReady && !Visiblepolyline && (
        <View style={styles.weatherBadgeLeft}>
          <WeatherWidget weather={weather} />
        </View>
      )}

      {/* ===== MÉTÉO — en navigation : au-dessus du bouton vitesse ===== */}
      {isLocationReady && Visiblepolyline && (
        <View style={styles.weatherNav}>
          <WeatherWidget weather={weather} />
        </View>
      )}

      {switchetpare && (
        <TouchableOpacity style={styles.topViewRight} activeOpacity={0.7} onPress={showParain}>
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>{t("modalTitleParrain")}</Text>
        </TouchableOpacity>
      )}

      {/* Modal parrain */}
      <Modal animationType="none" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalBackgroundParrain}>
          <Animated.View style={[styles.modalViewParrain, { paddingBottom: 20 + insets.bottom, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.modalTitleViewParrain}>
              <Text style={styles.modalTitleParrain}>{t("modalTitleParrain")}</Text>
            </View>
            <TouchableOpacity onPress={closeModal} style={styles.closeButtonParrain}>
              <Text style={styles.closeButtonTextParrain}>X</Text>
            </TouchableOpacity>
            <View style={styles.modalSubTitleContainerParrain}>
              <Icon source="gift-outline" size={40} />
              <Text style={styles.modalSubTitleParrain}>{t("bonusText")}</Text>
            </View>
            <Text style={styles.modalTextParrain}>{t("millecodereferal")}</Text>
            <Text style={styles.modalTextParrain}>{t("referralCodeLabel")}</Text>
            <View style={styles.modalCopyCodeParrain}>
              <TouchableOpacity activeOpacity={0.7} onPress={handleCopy}>
                <Icon source="content-copy" size={20} color={Colors.light.tint} />
              </TouchableOpacity>
              <Text style={styles.modalCodeParrain}>{referralCode}</Text>
            </View>
            <TouchableOpacity
              style={styles.modalButtonParrain}
              onPress={async () => {
                try {
                  const predefinedMessage = t("sharePromoMessage") + referralCode + t("sharePromoSuffix");
                  await Share.share({ message: predefinedMessage });
                } catch (error) {
                  // console.log("Erreur de partage:", error);
                }
              }}
            >
              <Text style={{ color: "#fff" }}>{t("shareButtonText")}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      {/* Modal liste des courses */}
      <Modal animationType="slide" transparent={true} statusBarTranslucent={true} visible={isRequetteclient} onRequestClose={closeRequetteclient}>
        <View style={stylesRequest.modalOverlay}>
          <View style={stylesRequest.scrollContainer}>
            <View style={stylesRequest.header}>
              <Text style={stylesRequest.headerTitle}>
                {availableRides.length} course{availableRides.length > 1 ? 's' : ''} disponible{availableRides.length > 1 ? 's' : ''}
              </Text>
              <TouchableOpacity onPress={closeRequetteclient} style={stylesRequest.closeButtonTop}>
                <Text style={stylesRequest.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableRides}
              renderItem={renderRideCard}
              keyExtractor={(item, index) => `${item.id}-${index}`}
              contentContainerStyle={stylesRequest.listContent}
              showsVerticalScrollIndicator={true}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshingRides}
                  onRefresh={async () => {
                    if (isSearchingRef.current) return;
                    isSearchingRef.current = true;
                    setIsRefreshingRides(true);
                    try {
                      await getAllrides();
                    } finally {
                      setIsRefreshingRides(false);
                      isSearchingRef.current = false;
                    }
                  }}
                  tintColor={Colors.light.tint}
                  colors={[Colors.light.tint]}
                />
              }
            />
          </View>
        </View>
      </Modal>

      {/* Modal course terminée */}
      <Modal animationType="none" transparent={true} visible={iscomplete} onRequestClose={closecomplete}>
        <View style={stylesRequest.modalOverlay}>
          <View style={stylesRequest.card}>
            <TouchableOpacity onPress={closecomplete} style={stylesRequest.closeButton}>
              <Text style={stylesRequest.closeButtonText}>X</Text>
            </TouchableOpacity>

            {/* ✅ NOUVEAU : Photo client avec vraie photo API */}
            <View style={stylesRequest.profileSection}>
              <Image
                style={stylesRequest.profileImage}
                source={
                  clientProfilePicture
                    ? { uri: clientProfilePicture }
                    : clientdata.profile_picture
                    ? { uri: clientdata.profile_picture }
                    : require("../assets/images/profile.jpg")
                }
              />
              <Text style={stylesRequest.profileName} numberOfLines={1} ellipsizeMode="tail">{clientdata.first_name} {clientdata.last_name}</Text>
            </View>


            <View style={stylesRequest.locationRow}>
              <Icon source="directions" size={20} color="#4CAF50" />
              <Text style={stylesRequest.locationText}>{startLocationcurent}</Text>
            </View>
            <View style={stylesRequest.locationRow}>
              <Icon source="map-marker" size={20} color="#7A42F4" />
              <Text style={stylesRequest.locationText}>{endLocationcuerent}</Text>
            </View>
            <Text style={stylesRequest.infoTitle}>{t("info_title")}</Text>
            <View style={stylesRequest.infoRow}>
              <Text style={stylesRequest.infoLabel}>{t("final_price")}</Text>
              <Text style={stylesRequest.infoValue}>{finalPricecurent} CFA</Text>
            </View>
            <View style={stylesRequest.infoRow}>
              <Text style={stylesRequest.infoLabel}>{t("mode_of_payments")}</Text>
              <Text style={stylesRequest.infoValue}>{mode_of_payments}</Text>
            </View>
            <View style={stylesRequest.infoRow}>
              <Text style={stylesRequest.infoLabel}>{t("distance")}</Text>
              <Text style={stylesRequest.infoValue}>{distancecurent} km</Text>
            </View>
            {rideCompleteDuration !== null && (
              <View style={stylesRequest.infoRow}>
                <Text style={stylesRequest.infoLabel}>{t("duration")}</Text>
                <Text style={stylesRequest.infoValue}>{rideCompleteDuration} min</Text>
              </View>
            )}
            <View style={stylesRequest.infoRow}>
              <Text style={stylesRequest.infoLabel}>Date</Text>
              <Text style={stylesRequest.infoValue}>{dateclientcourse || "—"}</Text>
            </View>
            <View style={styles.boutton}>
              <TouchableOpacity style={[styles.closeInfo, { marginTop: "10%" }]} onPress={closecomplete}>
                <Text style={{ color: "white" }}>{t("validate")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {modalprendredepo && (
        <View style={acceptedCardAnchor.background}>
          <View style={acceptedCardAnchor.container}>

            {/* Bande de prix — visible dès l'acceptation */}
            {ridePricing && (
              <View style={styles.pricingRowChauffeur}>
                <View style={styles.pricingItemChauffeur}>
                  <Text style={styles.pricingLabelChauffeur}>{t("gross_price_label")}</Text>
                  <Text style={styles.pricingValueChauffeur}>
                    {Number(ridePricing.gross_price).toLocaleString("fr-FR")} CFA
                  </Text>
                </View>
                <View style={styles.pricingDividerChauffeur} />
                <View style={styles.pricingItemChauffeur}>
                  <Text style={styles.pricingLabelChauffeur}>{t("client_pays_label")}</Text>
                  <Text style={[styles.pricingValueChauffeur, ridePricing.discount_type && { color: "#FF9800" }]}>
                    {Number(ridePricing.final_price).toLocaleString("fr-FR")} CFA
                  </Text>
                </View>
                <View style={styles.pricingDividerChauffeur} />
                <View style={styles.pricingItemChauffeur}>
                  <Text style={styles.pricingLabelChauffeur}>{t("net_earning_label")}</Text>
                  <Text style={[styles.pricingValueChauffeur, { color: "#22c55e" }]}>
                    {Number(ridePricing.net_earning).toLocaleString("fr-FR")} CFA
                  </Text>
                </View>
                <View style={styles.commissionDetailChauffeur}>
                  <Text style={styles.commissionDetailTextChauffeur}>
                    {ridePricing.grade_name} · {t("commission")} {ridePricing.commission_rate}% : {Number(ridePricing.commission_amount).toLocaleString("fr-FR")} CFA
                  </Text>
                </View>
                {ridePricing.discount_type && (
                  <View style={styles.discountBadgeChauffeur}>
                    <Icon source="tag" size={11} color="white" />
                    <Text style={styles.discountBadgeTextChauffeur}>
                      {ridePricing.discount_type === "promo"
                        ? `${ridePricing.promo_code} −${ridePricing.discount_percentage}%`
                        : `${t("referral_badge")} −${ridePricing.discount_percentage}%`}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.rowContainerChauffeur}>

              <TouchableOpacity style={[styles.dropButtonChauffeur, { flex: 1, alignItems: "center" }]} onPress={handlePress}>
                <Text style={styles.dropButtonTextChauffeur}>{textdepoouprendre}</Text>
              </TouchableOpacity>
              {currentRideStatus === "accepted_by_driver" && (
                <TouchableOpacity style={styles.cancelRideButton} onPress={handleCancelRide}>
                  <Icon source="close-circle" size={22} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}

      {modalprendredepo && isRecalculating && (
        <View style={styles.recalculatingBanner}>
          <Text style={styles.recalculatingText}>🔄 Recalcul de l'itinéraire...</Text>
        </View>
      )}

      {modalprendredepo && isWaitingForGPS && !isRecalculating && (
        <View style={[styles.recalculatingBanner, { backgroundColor: "#1565C0" }]}>
          <Text style={styles.recalculatingText}>📡 GPS en cours de calibration...</Text>
        </View>
      )}

      {modalprendredepo && Visiblepolyline && (
        <View style={styles.modalnavigation}>
          <View style={styles.modalContainerdepo}>
            <View style={styles.userInfodepo}>
              <View style={[styles.maneuverArrowContainer, { backgroundColor: getManeuverIcon(currentManeuver).bg }]}>
                <Icon source={getManeuverIcon(currentManeuver).icon} size={30} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.navInfoRow}>
                  <Text style={[styles.dropButtonText, styles.dropButton]}>{value}m</Text>
                </View>
                <Text style={styles.userNamedepo}>{html}</Text>
              </View>
              <TouchableOpacity
                onPress={toggleSpeech}
                style={[styles.speechToggle, !isSpeechEnabled && styles.speechToggleDisabled]}
              >
                <Icon source={isSpeechEnabled ? "volume-high" : "volume-off"} size={24} color={isSpeechEnabled ? Colors.light.tint : "#999"} />
                {isSpeaking && <View style={styles.speakingIndicator} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <Modal animationType="slide" transparent={true} visible={modalVisiblecourse} onRequestClose={() => setModalVisiblecourse(false)}>
        <View style={styles.modalCont}>
          <View style={styles.modalConten}>
            <Text style={styles.modalTexte}>{t("no_rides")}</Text>
            <View style={styles.modalButtons}>
              <Button title={t("close")} onPress={() => setModalVisiblecourse(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="slide" transparent={true} visible={modalerreur} onRequestClose={() => setModalerreur(false)}>
        <View style={styles.modalCont}>
          <View style={styles.modalConten}>
            <Text style={styles.modalTexte}>{t("unsufisant")}</Text>
            <View style={styles.modalButtons}>
              <Button title={t("close")} onPress={() => setModalerreur(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <RestoreRideModal
        visible={showRestoreModal && currentRideStatus === "accepted_by_driver" && !modalprendredepo}
        phase="pickup"
        rideData={restoreRideData}
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
        onClose={() => setShowRestoreModal(false)}
      />

      <RestoreRideModal
        visible={showRestoreModal && currentRideStatus === "in_progress" && !modalprendredepo}
        phase="in_progress"
        rideData={restoreRideData}
        onConfirm={handleRestoreConfirm}
        onComplete={handleRestoreComplete}
        onClose={() => setShowRestoreModal(false)}
      />

      {!isRequetteclient && !iscomplete && !modalinfoVisible && !modalVisiblecourse && !modalprendredepo && !modalerreur && !Visiblepolyline && (
        <>
          <TouchableOpacity
            style={styles.recenterButton}
            activeOpacity={0.7}
            onPress={() => {
              const lat = latchauffeurRef.current;
              const lon = lonchauffeurRef.current;
              if (lat && lon) {
                mapRef.current?.animateToRegion({
                  latitude: lat,
                  longitude: lon,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 800);
              }
            }}
          >
            <Icon source="crosshairs-gps" size={28} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton} activeOpacity={0.7} onPress={goToNotifications}>
            <Icon source="bell" size={28} color="white" />
            {hasUnreadNotifications && <View style={styles.notificationDot} />}
          </TouchableOpacity>
        </>
      )}

      {/* Menu gauche : photo+nom client, appel (haut) + chat (bas) — uniquement avant le début de la course */}
      {modalprendredepo && currentRideStatus === "accepted_by_driver" && (
        <>
          <View style={styles.clientInfoLeft}>
            <Image
              style={styles.clientInfoLeftPhoto}
              source={
                clientProfilePicture
                  ? { uri: clientProfilePicture }
                  : clientdata.profile_picture
                  ? { uri: clientdata.profile_picture }
                  : require("../assets/images/profile.jpg")
              }
            />
            <Text style={styles.clientInfoLeftName} numberOfLines={1} ellipsizeMode="tail">
              {clientdata.first_name} {clientdata.last_name}
            </Text>
          </View>
          <TouchableOpacity style={styles.callClientButton} activeOpacity={0.8} onPress={handleCallClient}>
            <Icon source="phone" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatClientButton} activeOpacity={0.8} onPress={handleOpenChat}>
            <Icon source="message-text" size={22} color="white" />
            {hasUnreadMessage && <View style={styles.messageBadgeDot} />}
          </TouchableOpacity>
        </>
      )}

      {Visiblepolyline && (
        <View style={styles.speedFloating}>
          <Icon source="speedometer" size={14} color="white" />
          <Text style={styles.etaBadgeText}>{driverSpeedKmh} km/h</Text>
        </View>
      )}

      {Visiblepolyline && remainingSeconds > 0 && (
        <View style={styles.etaFloating}>
          <Icon source="clock-outline" size={14} color="white" />
          <Text style={styles.etaBadgeText}>{formatRemainingTime(remainingSeconds)}</Text>
        </View>
      )}

      {Visiblepolyline && (
        <TouchableOpacity
          style={styles.recenterButton}
          activeOpacity={0.7}
          onPress={recenterAndLockCamera}
        >
          <Icon source="crosshairs-gps" size={28} color="white" />
        </TouchableOpacity>
      )}

      <Toast
        visible={cancelToastVisible}
        opacity={cancelToastOpacity}
        text={t("ride_canceled_success")}
        variant="cancel"
      />
      <Toast
        visible={acceptToastVisible}
        opacity={acceptToastOpacity}
        text={t("ride_accepted_success")}
        variant="accept"
      />
      <Toast
        visible={completeToastVisible}
        opacity={completeToastOpacity}
        text={t("ride_complete_success")}
        variant="complete"
      />

      <GPSWaitingLoader visible={!isLocationReady} />

      {/* P3/P4 : bandeau non-bloquant — services loc. coupés ou GPS faible (mode dégradé) */}
      {isLocationReady && (
        <GpsStatusBanner
          servicesEnabled={servicesEnabled}
          lowAccuracy={lowAccuracy}
          onOpenSettings={openLocationSettings}
        />
      )}
      </SafeAreaView>
  );
}

const stylesRequest = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center" },
  // ✅ Largeur explicite (90% écran, plafonnée pour tablette) → rendu identique quel que
  // soit l'appareil ; sans ça la largeur était dictée par le contenu (instable). overflow
  // hidden pour que la FlatList respecte le borderRadius.
  scrollContainer: { width: "90%", maxWidth: 480, alignSelf: "center", backgroundColor: "white", borderRadius: 20, maxHeight: "85%", paddingTop: 20, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: "#e0e0e0" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: Colors.light.tint },
  closeButtonTop: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f0f0f0", justifyContent: "center", alignItems: "center" },
  listContent: { padding: 15 },
  rideCard: { backgroundColor: "white", borderRadius: 15, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: "#e0e0e0", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  card: { width: "85%", backgroundColor: "white", borderRadius: 20, padding: 20, alignItems: "center" },
  closeButton: { position: "absolute", top: 15, right: 15, zIndex: 1, backgroundColor: Colors.light.tint, borderRadius: 20, width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  closeButtonText: { fontSize: 16, color: "white", fontWeight: "bold" },
  profileSection: { flexDirection: "row", alignItems: "center", marginBottom: 20, alignSelf: "stretch" },
  profileImage: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: "#8D4DE8" },
  profileName: { fontWeight: "bold", marginLeft: 12, fontSize: 16, color: "#000", flex: 1 },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, alignSelf: "flex-start" },
  locationText: { marginLeft: 10, fontWeight: "500", color: "#000", fontSize: 14, lineHeight: 20, flex: 1 },
  separator: { width: "80%", height: 1, backgroundColor: "#e0e0e0", marginVertical: 8 },
  infoTitle: { marginTop: 20, fontWeight: "bold", fontSize: 15, alignSelf: "flex-start" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 10 },
  infoLabel: { fontSize: 14, color: "#333" },
  infoValue: { fontSize: 14, fontWeight: "600", color: "#000" },
  buttonsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 25, width: "100%", gap: 10 },
  acceptButton: { flex: 1, backgroundColor: "#7A42F4", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  acceptText: { color: "white", fontWeight: "bold" },
  refuseButton: { flex: 1, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E53935", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  refuseText: { color: "#E53935", fontWeight: "bold" },
  declineButton: { flex: 1, borderWidth: 1, borderColor: "#ccc", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  declineText: { color: "#333", fontWeight: "bold" },

  // ✅ NOUVEAU : Styles véhicule dans modal course terminée
  vehicleSection: {
    width: "100%",
    marginBottom: 12,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  vehicleImage: {
    width: "100%",
    height: 120,
    borderRadius: 10,
  },
  vehicleInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#f9f9f9",
  },
  vehicleModelText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
  },
  vehicleColorBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vehicleColorDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    marginRight: 5,
  },
  vehicleColorLabel: {
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },
  vehicleColorOnlyRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
});

const styles = StyleSheet.create({
  modalnavigation: { position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 100 },
  modalContainerdepo: { width: "90%", backgroundColor: "white", borderRadius: 20, padding: 15, elevation: 5 },
  userInfodepo: { flexDirection: "row", alignItems: "center", gap: 12 },
  maneuverArrowContainer: { width: 52, height: 52, borderRadius: 14, justifyContent: "center", alignItems: "center", overflow: "hidden" },
  recalculatingBanner: { position: "absolute", top: 60, left: 20, right: 20, backgroundColor: "#FF8C00", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", zIndex: 999, elevation: 10 },
  recalculatingText: { color: "white", fontWeight: "bold", fontSize: 15 },
  dropButton: { backgroundColor: "#2196F3", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  dropButtonText: { color: "white", fontWeight: "600", fontSize: 14 },
  navInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  speedBadge: { fontSize: 13, fontWeight: "700", color: Colors.light.tint, backgroundColor: "#EEE9FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  destinationMarker: { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  destinationMarkerText: { fontSize: 18 },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  etaBadgeText: { color: "white", fontSize: 14, fontWeight: "700", letterSpacing: 0.2 },
  driverMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  driverMarkerInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#1976D2",
  },
  userNamedepo: { fontSize: 16, fontWeight: "bold", color: "#333", flexShrink: 1, flex: 1, flexWrap: "wrap" },
  modalBackgroundChauffeur: { alignItems: "center" },
  modalContainerdepoChauffeur: { width: "98%", borderRadius: 20, paddingLeft: 20, paddingRight: 20, alignItems: "center" },
  rowContainerChauffeur: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, width: "100%" },
  profileImageChauffeur: { width: 40, height: 40, borderRadius: 20, marginRight: 8 },
  userNamedepoChauffeur: { fontSize: 16, fontWeight: "500" },
  dropButtonChauffeur: { backgroundColor: "#7D5FFF", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginRight: 12 },
  dropButtonTextChauffeur: { color: "white", fontWeight: "600" },
  messageButtonChauffeur: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "#000", justifyContent: "center", alignItems: "center" },
  messageBadgeDot: { position: "absolute", top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: "#e53935", borderWidth: 1.5, borderColor: "#fff" },
  // Menu gauche pendant la phase pickup : photo+nom client, appel (haut) + chat (bas)
  clientInfoLeft: { position: "absolute", bottom: 304, left: 16, width: 120, alignItems: "center", backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 18, paddingVertical: 10, paddingHorizontal: 8, elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 5, zIndex: 200 },
  clientInfoLeftPhoto: { width: 68, height: 68, borderRadius: 34, marginBottom: 6 },
  clientInfoLeftName: { fontSize: 13, fontWeight: "700", color: "#222", textAlign: "center" },
  callClientButton: { position: "absolute", bottom: 236, left: 25, width: 48, height: 48, borderRadius: 24, backgroundColor: "#22c55e", justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, zIndex: 200 },
  chatClientButton: { position: "absolute", bottom: 236, left: 85, width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.light.tint, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, zIndex: 200 },
  modalCont: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalConten: { width: "80%", backgroundColor: "#fff", borderRadius: 10, padding: 20, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  modalTexte: { fontSize: 18, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  modalButtons: { alignItems: "center" },
  textButtonAddCredit: { color: "#fff", fontSize: 16 },
  headerContent: { flex: 1, alignItems: "center", marginTop: 25 },
  boutton: { marginTop: "10%", justifyContent: "center", alignItems: "center", flexDirection: "row" },
  closeInfo: { width: "40%", borderRadius: 10, marginHorizontal: 15, paddingVertical: 20, backgroundColor: Colors.light.tint, alignItems: "center" },
  refuser: { width: "40%", borderRadius: 10, borderWidth: 2, borderColor: Colors.light.tint, marginHorizontal: 15, paddingVertical: 20, alignItems: "center" },
  enteterequest: { alignItems: "center", top: -5 },
  infoContent: { marginTop: "3%", flexDirection: "row", alignItems: "center" },
  headerImage: { borderWidth: 5, borderColor: Colors.light.tint, alignItems: "center", marginTop: "-5%", width: 90, height: 90, borderRadius: 100 },
  departdestination: { flexDirection: "row", opacity: 0.6 },
  separator: { height: 1, opacity: 0.5, backgroundColor: "black" },
  container: { flex: 1 },
  modalAddCreditContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalAddCreditContent: { width: "80%", backgroundColor: "white", borderRadius: 10, padding: 20, alignItems: "center" },
  buttonAddCredit: { marginBottom: 60, borderRadius: 10, marginHorizontal: 15, paddingVertical: 20, backgroundColor: Colors.light.tint, alignItems: "center" },
  topViewLeft: { position: "absolute", top: 58, left: 25, backgroundColor: "white", borderRadius: 10 },
  topViewRight: { flexDirection: "row", position: "absolute", top: 60, right: 25, borderRadius: 5, justifyContent: "center", alignItems: "center", paddingHorizontal: 5, paddingVertical: 10, backgroundColor: Colors.light.tint },
  onlineIndicator: { position: "absolute", top: 58, left: 80, flexDirection: "row", alignItems: "center", backgroundColor: "#4CAF50", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, elevation: 3 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "white", marginRight: 6 },
  onlineText: { color: "white", fontSize: 14, fontWeight: "600" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: { padding: 20, backgroundColor: "white", borderRadius: 20, alignItems: "center" },
  modalTitle: { width: 250, marginVertical: 10, paddingVertical: 10, fontSize: 25, fontWeight: "bold" },
  modalText: { width: 250, fontSize: 15, fontWeight: "300" },
  modalButton: { width: 250, borderRadius: 25, marginHorizontal: 5, marginVertical: 10, paddingVertical: 10, backgroundColor: Colors.light.tint, alignItems: "center" },
  modalButtonText: { color: "#fff", fontSize: 16 },
  modalBackgroundParrain: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalViewParrain: { height: 600, backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitleViewParrain: { alignItems: "center" },
  modalTitleParrain: { fontSize: 20, fontWeight: "bold", color: Colors.light.tint },
  closeButtonParrain: { position: "absolute", top: 10, right: 10, backgroundColor: Colors.light.tint, borderRadius: 20, padding: 10 },
  closeButtonTextParrain: { fontSize: 18, fontWeight: "bold", color: "white" },
  modalSubTitleContainerParrain: { marginHorizontal: 5, flexDirection: "row", marginVertical: 25, alignItems: "center" },
  iconSubTitleParrain: { color: Colors.light.tint },
  modalSubTitleParrain: { marginHorizontal: 10, fontSize: 25, fontWeight: "bold", color: Colors.light.tint },
  modalTextParrain: { marginVertical: 10, fontSize: 18, textAlign: "left", marginHorizontal: 5 },
  modalCopyCodeParrain: { flexDirection: "row", alignItems: "center", marginHorizontal: 5 },
  modalCodeParrain: { fontSize: 18, fontWeight: "bold", marginHorizontal: 10 },
  modalButtonParrain: { marginTop: 75, borderRadius: 10, marginHorizontal: 5, paddingVertical: 20, backgroundColor: Colors.light.tint, alignItems: "center" },
  modalButtonTextParrain: { color: "#fff", fontSize: 16 },
  userInfo: { alignItems: "center", marginBottom: 20 },
  userPhoto: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: "#6200EE", marginBottom: 10 },
  userName: { fontSize: 18, fontWeight: "bold" },
  userAddress: { fontSize: 14, color: "#666" },
  details: { marginBottom: 20, width: "100%" },
  detailText: { fontSize: 14, marginVertical: 2 },
  boldText: { fontWeight: "bold" },
  actions: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  acceptBtn: { backgroundColor: "#6200EE", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  acceptBtnText: { color: "#fff", fontWeight: "bold" },
  refuseBtn: { borderColor: "#6200EE", borderWidth: 2, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 10 },
  refuseBtnText: { color: "#6200EE", fontWeight: "bold" },
  openButton: { backgroundColor: "#6b63ff", padding: 10, borderRadius: 5 },
  openButtonText: { color: "white", fontWeight: "bold" },
  modalBackground: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  profileImage: { width: 60, height: 60, borderRadius: 30, resizeMode: "cover" },
  rowContainer: { flexDirection: "row", alignItems: "center" },
  messageButton: { backgroundColor: "#f1f1f1", padding: 8, borderRadius: 50, justifyContent: "center", alignItems: "center" },
  chatIcon: { padding: 10, borderRadius: 25, backgroundColor: "#e6e6e6" },
  closeButton: { marginTop: 20, padding: 10, backgroundColor: "#ccc", borderRadius: 5 },
  closeButtonText: { color: "black", fontWeight: "bold" },
  buttonContainer: { position: "absolute", bottom: 20, left: "50%", transform: [{ translateX: -50 }], backgroundColor: "white", borderRadius: 10, padding: 5, elevation: 5 },

  // ✅ NOUVEAU : Bouton recentrer position
  locationButton: {
    position: "absolute",
    bottom: 220,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.tint,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },

  notificationButton: { position: "absolute", bottom: 135, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.light.tint, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  recenterButton: { position: "absolute", bottom: 229, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.light.tint, justifyContent: "center", alignItems: "center", elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  etaFloating: { position: "absolute", bottom: 299, right: 22, width: 68, flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.tint, paddingVertical: 10, borderRadius: 8, gap: 4, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  speedFloating: { position: "absolute", bottom: 360, right: 22, width: 75, flexDirection: "row", justifyContent: "center", alignItems: "center", backgroundColor: Colors.light.tint, paddingVertical: 13, borderRadius: 8, gap: 4, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  cancelRideButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#e53935", justifyContent: "center", alignItems: "center", marginHorizontal: 4 },
  pricingRowChauffeur: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", alignSelf: "stretch", paddingHorizontal: 10, paddingVertical: 10, marginBottom: 30, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#e0e0e0", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  pricingItemChauffeur: { flex: 1, alignItems: "center" },
  pricingLabelChauffeur: { fontSize: 9, color: "#555", fontWeight: "700", textTransform: "uppercase", marginBottom: 2 },
  pricingValueChauffeur: { fontSize: 12, fontWeight: "900", color: "#111" },
  pricingDividerChauffeur: { width: 1, height: 28, backgroundColor: "#e0e0e0" },
  commissionDetailChauffeur: { position: "absolute", left: 10, bottom: -22, backgroundColor: "#F7F4FD", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  commissionDetailTextChauffeur: { fontSize: 10, color: "#5B3A9E", fontWeight: "700" },
  discountBadgeChauffeur: { flexDirection: "row", gap: 4, backgroundColor: "#FF9800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignItems: "center", marginLeft: 8 },
  discountBadgeTextChauffeur: { fontSize: 10, color: "white", fontWeight: "600" },

  // ✅ Styles zones chaudes
  hotZoneToggleButton: {
    position: "absolute",
    bottom: 310,
    right: 25,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.tint,
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  hotZoneToggleActive: {
    backgroundColor: Colors.light.tint,
  },
  weatherBadgeLeft: {
    position: "absolute",
    top: 108,
    left: 25,
    zIndex: 5,
  },
  weatherNav: {
    position: "absolute",
    bottom: 420,   // juste au-dessus du bouton vitesse (bottom 360)
    right: 22,
    zIndex: 5,
    alignItems: "flex-end",
  },
  hotZoneBadge: {
    position: "absolute",
    top: 108,
    right: 25,
    backgroundColor: "rgba(94, 26, 156, 0.85)",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  hotZoneBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  notificationDot: { position: "absolute", top: 8, right: 8, backgroundColor: "red", borderRadius: 6, width: 12, height: 12, borderWidth: 2, borderColor: "white" },
  speechToggle: { padding: 10, marginLeft: 10, borderRadius: 8, backgroundColor: "#f0f0f0", position: "relative" },
  speechToggleDisabled: { backgroundColor: "#e0e0e0" },
  speakingIndicator: { position: "absolute", top: 5, right: 5, backgroundColor: "#4CAF50", borderRadius: 4, width: 8, height: 8, borderWidth: 1, borderColor: "white" },

  // ✅ NOUVEAU : Styles couleur véhicule dans barre du bas
  vehicleColorBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  vehicleColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    marginRight: 5,
  },
  vehicleColorText: {
    fontSize: 11,
    color: "#666",
  },
});
