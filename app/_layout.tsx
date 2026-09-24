import { TabBarIcon } from "@/components/navigation/TabBarIcon";
import { Colors } from "@/constants/Colors";
import { NavigationContainer, CommonActions } from "@react-navigation/native";
import { navigationRef } from "./services/navigationService";
import SuspendedScreen from "./profiles/SuspendedScreen";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Session from "./checksession";
import Index from "./index";
import Signup from "./signup";
import Profil from "./profil";
import Chat from "./chat";
import Home from "./home";
import Wallet from "./wallet";
import Historical from "./historical";
import DriverProfile from "./profiles/driver_profile";
import Verification from "@/app/profiles/verification";
import UserProfile from "./profiles/user_profile";
import Chatcontent from "./chatcontent";
import { useTranslation } from "react-i18next";
import Forgot from "./forgot";
import Validatiopot from "./validationopt";
import Parrainage from "./profiles/parrainage";
import { useSafeAreaInsets, SafeAreaProvider } from "react-native-safe-area-context";
import { PaperProvider } from "react-native-paper";
import { useFonts } from "expo-font";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import React, { useEffect, useState, useRef } from 'react';
import { Alert, Platform, LogBox, Animated, Image, View, Text, StyleSheet, useWindowDimensions, Dimensions, AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from "expo-splash-screen";
import * as Location from "expo-location";
import i18n from "./translation";
import { StatusBar } from 'expo-status-bar';
import MyStatistics from "./profiles/MyStatistics";
import MyGrades from "./profiles/MyGrades";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../constants/api/BASE_URL";
import messaging from '@react-native-firebase/messaging';
import { NavigationIndependentTree } from '@react-navigation/native';

import {
  getFCMToken,
  onTokenRefresh,
  onMessageReceived,
  getInitialNotification,
  onNotificationOpenedApp,
  syncFcmToken,
} from './services/notifications';
import * as Notifications from "expo-notifications";

LogBox.ignoreLogs([
  'This method is deprecated',
  'Please use `getApp()` instead',
  'migrating-to-v22',
  'is missing the required default export',
  'SafeAreaView has been deprecated',
]);

import NotificationsScreen from "./Notifications";

SplashScreen.preventAutoHideAsync();

const netStyles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 55 : 35,
    left: 20,
    right: 20,
    zIndex: 9999,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  toastText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  },
});
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Hauteur typique d'une barre de navigation Android quand insets.bottom est
// sous-évalué par l'OEM (barre 3 boutons ≈ 48dp, gestuelle ≈ 24dp). On prend la
// valeur 3 boutons pour garantir qu'aucun élément ne reste sous la nav bar.
const ANDROID_NAV_FALLBACK = 48;

// Inset bas "sûr" et robuste face aux OEM (Transsion/HiOS, etc.) qui dessinent en
// edge-to-edge mais reportent parfois insets.bottom = 0.
//  - Si le système réserve déjà l'espace des barres (NON edge-to-edge), screen.height
//    > window.height → on n'ajoute rien (insets.bottom ≈ 0, aucun trou créé).
//  - Si on est edge-to-edge (screen ≈ window) et que insets.bottom est sous-évalué,
//    on applique un plancher de secours pour ne jamais chevaucher la nav bar.
function useSafeBottomInset(): number {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  if (Platform.OS !== "android") return insets.bottom;
  const screenHeight = Dimensions.get("screen").height;
  const systemReservesBars = screenHeight - windowHeight > 8; // tolérance arrondis
  const isEdgeToEdge = !systemReservesBars;
  if (isEdgeToEdge && insets.bottom < ANDROID_NAV_FALLBACK) {
    return Math.max(insets.bottom, ANDROID_NAV_FALLBACK);
  }
  return insets.bottom;
}

