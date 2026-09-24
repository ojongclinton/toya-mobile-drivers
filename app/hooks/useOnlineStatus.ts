import { useState, useRef, useEffect } from "react";

type TickCallbacks = {
  onLocationTick: () => Promise<void> | void;
  onSearchTick: () => Promise<void> | void;
};

const LOCATION_INTERVAL_MS = 30000;
// Dispatch séquentiel backend : fenêtre d'offre de 25 s par chauffeur. À 15 s de
// polling, on ratait la moitié de la fenêtre → poll ramené à 5 s pour voir l'offre vite.
const SEARCH_INTERVAL_MS = 5000;

export const useOnlineStatus = (callbacks: TickCallbacks) => {
  const [isOnline, setIsOnline] = useState(false);
  const isOnlineRef = useRef(false);
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const searchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const setOnline = (online: boolean) => {
    isOnlineRef.current = online;
    setIsOnline(online);
  };

  const startLocationInterval = () => {
    if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = setInterval(() => {
      callbacksRef.current.onLocationTick();
    }, LOCATION_INTERVAL_MS);
  };

  const startSearchInterval = () => {
    if (searchIntervalRef.current) clearInterval(searchIntervalRef.current);
    searchIntervalRef.current = setInterval(() => {
      callbacksRef.current.onSearchTick();
    }, SEARCH_INTERVAL_MS);
  };

  const stopSearchInterval = () => {
    if (searchIntervalRef.current) {
      clearInterval(searchIntervalRef.current);
      searchIntervalRef.current = null;
    }
  };

  const stopIntervals = () => {
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
    stopSearchInterval();
  };

  useEffect(() => {
    return () => stopIntervals();
  }, []);

  return {
    isOnline,
    isOnlineRef,
    setOnline,
    startLocationInterval,
    startSearchInterval,
    stopSearchInterval,
    stopIntervals,
  };
};
