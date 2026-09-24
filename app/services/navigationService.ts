import { createNavigationContainerRef, CommonActions } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const navigationRef = createNavigationContainerRef();

let _handling401 = false;

// Vide tout le stockage local (token, profil, course en cours, etc.) en conservant
// uniquement la langue d'interface, pour repartir d'une session propre.
async function clearSessionStorage() {
  try {
    const language = await AsyncStorage.getItem("language");
    await AsyncStorage.clear();
    if (language) await AsyncStorage.setItem("language", language);
  } catch {
    // Échec de nettoyage non bloquant : on revient quand même au login.
  }
}

export async function resetToLogin() {
  if (!navigationRef.isReady() || _handling401) return;
  const currentRoute = navigationRef.getCurrentRoute();
  const safeRoutes = ["index", "signup", "forgot", "SuspendedScreen", "verification", "chatcommenceDirect", "chatcontent"];
  if (safeRoutes.includes(currentRoute?.name ?? "")) return;
  _handling401 = true;
  // Session invalide (401) → on vide les données stockées PUIS on revient au login.
  // Purge attendue (await) : sur appareils bas de gamme, AsyncStorage.clear() est lent ;
  // sans await, le token périmé pouvait traîner et redéclencher un 401 sur signup/forgot.
  // L'accès à l'inscription / mot de passe oublié reste possible depuis le login.
  await clearSessionStorage();
  navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "index" }] }));
  setTimeout(() => { _handling401 = false; }, 8000);
}
