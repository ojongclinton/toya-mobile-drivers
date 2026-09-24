import * as Location from "expo-location";
import * as navigationApi from "./api/navigation";

export const reportDriverLocation = async (
  latitude: number,
  longitude: number
): Promise<void> => {
  let formattedAddress = "";
  try {
    const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    const address = reverseGeocode[0];
    if (address) {
      formattedAddress = `${address.city || ""}, ${address.country || ""}`.trim().replace(/^,\s*/, "");
    }
  } catch {
    // Pas de réseau ou service indisponible → on envoie la position sans adresse
  }

  if (!formattedAddress) {
    formattedAddress = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }

  try {
    await navigationApi.sendDriverLocation(latitude, longitude, formattedAddress);
  } catch {
    // silently ignore
  }
};
