import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CHANNEL_ID = "default";

export const configureNotificationHandler = (): void => {
  if (Platform.OS === "android") {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Notifications",
      importance: Notifications.AndroidImportance.MAX,
      // Pas de `sound` : un canal sans son explicite utilise le son système par défaut.
      // Une chaîne ici serait traitée comme un fichier son custom (erreur "Custom sound not found").
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
    });
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const title = notification.request.content.title || "";
      const isInChat = (global as any).isInChatContent === true;
      if (
        isInChat &&
        (title.includes("message") ||
          title.includes("Message") ||
          title.includes("support") ||
          title.includes("Support"))
      ) {
        return { shouldShowAlert: false, shouldPlaySound: false, shouldSetBadge: false };
      }
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
};

export const sendLocalNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch {}
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
};
