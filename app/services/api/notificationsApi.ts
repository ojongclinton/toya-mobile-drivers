import { apiFetch } from "./http";

export const getAllNotifications = async (): Promise<Response> => {
  return apiFetch("/notifications/all", { method: "GET" });
};
