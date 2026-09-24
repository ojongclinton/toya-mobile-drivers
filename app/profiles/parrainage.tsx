import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

export default function Parrainage({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  const [modalValid, setModalValid] = useState(false);
  const [modalInvalid, setModalInvalid] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [code, setCode] = useState("");
  const [userInfo, setUserInfo] = useState<any>(null);

  const slideAnim = useRef(new Animated.Value(300)).current;

  const fetchUserData = async () => {
    try {
      const storedData = await AsyncStorage.getItem("Info");
      if (storedData) {
        const parsed = JSON.parse(storedData);
        setUserInfo(parsed);
      }
    } catch {
      // silently ignore
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const applyReferralCode = async (referralCode: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/referrals/drivers/apply`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invite_referral_code: referralCode }),
      });

      const text = await response.text();
      const data = JSON.parse(text);

      if (!response.ok) {
        const isAlreadyReferred = data?.Message?.includes("duplicate key") || data?.Message?.includes("already exists");
        setErrorMessage(isAlreadyReferred ? t("already_referred") : (data?.Message?.includes("propre code") || data?.Message?.includes("own") ? data.Message : t("invalid_code")));
        setModalInvalid(true);
      } else {
        setModalValid(true);
      }
      return data;
    } catch {
      setModalInvalid(true);
    }
  };

  const [isAddCredit, setIsAddCredit] = useState(false);
  useEffect(() => {
    if (isAddCredit) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isAddCredit]);

  // 🖱️ Validation du code
  const handleValidateCode = () => {
    if (code.trim() === "") {
      setErrorMessage(t("enter_referral_code") || "Veuillez insérer un code de parrainage.");
      setModalInvalid(true);
      return;
    }
    applyReferralCode(code);
  };

  const styles = createStyles(width, height);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t("sponsorship")}</Text>
        <View style={styles.backBtn} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: "#fff" }}
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
      <ScrollView
        style={{ flex: 1, backgroundColor: "#fff" }}
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 🧍‍♂️ Profil */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image
              style={styles.headerImage}
              source={
                userInfo?.profile_picture
                  ? { uri: userInfo.profile_picture }
                  : require("../../assets/images/profile.jpg")
              }
            />
            <Text style={styles.nameText}>
              {userInfo?.Data?.first_name} {userInfo?.Data?.last_name}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.instructionText}>{t("venantami")}</Text>

          <Text style={styles.instructionTitle}>{t("enter_friend_code")}</Text>

          <TextInput
            style={styles.card}
            value={code}
            onChangeText={setCode}
            placeholder={t("referral_code")}
            placeholderTextColor="#999"
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleValidateCode}
          >
            <Text style={styles.submitButtonText}>{t("validate_my_code")}</Text>
          </TouchableOpacity>
        </View>

        <Modal
          transparent
          animationType="slide"
          visible={modalInvalid}
          onRequestClose={() => setModalInvalid(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentSmall}>
              <Text style={styles.modalTitle}>{errorMessage || t("invalid_code")}</Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setModalInvalid(false)}
              >
                <Text style={styles.modalButtonText}>{t("close")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          animationType="slide"
          visible={modalValid}
          onRequestClose={() => setModalValid(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setModalValid(false)}
          >
            <View style={styles.modalContentSmall}>
              <Text style={[styles.modalTitle, { textAlign: "center", fontWeight: "bold" }]}>
                {t("congratulations_referred")}
              </Text>
            </View>
          </TouchableOpacity>
        </Modal>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (width: number, height: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.tint },
    topBar: { flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 8, backgroundColor: Colors.light.tint },
    topBarTitle: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "bold", color: "#fff" },
    backBtn: { width: 40, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
    header: {
      minHeight: height * 0.35,
      alignItems: "center",
      backgroundColor: Colors.light.tint,
    },
    headerContent: { alignItems: "center", paddingVertical: 20 },
    headerImage: {
      width: width * 0.2,
      height: width * 0.2,
      minWidth: 80,
      minHeight: 80,
      borderRadius: 100,
    },
    nameText: {
      fontSize: width > 375 ? 20 : 18,
      fontWeight: "500",
      color: "#fff",
      marginTop: 10,
    },
    body: {
      flex: 1,
      backgroundColor: "#fff",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 30,
    },
    instructionText: {
      fontSize: width > 375 ? 16 : 14,
      textAlign: "center",
      marginBottom: 15,
      color: "#333",
    },
    instructionTitle: {
      fontSize: width > 375 ? 18 : 16,
      fontWeight: "bold",
      textAlign: "center",
      marginVertical: 20,
    },
    card: {
      width: "100%",
      backgroundColor: "#f5f5f5",
      padding: 15,
      borderRadius: 10,
      marginBottom: 20,
    },
    submitButton: {
      backgroundColor: Colors.light.tint,
      borderRadius: 10,
      paddingVertical: 15,
      alignItems: "center",
    },
    submitButtonText: {
      color: "#fff",
      fontSize: width > 375 ? 18 : 16,
      fontWeight: "bold",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalContent: {
      width: width * 0.85,
      backgroundColor: "#fff",
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
    },
    modalContentSmall: {
      width: width * 0.85,
      backgroundColor: "#fff",
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
    },
    modalTitle: {
      fontSize: width > 375 ? 20 : 18,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 10,
    },
    modalButton: {
      width: "100%",
      borderRadius: 25,
      marginVertical: 10,
      paddingVertical: 15,
      backgroundColor: Colors.light.tint,
      alignItems: "center",
    },
    modalButtonText: { color: "#fff", fontSize: width > 375 ? 16 : 14 },
  });
