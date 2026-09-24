import { apiFetch } from "./http";

export const getDriverProfile = async (): Promise<Response> => {
  return apiFetch("/drivers/profile/", { method: "GET" });
};

export const getVehicleValidation = async (): Promise<Response> => {
  return apiFetch("/drivers/vehicle/validation_status", { method: "GET" });
};

export const getWalletHistory = async (): Promise<Response> => {
  return apiFetch("/payments/wallet/history", { method: "GET" });
};

export const updateAvailability = async (available: boolean): Promise<Response> => {
  return apiFetch("/drivers/update_availability/", {
    method: "POST",
    body: { available },
  });
};
