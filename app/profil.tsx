import {
  Button,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  ScrollView,
  Platform,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BASE_URL from "@/constants/api/BASE_URL";
import styles from "../assets/styles/global_styles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";

import { useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import React from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";
import { Colors } from "@/constants/Colors";

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;

export default function Profil({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [photo, setPhoto] = useState(null);
  const [url, seturl] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalVisiblewant, setModalVisiblewant] = useState(false);
  const [modalDeleteVisible, setModalDeleteVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExceptionalWithdrawal, setShowExceptionalWithdrawal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const getData = async () => {
        try {
          const data = await AsyncStorage.getItem("Info");
          if (!data) return;
          const datatojson = JSON.parse(data);
          const info = datatojson?.Data ?? {};
          setFirstName(info.first_name ?? "");
          setLastName(info.last_name ?? "");
          seturl(datatojson?.profile_picture);
        } catch {
          // Info absent ou JSON malformé → on n'écrase rien.
        }
      };
      getData();
      const getExceptionalWithdrawalAvailability = async () => {
        try {
          const token = await AsyncStorage.getItem("authToken");
          const response = await fetch(`${BASE_URL}/payments/wallet/exceptional-withdrawal/`, {
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          });
          const body = await response.json();
          if (!response.ok) return;
          const data = body?.Data || {};
          setShowExceptionalWithdrawal(Boolean(data.can_request || data.pending_request));
        } catch {
          setShowExceptionalWithdrawal(false);
        }
      };
      getExceptionalWithdrawalAvailability();
    }, [])
  );

  const pickphoto = async () => {
    setModalVisiblewant(false);

    // Permission
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      alert("Permission d'accès à la galerie refusée");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const file = result.assets[0];

      setPhoto({
        uri: file.uri,
        name: "profile.jpg",
        mimeType: "image/jpeg",
      });

      setModalVisible(true);
    }
  };

  const confirmphoto = async (file) => {
    setModalVisible(false);
    const formData = new FormData();
    try {
      const storage = await AsyncStorage.getItem("authToken");
      const instance = axios.create({
        baseURL: BASE_URL,
        timeout: 15000,
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "multipart/form-data",
        },
      });
      formData.append("profile_picture", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      });

      const response = await instance.post(
        "/drivers/upload/profile_picture/",
        formData
      );
      seturl(response.data["Profile Picture URL"]);
      getInfo();
    } catch {
      Alert.alert(t("error"), t("connection_error"));
    }
  };

  const getInfo = async () => {
    try {
      const storage = await AsyncStorage.getItem("authToken");

      const response = await fetch(BASE_URL + "/drivers/profile/", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      const data = await response.json();
      await AsyncStorage.removeItem("Info");
      await AsyncStorage.setItem("Info", JSON.stringify(data));
    } catch {
      // silently ignore
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem("userId");
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("Info");
    await AsyncStorage.removeItem("isDriverOnline");
    await AsyncStorage.removeItem("idclientcurentride");
    await AsyncStorage.removeItem("idride");

    // Vider le cache des conversations
    const allKeys = await AsyncStorage.getAllKeys();
    const chatKeys = allKeys.filter(
      (k) => k.startsWith("chat_ride_") || k.startsWith("chat_ticket_")
    );
    if (chatKeys.length > 0) {
      await AsyncStorage.multiRemove(chatKeys);
    }

    navigation.reset({
      index: 0,
      routes: [{ name: "index" }],
    });
  };

  const deleteAccount = async () => {
    setIsDeleting(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + "/drivers/delete/", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      // Suppression des données locales
      await AsyncStorage.removeItem("userId");
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("Info");
      await AsyncStorage.removeItem("isDriverOnline");
      await AsyncStorage.removeItem("idclientcurentride");
      await AsyncStorage.removeItem("idride");
      const allKeys = await AsyncStorage.getAllKeys();
      const chatKeys = allKeys.filter(
        (k) => k.startsWith("chat_ride_") || k.startsWith("chat_ticket_")
      );
      if (chatKeys.length > 0) {
        await AsyncStorage.multiRemove(chatKeys);
      }

      setModalDeleteVisible(false);
      setIsDeleting(false);

      Alert.alert(
        t("account_deleted_title") || "Compte supprimé",
        t("account_deleted_message") || "Votre compte a été supprimé avec succès.",
        [
          {
            text: "OK",
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: "index" }],
              });
            }
          }
        ]
      );

    } catch {
      clearTimeout(timeoutId);
      setIsDeleting(false);
      Alert.alert(
        t("error") || "Erreur",
        t("delete_account_error") || "Erreur lors de la suppression du compte"
      );
    }
  };

  return (
    <SafeAreaView style={style.safeArea}>
      <View style={styles.container}>
        {/* Texte "Accueil" en position absolue */}
        <Text style={[style.welcomeText, isTablet && style.welcomeTextTablet]}>
          {t("home") || "Accueil"}
        </Text>

        <View style={[styles.header, isTablet && style.headerTablet]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => setModalVisiblewant(true)}>
              <View>
                {url ? (
                  <Image style={styles.headerImage} source={{ uri: url }} />
                ) : (
                  <Image
                    style={styles.headerImage}
                    source={require("../assets/images/profile.jpg")}
                  />
                )}
                {/* Petit icône plus */}
                <View style={style.plusIconContainer}>
                  <Icon source="plus" size={20} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
            <Text style={styles.headerText}>
              {firstName} {lastName}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={[style.scrollContainer, isTablet && style.scrollContainerTablet]}
          contentContainerStyle={[style.scrollContent, isTablet && style.scrollContentTablet]}
          showsVerticalScrollIndicator={false}
          persistentScrollbar={true}
          indicatorStyle="black"
        >
          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.menuContainer, isTablet && style.menuItemTablet]}
            onPress={() => navigation.navigate("parrainage")}
          >
            <Icon source="account-multiple-plus" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("sponsorship")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.menuContainer, isTablet && style.menuItemTablet]}
            onPress={() => navigation.navigate("MyGrades")}
          >
            <Icon source="medal" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("my_grades")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.menuContainer, isTablet && style.menuItemTablet]}
            onPress={() => navigation.navigate("MyStatistics")}
          >
            <Icon source="chart-line" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("my_statistics")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.menuContainer, isTablet && style.menuItemTablet]}
            onPress={() => navigation.navigate("user_profile")}
          >
            <Icon source="account" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("user_profile")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <TouchableOpacity
            style={[styles.menuContainer, isTablet && style.menuItemTablet]}
            onPress={() => navigation.navigate("verification")}
          >
            <Icon source="file-document" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("verification")}</Text>
          </TouchableOpacity>

          {showExceptionalWithdrawal && (
            <>
              <View style={styles.separator} />
              <TouchableOpacity
                style={[styles.menuContainer, isTablet && style.menuItemTablet]}
                onPress={() => navigation.navigate("ExceptionalWithdrawal")}
              >
                <Icon source="bank-transfer-out" size={isTablet ? 24 : 20} color="#56318a" />
                <View style={style.withdrawalMenuTextWrap}>
                  <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>Retrait exceptionnel</Text>
                  <Text style={style.withdrawalMenuCaption}>Disponible selon votre argent rechargé</Text>
                </View>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.separator} />
          <TouchableOpacity 
            style={[styles.menuContainer, isTablet && style.menuItemTablet]} 
            onPress={logout}
          >
            <Icon source="logout" size={isTablet ? 24 : 20} color="#000" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet]}>{t("logout")}</Text>
          </TouchableOpacity>

          <View style={styles.separator} />
          <TouchableOpacity 
            style={[styles.menuContainer, isTablet && style.menuItemTablet, style.deleteAccountButton]} 
            onPress={() => setModalDeleteVisible(true)}
          >
            <Icon source="delete-forever" size={isTablet ? 24 : 20} color="#d32f2f" />
            <Text style={[styles.menuText, isTablet && style.menuTextTablet, style.deleteAccountText]}>
              {t("delete_account") || "Supprimer mon compte"}
            </Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          
          {/* Espace supplémentaire en bas pour éviter que le contenu soit caché par la bottom tab */}
          <View style={style.bottomSpacing} />
        </ScrollView>

        {/* Modal de confirmation photo */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={style.modalContainer}>
            <View style={[style.modalContent, isTablet && style.modalContentTablet]}>
              <Text style={[style.modalText, isTablet && style.modalTextTablet]}>
                {t("uplouadphoto")}
              </Text>
              {photo && (
                <Image 
                  style={[style.modalImage, isTablet && style.modalImageTablet]} 
                  source={{ uri: photo.uri }} 
                />
              )}
              <View style={style.modalButtons}>
                <TouchableOpacity
                  style={[style.modalButton, style.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={style.buttonText}>{t("cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[style.modalButton, style.confirmButton]}
                  onPress={() => confirmphoto(photo)}
                >
                  <Text style={style.buttonText}>{t("confirm")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal "Voulez-vous changer de photo ?" */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisiblewant}
          onRequestClose={() => setModalVisiblewant(false)}
        >
          <View style={style.modalContainer}>
            <View style={[style.modalContent, isTablet && style.modalContentTablet]}>
              <Text style={[style.modalText, isTablet && style.modalTextTablet]}>
                {t("want")}
              </Text>

              <View style={style.modalButtons}>
                <TouchableOpacity
                  style={[style.modalButton, style.cancelButton]}
                  onPress={() => setModalVisiblewant(false)}
                >
                  <Text style={style.buttonText}>{t("no")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[style.modalButton, style.confirmButton]}
                  onPress={pickphoto}
                >
                  <Text style={style.buttonText}>{t("yes")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal de confirmation de suppression de compte */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalDeleteVisible}
          onRequestClose={() => !isDeleting && setModalDeleteVisible(false)}
        >
          <View style={style.modalContainer}>
            <View style={[style.modalContent, isTablet && style.modalContentTablet]}>
              <Icon source="alert-circle" size={isTablet ? 64 : 48} color="#d32f2f" />
              <Text style={[style.modalText, isTablet && style.modalTextTablet, style.deleteWarningTitle]}>
                {t("delete_account_confirm_title") || "Supprimer votre compte ?"}
              </Text>
              <Text style={[style.deleteWarningText, isTablet && style.deleteWarningTextTablet]}>
                {t("delete_account_confirm_message") || 
                  "Cette action est irréversible. Toutes vos données seront définitivement supprimées."}
              </Text>

              {isDeleting ? (
                <View style={style.loadingContainer}>
                  <ActivityIndicator size="large" color="#d32f2f" />
                  <Text style={style.loadingText}>
                    {t("deleting_account") || "Suppression en cours..."}
                  </Text>
                </View>
              ) : (
                <View style={style.modalButtons}>
                  <TouchableOpacity
                    style={[style.modalButton, style.cancelButton]}
                    onPress={() => setModalDeleteVisible(false)}
                  >
                    <Text style={style.buttonText}>{t("cancel") || "Annuler"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[style.modalButton, style.deleteButton]}
                    onPress={deleteAccount}
                  >
                    <Text style={style.buttonText}>{t("delete") || "Supprimer"}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const style = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  welcomeText: {
    position: 'absolute',
    // top: 80, ios
    top:33,
    left: 0,
    right: 0,
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    zIndex: 10,
  },

  welcomeTextTablet: {
    top: 60,
    fontSize: 24,
  },

  scrollContainer: {
    marginTop: 100,
  },

  scrollContainerTablet: {
    marginTop: 120,
  },

  scrollContent: {
    paddingBottom: 10,
  },

  scrollContentTablet: {
    paddingBottom: 20,
  },

  bottomSpacing: {
    height: 100,
  },

  headerTablet: {
    paddingTop: 20,
    paddingBottom: 20,
  },

  menuItemTablet: {
    paddingVertical: 20,
    paddingHorizontal: 24,
  },

  menuTextTablet: {
    fontSize: 20,
  },

  plusIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    padding: 2,
    borderWidth: 1,
    borderColor: "#fff",
  },

  deleteAccountButton: {
    backgroundColor: '#ffebee',
  },

  deleteAccountText: {
    color: '#d32f2f',
    fontWeight: '600',
  },

  withdrawalMenuTextWrap: {
    flex: 1,
  },

  withdrawalMenuCaption: {
    marginLeft: 14,
    marginTop: 2,
    color: '#756d80',
    fontSize: 11,
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },

  modalContent: {
    width: "80%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },

  modalContentTablet: {
    width: "60%",
    maxWidth: 500,
    padding: 30,
  },

  modalText: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },

  modalTextTablet: {
    fontSize: 22,
    marginBottom: 20,
  },

  modalImage: {
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 20,
  },

  modalImageTablet: {
    width: 200,
    height: 200,
    marginBottom: 30,
  },

  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },

  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelButton: {
    backgroundColor: '#757575',
  },

  confirmButton: {
    backgroundColor: Colors.light.tint,
  },

  deleteButton: {
    backgroundColor: '#d32f2f',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  deleteWarningTitle: {
    color: '#d32f2f',
    marginTop: 15,
    marginBottom: 10,
  },

  deleteWarningText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },

  deleteWarningTextTablet: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 30,
  },

  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
