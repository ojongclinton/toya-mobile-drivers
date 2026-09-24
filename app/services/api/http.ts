import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../../../constants/api/BASE_URL";
import { resetToLogin } from "../navigationService";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiFetchOptions = {
  method?: Method;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = await AsyncStorage.getItem("authToken");
  return {
    "Content-Type": "application/json",
    Authorization: "Bearer " + token,
  };
};

export const apiFetch = async (
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> => {
  const { method = "GET", body, headers, signal } = options;
  const authHeaders = await getAuthHeaders();
  const response = await fetch(BASE_URL + path, {
    method,
    headers: { ...authHeaders, ...(headers || {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (response.status === 401) {
    const token = await AsyncStorage.getItem("authToken");
    const suspended = await AsyncStorage.getItem("accountSuspended");
    if (token && suspended !== "true") resetToLogin();
  }

  return response;
};

export const getLanguage = async (): Promise<string> => {
  return (await AsyncStorage.getItem("language")) || "fr";
};