function MainTabs() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  // ✅ Inset bas robuste : gère l'edge-to-edge (Android 15 / targetSdk 35) ET les OEM
  // qui sous-évaluent insets.bottom (Transsion/HiOS) sans créer de trou ailleurs.
  const bottomInset = useSafeBottomInset();

  const baseHeight = isTablet ? 100 : 80;
  const totalHeight = baseHeight + bottomInset;
  const iconSize = isTablet ? 36 : 28;
  const labelSize = isTablet ? 16 : 14;
  const labelMarginBottom = isTablet ? 14 : 10;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: Colors.light.tint,
        headerShown: false,
        tabBarStyle: {
          height: totalHeight,
          paddingTop: isTablet ? 12 : 7,
          paddingBottom: bottomInset + (isTablet ? 16 : 10),
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          borderLeftWidth: 0.2,
          borderRightWidth: 0.2,
          position: "absolute",
          overflow: "hidden",
        },
      })}
      initialRouteName="home"
    >
      <Tab.Screen
        name="profile_menu"
        component={ProfileTab}
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "account-circle" : "account-circle-outline"}
              color={color}
              size={iconSize}
            />
          ),
          tabBarLabelStyle: {
            fontSize: labelSize,
            marginBottom: labelMarginBottom,
          },
        }}
      />
      <Tab.Screen
        name="chat"
        component={ChatAll}
        options={{
          title: t("chat"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "comment" : "comment-outline"}
              color={color}
              size={iconSize}
            />
          ),
          tabBarLabelStyle: {
            fontSize: labelSize,
            marginBottom: labelMarginBottom,
          },
        }}
      />
      <Tab.Screen
        name="home"
        component={Home}
        options={{
          title: t("conduire"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name={focused ? "car" : "car-outline"} color={color} size={iconSize} />
          ),
          tabBarLabelStyle: {
            fontSize: labelSize,
            marginBottom: labelMarginBottom,
          },
        }}
      />
      <Tab.Screen
        name="wallettab"
        component={WalletTab}
        options={{
          title: t("wallet"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "wallet" : "wallet-outline"}
              color={color}
              size={iconSize}
            />
          ),
          tabBarLabelStyle: {
            fontSize: labelSize,
            marginBottom: labelMarginBottom,
          },
        }}
      />
      <Tab.Screen
        name="historical"
        component={Historical}
        options={{
          title: t("historical"),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? "clock" : "clock-outline"}
              color={color}
              size={iconSize}
            />
          ),
          tabBarLabelStyle: {
            fontSize: labelSize,
            marginBottom: labelMarginBottom,
          },
        }}
      />
    </Tab.Navigator>
  );
}

