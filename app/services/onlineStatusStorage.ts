import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "isDriverOnline";

export const saveOnlineStatus = async (status: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(status));
  } catch {}
};

export const loadOnlineStatus = async (): Promise<boolean> => {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved !== null) return JSON.parse(saved);
    return false;
  } catch {
    return false;
  }
};
