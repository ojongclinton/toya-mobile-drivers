import { useState, useEffect, useRef } from "react";

const CACHE_DURATION = 60 * 60 * 1000; // 1 heure

export interface WeatherAlert {
  headline: string;
  severity: string;   // "Extreme" | "Severe" | "Moderate" | "Minor"
  emoji: string;
  detail?: string;
}

export interface WeatherData {
  temperature: number;
  conditionType: string;
  conditionText: string;
  emoji: string;
  alerts: WeatherAlert[];
}

// Génère nos propres alertes à partir des données Google (sans dépendre des
// autorités officielles, peu couvrantes au Cameroun).
function deriveAlerts(conditionType: string, temperature: number): WeatherAlert[] {
  const t = (conditionType || "").toUpperCase();
  const out: WeatherAlert[] = [];
  if (t.includes("THUNDERSTORM")) {
    out.push({ emoji: "⛈️", severity: "Severe", headline: "Orage en cours", detail: "Risque d'éclairs et de fortes rafales — prudence sur la route." });
  } else if (t.includes("HEAVY_RAIN")) {
    out.push({ emoji: "🌧️", severity: "Severe", headline: "Pluie intense", detail: "Visibilité réduite et routes glissantes — ralentissez." });
  } else if (t.includes("RAIN") || t.includes("DRIZZLE")) {
    out.push({ emoji: "🌦️", severity: "Moderate", headline: "Pluie", detail: "Chaussée mouillée — adaptez votre conduite." });
  }
  if (t.includes("FOG") || t.includes("HAZE")) {
    out.push({ emoji: "🌫️", severity: "Moderate", headline: "Brouillard / visibilité réduite", detail: "Allumez les feux et gardez vos distances." });
  }
  if (temperature >= 38) {
    out.push({ emoji: "🌡️", severity: "Moderate", headline: `Forte chaleur (${temperature}°)`, detail: "Pensez à vous hydrater." });
  }
  return out;
}

function officialAlertEmoji(eventType: string): string {
  const e = (eventType || "").toUpperCase();
  if (e.includes("FLOOD")) return "🌊";
  if (e.includes("TORNADO") || e.includes("STORM") || e.includes("HURRICANE")) return "🌀";
  if (e.includes("RAIN") || e.includes("PRECIP")) return "🌧️";
  if (e.includes("HEAT")) return "🌡️";
  if (e.includes("WIND")) return "💨";
  return "⚠️";
}

