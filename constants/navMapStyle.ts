// Styles de carte "navigation" type Waze pour Google Maps (react-native-maps).
// Objectif : mettre les ROUTES en avant (fond sobre, autoroutes contrastées,
// noms de rues forcés) TOUT EN CONSERVANT lieux/POI, icônes et bâtiments.
// Deux variantes — claire et sombre — sélectionnées selon le thème système
// du téléphone via getNavMapStyle(useColorScheme()).

// ─────────────────────────── CLAIR ───────────────────────────
export const navMapStyleLight = [
  { elementType: "geometry", stylers: [{ color: "#eef1f6" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4a4f59" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#cfe8cf" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a7d5a" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road", elementType: "labels.text", stylers: [{ visibility: "on" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#4a4f59" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },

  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.local", elementType: "labels.text", stylers: [{ visibility: "on" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },

  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#d4d8e0" }] },

  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#ffd34e" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#f0a500" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#7a5a00" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#ffbf00" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#e09400" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#a7d4f2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3f7aa0" }] },
];

// ─────────────────────────── SOMBRE ───────────────────────────
export const navMapStyleDark = [
  { elementType: "geometry", stylers: [{ color: "#1d2c4d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9fb0cc" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a2238" }] },

  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0e3b2e" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#4f8a72" }] },

  { featureType: "road", elementType: "geometry", stylers: [{ color: "#39507e" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road", elementType: "labels.text", stylers: [{ visibility: "on" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#d6deec" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#1d2c4d" }] },

  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#2e4068" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "on" }] },
  { featureType: "road.local", elementType: "labels.text", stylers: [{ visibility: "on" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#aab9d6" }] },

  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#39507e" }] },

  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#caa84a" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#8a6d1f" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#b88a2f" }] },

  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4e6d8c" }] },
];

// Sélecteur selon le thème système. Accepte un type large (ColorSchemeName de RN
// peut valoir 'light' | 'dark' | 'unspecified' | null) : tout sauf 'dark' → clair.
export const getNavMapStyle = (scheme: string | null | undefined) =>
  scheme === "dark" ? navMapStyleDark : navMapStyleLight;

export default navMapStyleLight;