function ProfileTab() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="profile">
      <Stack.Screen
        name="profile"
        component={Profil}
        options={{
          title: t("profile"),
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function WalletTab() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="wallet">
      <Stack.Screen
        name="wallet"
        component={Wallet}
        options={{
          title: t("wallet"),
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

function ChatAll() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator initialRouteName="chatcommence">
      <Stack.Screen
        name="chatcommence"
        component={Chat}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  const { t } = useTranslation();
  return (
    <Stack.Navigator screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
      }} initialRouteName="checkSession">
      <Stack.Screen
        name="checkSession"
        component={Session}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="index"
        component={Index}
        options={{ headerShown: false, contentStyle: { backgroundColor: "white" } }}
      />
      <Stack.Screen
        name="forgot"
        component={Forgot}
        options={{ headerShown: false, contentStyle: { backgroundColor: "white" } }}
      />
      <Stack.Screen
        name="signup"
        component={Signup}
        options={{ headerShown: false, contentStyle: { backgroundColor: "white" } }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      {/* <Stack.Screen
        name="driver_profile"
        component={DriverProfile}
        options={{
          title: "Mes Statistiques",
          headerStyle: {
            backgroundColor: "#ffffff",
          },
          headerShadowVisible: false,
          headerTitleAlign: "center",
        }}
      /> */}
      <Stack.Screen
        name="MyGrades"
        component={MyGrades}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MyStatistics"
        component={MyStatistics}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="user_profile"
        component={UserProfile}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="verification"
        component={Verification}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="parrainage"
        component={Parrainage}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="chatcommenceDirect"
        component={Chat}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="chatcontent"
        component={Chatcontent}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="validation"
        component={Validatiopot}
        options={{
          title: t("validation"),
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SuspendedScreen"
        component={SuspendedScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ✅ COMPOSANT PRINCIPAL
export default function App() {
  const [fontsLoaded] = useFonts(MaterialCommunityIcons.font);
  const [splashVisible, setSplashVisible] = useState(true);
  const splashOpacity = useRef(new Animated.Value(1)).current;

  const [netStatus, setNetStatus] = useState<"offline" | "restored" | null>(null);
  const netToastOpacity = useRef(new Animated.Value(0)).current;
  const netToastY = useRef(new Animated.Value(-60)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstNetCheck = useRef(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const connected = state.isConnected && state.isInternetReachable !== false;
      if (isFirstNetCheck.current) {
        isFirstNetCheck.current = false;
        if (connected) return;
      }
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setNetStatus(connected ? "restored" : "offline");
      Animated.parallel([
        Animated.timing(netToastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(netToastY, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      if (connected) {
        hideTimerRef.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(netToastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(netToastY, { toValue: -60, duration: 300, useNativeDriver: true }),
          ]).start(() => setNetStatus(null));
        }, 2000);
      }
    });
    return () => { unsub(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, []);

  const hideSplash = () => {
    Animated.timing(splashOpacity, {
      toValue: 0,
      duration: 600,
      useNativeDriver: true,
    }).start(() => setSplashVisible(false));
  };

  const handleNavigationReady = async () => {
    try {
      // ✅ Petite pause pour que le splash JS (logo.png) soit peint avant de cacher le natif
      await new Promise((resolve) => setTimeout(resolve, 100));
      await SplashScreen.hideAsync();
      const savedLanguage = await AsyncStorage.getItem("language");
      if (savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }

      // Demande la permission de géolocalisation pendant le splash
      try {
        const { status } = await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise<{ status: string }>((resolve) =>
            setTimeout(() => resolve({ status: 'undetermined' }), 5000)
          ),
        ]);
        if (status === 'granted') {
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
            .then(loc => AsyncStorage.setItem('lastKnownPosition', JSON.stringify({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            }))).catch(() => {});
        }
      } catch (_) {}

      const token = await AsyncStorage.getItem("authToken");
      const suspended = await AsyncStorage.getItem("accountSuspended");
      await new Promise((resolve) => setTimeout(resolve, 2500));
      if (token) {
        // Si le flag de suspension est présent, forcer le re-login pour vérifier
        // l'état réel du compte (la suspension a pu être levée entre-temps)
        const target = suspended === "true" ? "index" : "MainTabs";
        navigationRef.dispatch(CommonActions.reset({ index: 0, routes: [{ name: target }] }));
      }
    } catch {
      // silently ignore
    } finally {
      hideSplash();
    }
  };

  const [fcmToken, setFcmToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeFCM();

    // Écouter les nouveaux messages
    const unsubscribeMessage = onMessageReceived(remoteMessage => {
      Alert.alert(
        '📩 Nouvelle notification',
        remoteMessage.notification?.body || 'Message reçu'
      );
    });

    // Écouter les clics sur notifications Firebase (app en arrière-plan)
    const unsubscribeNotificationOpened = onNotificationOpenedApp(remoteMessage => {
      // console.log('👆 Notification Firebase cliquée:', remoteMessage);
    });

    // Écouter les taps sur les notifications locales (Expo) — navigation vers le chat
    const localNotifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.ride_id && data?.client_id) {
        if (!navigationRef.isReady()) return;
        navigationRef.dispatch(
          CommonActions.navigate("chatcontent", {
            paramName: {
              ride_id: data.ride_id,
              driver_id: data.client_id,
            },
          })
        );
      }
    });

    // Écouter le rafraîchissement du token (rare) → ré-enregistrement
    const unsubscribeTokenRefresh = onTokenRefresh(async (newToken) => {
      setFcmToken(newToken);
      await syncFcmToken();
    });

    // Rattrapage : à chaque retour au premier plan, on (re)synchronise le token.
    // Couvre les sessions où l'utilisateur s'est connecté après le démarrage,
    // ainsi que les changements de permission notifications.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncFcmToken();
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeNotificationOpened();
      unsubscribeTokenRefresh();
      localNotifSub.remove();
      appStateSub.remove();
    };
  }, []);

  const initializeFCM = async () => {
    // Configuration du canal Android
    if (Platform.OS === 'android') {
      try {
        await messaging().setDefaultChannel({
          id: 'default',
          name: 'Notifications',
          importance: 4,
          sound: 'default',
          vibration: true,
        });
      } catch {
        // silently ignore
      }
    }

    try {
      await getInitialNotification();
    } catch {
      // silently ignore
    }

    // Enregistrer le token FCM si l'utilisateur est déjà connecté
    try {
      const authToken = await AsyncStorage.getItem('authToken');
      if (authToken) {
        const token = await getFCMToken();
        if (token) {
          await updateFCMTokenOnBackend(token, authToken);
        }
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const updateFCMTokenOnBackend = async (fcmToken, authToken) => {
    try {
      await fetch(BASE_URL + "/firebase/register-device/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          fcm_token: fcmToken,
          device_type: Platform.OS,
        }),
      });
    } catch {
      // silently ignore
    }
  };

  return (
    <SafeAreaProvider>
      <PaperProvider>
      <View style={{ flex: 1, backgroundColor: "#0d0521" }}>
        <NavigationIndependentTree>
          <StatusBar style="dark" backgroundColor="transparent" translucent={true} />
          <NavigationContainer ref={navigationRef} onReady={handleNavigationReady}>
            <AppNavigator />
          </NavigationContainer>
        </NavigationIndependentTree>
        {netStatus !== null && (
          <Animated.View
            style={[
              netStyles.toast,
              { opacity: netToastOpacity, transform: [{ translateY: netToastY }] },
              { backgroundColor: netStatus === "offline" ? "#e53935" : "#22C55E" },
            ]}
            pointerEvents="none"
          >
            <Text style={netStyles.toastText}>
              {netStatus === "offline" ? "Pas de connexion internet" : "Connexion rétablie"}
            </Text>
          </Animated.View>
        )}

        {splashVisible && (
          <Animated.View
            style={{
              position: "absolute",
              top: 0, left: 0, right: 0, bottom: 0,
              opacity: splashOpacity,
            }}
            pointerEvents="none"
          >
            <Image
              source={require("../assets/images/logo.png")}
              style={{ flex: 1, width: "100%", height: "100%" }}
              resizeMode="cover"
            />
          </Animated.View>
        )}
      </View>
      </PaperProvider>
    </SafeAreaProvider>
  );
}