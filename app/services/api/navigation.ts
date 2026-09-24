import { apiFetch, getLanguage } from "./http";

export const getHotZones = async (): Promise<Response> => {
  return apiFetch("/navigation/hot-zones?city_wide=true", { method: "GET" });
};

export const getPickupNavigation = async (rideId: string | number): Promise<Response> => {
  const lang = await getLanguage();
  return apiFetch(`/navigation/pickup/${rideId}?lang=${lang}`, { method: "GET" });
};

export const getDropoffNavigation = async (rideId: string | number): Promise<Response> => {
  const lang = await getLanguage();
  return apiFetch(`/navigation/dropoff/${rideId}?lang=${lang}`, { method: "GET" });
};

export const sendDriverLocation = async (
  lat: number,
  lon: number,
  address: string
): Promise<Response> => {
  return apiFetch("/navigation/send-driver-location", {
    method: "POST",
    body: { lat, lon, address },
  });
};
