import BASE_URL from "./BASE_URL";

// Keep all WebSocket connections on the same environment as the REST API.
// EXPO_PUBLIC_WS_BASE_URL is set per EAS/local build profile. The fallback
// derives a WebSocket origin from EXPO_PUBLIC_BASE_URL for older builds.
const WS_BASE_URL = (
  process.env.EXPO_PUBLIC_WS_BASE_URL ||
  BASE_URL.replace(/^http/, "ws").replace(/\/api\/?$/, "")
).replace(/\/$/, "");

export default WS_BASE_URL;