// ── Alerte ANTICIPÉE (chauffeur) : pluie/orage à venir dans les prochaines heures ──
// À partir des prévisions horaires Google, on prévient avant que ça tombe.
function buildForecastAlert(forecastHours: any[], currentType: string): WeatherAlert | null {
  if (!Array.isArray(forecastHours) || forecastHours.length === 0) return null;
  const nowType = (currentType || "").toUpperCase();
  const rainingNow = nowType.includes("RAIN") || nowType.includes("THUNDERSTORM") || nowType.includes("DRIZZLE");
  if (rainingNow) return null; // il pleut déjà → l'alerte "actuelle" suffit

  const now = Date.now();
  for (const h of forecastHours) {
    const type = (h?.weatherCondition?.type || "").toUpperCase();
    const prob = h?.precipitation?.probability?.percent ?? 0;
    const isWet = type.includes("THUNDERSTORM") || type.includes("HEAVY_RAIN") || type.includes("RAIN") || prob >= 60;
    if (!isWet) continue;

    const start = new Date(h?.interval?.startTime).getTime();
    if (isNaN(start)) continue;
    const minutes = Math.round((start - now) / 60000);
    if (minutes <= 5) continue;      // quasi immédiat → couvert par l'alerte actuelle
    if (minutes > 180) return null;  // au-delà de 3h : trop loin pour alerter

    const heure = new Date(start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const isStorm = type.includes("THUNDERSTORM");
    return {
      emoji: isStorm ? "⛈️" : "🌧️",
      severity: isStorm ? "Severe" : "Moderate",
      headline: `${isStorm ? "Orage" : "Pluie"} attendu vers ${heure}`,
      detail: `Dans environ ${minutes} min — anticipez (hausse de la demande, prudence).`,
    };
  }
  return null;
}

const weatherCache = new Map<string, { data: WeatherData; timestamp: number }>();

const CONDITION_EMOJI: Record<string, string> = {
  CLEAR: "☀️",
  MOSTLY_CLEAR: "🌤️",
  PARTLY_CLOUDY: "⛅",
  MOSTLY_CLOUDY: "🌥️",
  CLOUDY: "☁️",
  WINDY: "💨",
  FOGGY: "🌫️",
  HAZE: "🌫️",
  DRIZZLE: "🌦️",
  LIGHT_RAIN: "🌦️",
  LIGHT_RAIN_SHOWERS: "🌦️",
  RAIN: "🌧️",
  HEAVY_RAIN: "🌧️",
  RAIN_SHOWERS: "🌧️",
  HEAVY_RAIN_SHOWERS: "🌧️",
  THUNDERSTORM: "⛈️",
  LIGHT_THUNDERSTORM_RAIN: "⛈️",
  THUNDERSTORM_RAIN: "⛈️",
  HEAVY_THUNDERSTORM_RAIN: "⛈️",
};

function roundedKey(lat: number, lon: number): string {
  return `${Math.round(lat * 10) / 10}_${Math.round(lon * 10) / 10}`;
}

function toEmoji(type: string): string {
  return CONDITION_EMOJI[type] ?? "🌡️";
}

export function useWeather(
  lat: number | null | undefined,
  lon: number | null | undefined,
  apiKey: string | undefined
): WeatherData | null {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!lat || !lon || !apiKey) return;

    const key = roundedKey(lat, lon);
    const cached = weatherCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setWeather(cached.data);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const base = "https://weather.googleapis.com/v1";
    const params = `location.latitude=${lat}&location.longitude=${lon}&key=${apiKey}&languageCode=fr`;

    Promise.all([
      fetch(`${base}/currentConditions:lookup?${params}`, { signal: controller.signal }).then((r) => r.json()),
      fetch(`${base}/publicAlerts:lookup?${params}`, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ weatherAlerts: [] })),
      // Prévisions horaires (alerte anticipée, chauffeur uniquement)
      fetch(`${base}/forecast/hours:lookup?${params}&hours=4`, { signal: controller.signal })
        .then((r) => r.json())
        .catch(() => ({ forecastHours: [] })),
    ])
      .then(([condResp, alertResp, forecastResp]) => {
        // L'API renvoie les champs à la RACINE (pas sous "currentConditions").
        if (condResp?.error) {
          console.warn("[Weather] API error:", condResp.error.code, condResp.error.message);
          return;
        }
        if (!condResp?.weatherCondition && condResp?.temperature == null) {
          console.warn("[Weather] réponse inattendue:", JSON.stringify(condResp).slice(0, 200));
          return;
        }

        const type: string = condResp.weatherCondition?.type ?? "CLEAR";
        const temperature = Math.round(condResp.temperature?.degrees ?? 0);

        const officialAlerts: WeatherAlert[] = (alertResp?.weatherAlerts ?? []).map((a: any) => ({
          headline: a.alertTitle ?? a.description ?? "Alerte météo",
          severity: a.severity ?? "Severe",
          emoji: officialAlertEmoji(a.eventType),
          detail: a.instruction ?? a.description ?? undefined,
        }));

        // Alerte anticipée (pluie/orage à venir) à partir des prévisions horaires.
        const forecastAlert = buildForecastAlert(forecastResp?.forecastHours, type);

        const data: WeatherData = {
          temperature,
          conditionType: type,
          conditionText: condResp.weatherCondition?.description?.text ?? "",
          emoji: toEmoji(type),
          alerts: [
            ...officialAlerts,
            ...deriveAlerts(type, temperature),
            ...(forecastAlert ? [forecastAlert] : []),
          ],
        };

        weatherCache.set(key, { data, timestamp: Date.now() });
        setWeather(data);
      })
      .catch((e) => { if (e?.name !== "AbortError") console.warn("[Weather] fetch échec:", e?.message); });

    return () => {
      controller.abort();
    };
  }, [lat, lon, apiKey]);

  return weather;
}
