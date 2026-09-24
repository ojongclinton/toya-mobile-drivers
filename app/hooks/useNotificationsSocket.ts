import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Params = {
  onMessage: (data: any) => void;
};

const NOTIF_WS_URL_BASE = "wss://toya-backend-production.up.railway.app/ws/notifications/";
// const NOTIF_WS_URL_BASE = "wss://pre-prod.toya-vtc.com/ws/notifications/";
const MAX_RECONNECT_DELAY_MS = 30000;
const PING_INTERVAL_MS = 30000;

export const useNotificationsSocket = ({ onMessage }: Params) => {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);
  const isIntentionalCloseRef = useRef(false);
  const isConnectingRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const driverIdRef = useRef<string | null>(null);

  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = async (driverId: string) => {
    if (isConnectingRef.current && driverIdRef.current === driverId) {
      return;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && driverIdRef.current === driverId) {
      return;
    }
    isConnectingRef.current = true;
    driverIdRef.current = driverId;

    const token = await AsyncStorage.getItem("authToken");
    if (!token) {
      isConnectingRef.current = false;
      return;
    }

    const url = `${NOTIF_WS_URL_BASE}${driverId}/?token=${token}`;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      isIntentionalCloseRef.current = true;
      wsRef.current.close();
    }
    isIntentionalCloseRef.current = false;
    if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      isConnectingRef.current = false;
      attemptsRef.current = 0;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      onMessageRef.current(parsed);
    };

    ws.onerror = () => {
      isConnectingRef.current = false;
    };

    ws.onclose = (event) => {
      isConnectingRef.current = false;
      if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
      if (isIntentionalCloseRef.current) return;
      const attempts = attemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempts), MAX_RECONNECT_DELAY_MS);
      attemptsRef.current = attempts + 1;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        if (driverIdRef.current) connect(driverIdRef.current);
      }, delay);
    };
  };

  const reconnectIfNeeded = () => {
    if (
      (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) &&
      driverIdRef.current
    ) {
      connect(driverIdRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) { clearInterval(pingIntervalRef.current); pingIntervalRef.current = null; }
      isIntentionalCloseRef.current = true;
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
    };
  }, []);

  return { connect, reconnectIfNeeded };
};
