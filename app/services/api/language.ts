import BASE_URL from "../../../constants/api/BASE_URL";

export const getLanguageFromServer = async (
  deviceId: string
): Promise<string | null> => {
  try {
    const url = `${BASE_URL}/support/language/get?device_id=${encodeURIComponent(deviceId)}`;
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) return null;
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!data) return null;
    return data.language ?? data.Language ?? data.lang ?? null;
  } catch {
    return null;
  }
};

export const setLanguageOnServer = async (
  language: "fr" | "en",
  deviceId: string
): Promise<void> => {
  try {
    const url = `${BASE_URL}/support/language/set`;
    const body = { language, device_id: deviceId };
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {}
};
