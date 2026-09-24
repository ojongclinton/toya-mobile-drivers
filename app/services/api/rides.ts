import { apiFetch } from "./http";

export const getPendingRides = async (): Promise<Response> => {
  return apiFetch("/rides/driver/pending", { method: "GET" });
};

export const acceptRide = async (rideId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/${rideId}/accept`, { method: "POST" });
};

export const cancelRide = async (rideId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/${rideId}/cancel`, { method: "POST" });
};

export const startRide = async (rideId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/${rideId}/start`, { method: "GET" });
};

export const completeRide = async (rideId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/${rideId}/complete`, { method: "GET" });
};

export const getClientProfile = async (clientId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/profile/${clientId}`, { method: "GET" });
};

export const getRideAcceptedDetails = async (rideId: string | number): Promise<Response> => {
  return apiFetch(`/rides/driver/${rideId}/accepted/`, { method: "GET" });
};

export const getCurrentRide = async (): Promise<Response> => {
  return apiFetch("/rides/driver/current-ride", { method: "GET" });
};
