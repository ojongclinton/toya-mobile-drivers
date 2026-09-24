import React, { useState, useCallback } from "react";
import {
  Image,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";

import BASE_URL from "@/constants/api/BASE_URL";
import globalStyles from "@/assets/styles/global_styles";
import { Colors } from "@/constants/Colors";
import { Icon } from "react-native-paper";

export default function UserProfile({ navigation }: { navigation: any }) {
  const { t } = useTranslation();

  const [userData, setUserData] = useState({
    id: "",
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    adresse: "",
    referral_code: "",
    profile_picture: "",
  });

  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [])
  );

  const fetchUserData = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/drivers/profile/`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok)
        throw new Error("Erreur lors de la récupération des données");

      const data = await response.json();
      await AsyncStorage.setItem("Info", JSON.stringify(data));
      const d = data?.Data ?? {};
      setUserData({
        id: d.id,
        username: d.username,
        email: d.email,
        first_name: d.first_name,
        last_name: d.last_name,
        phone_number: d.phone_number,
        adresse: d.adresse,
        referral_code: d.referral_code,
        profile_picture: data?.profile_picture,
      });
    } catch {
      // silently ignore
    }
  };

  const handleSubmit = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/drivers/profile/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify({
          username: userData.username,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          phone_number: userData.phone_number,
          adresse: userData.adresse,
          referral_code: userData.referral_code,
        }),
      });

      if (!response.ok) throw new Error("Échec de la mise à jour du profil");

      await response.json();
      setModalVisible(true);
      fetchUserData();
    } catch {
      // silently ignore
    }
  };

  const handleChange = (field: string, value: string) => {
    setUserData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={navStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={navStyles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={navStyles.title}>{t("user_profile")}</Text>
        <View style={navStyles.spacer} />
      </View>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
      <Modal
        animationType="slide"
        transparent
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>{t("updateprofile")}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>{t("close")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.profileHeader}>
        <Image
          style={globalStyles.headerImage}
          source={
            userData.profile_picture
              ? { uri: userData.profile_picture }
              : require("../../assets/images/profile.jpg")
          }
        />
        <Text style={styles.profileName}>
          {userData.first_name} {userData.last_name}
        </Text>
        <Text style={styles.profileEmail}>{userData.email}</Text>
      </View>

      {[
        { key: "username", label: t("label_username") },
        { key: "email", label: t("label_email") },
        { key: "first_name", label: t("label_first_name") },
        { key: "last_name", label: t("label_last_name") },
        { key: "phone_number", label: t("label_phone") },
        { key: "adresse", label: t("label_address") },
      ].map(({ key, label }) => (
        <TextInput
          key={key}
          style={styles.input}
          placeholder={label}
          placeholderTextColor="#999"
          value={userData[key as keyof typeof userData] || ""}
          onChangeText={(text) => handleChange(key, text)}
        />
      ))}

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>{t("edit")}</Text>
      </TouchableOpacity>

      <View style={styles.space} />
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 50,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 20,
    marginTop:20
  },
  profileName: {
    fontWeight: "bold",
    marginTop: 8,
    fontSize: 16,
  },
  profileEmail: {
    color: "#555",
    marginTop: 4,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.light.lighterTint,
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 15,
    width: "90%",
    borderRadius: 10,
    marginTop: 10,
    color: "#333",
  },
  button: {
    backgroundColor: Colors.light.tint,
    padding: 15,
    borderRadius: 10,
    marginTop: 40,
    alignItems: "center",
    width: "90%",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  space: {
    height: 80,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
  },
  modalText: {
    textAlign: "center",
    fontSize: 18,
  },
  modalButton: {
    marginTop: 20,
    backgroundColor: Colors.light.tint,
    padding: 10,
    borderRadius: 5,
  },
  modalButtonText: {
    color: "white",
    textAlign: "center",
  },
});

const navStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "bold", color: "#333" },
  spacer: { width: 32 },
});
