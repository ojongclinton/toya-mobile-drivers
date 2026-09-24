import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Button,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";

import BASE_URL from "@/constants/api/BASE_URL";
import styles from "@/assets/styles/global_styles";
import { Colors } from "@/constants/Colors";
import { StyleSheet } from "react-native";

// Déduit un type MIME image à partir de l'extension du nom de fichier.
const guessMime = (name?: string): string => {
  const ext = (name || "").split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "heic": return "image/heic";
    case "heif": return "image/heif";
    case "jpg":
    case "jpeg":
    default: return "image/jpeg";
  }
};

// Prépare un fichier pour l'upload multipart de façon robuste sur tous les
// appareils Android :
//  - copie les URI `content://` (SAF) vers un `file://` lisible par la couche
//    réseau native (okhttp) — sinon l'envoi échoue sur certains OEM/versions
//    AVANT d'atteindre le serveur ;
//  - garantit un `type` (MIME) et un `name` avec extension.
// Défensif : en cas d'échec de copie, on retombe sur l'URI d'origine.
const prepareFileForUpload = async (
  file: { uri: string; name?: string; mimeType?: string }
): Promise<{ uri: string; name: string; type: string }> => {
  const type = file.mimeType || guessMime(file.name);
  let name = file.name || `document.${type.split("/")[1] || "jpg"}`;
  if (!name.includes(".")) name = `${name}.${type.split("/")[1] || "jpg"}`;

  let uri = file.uri;
  try {
    if (uri.startsWith("content://") && FileSystem?.cacheDirectory && FileSystem?.copyAsync) {
      const dest = `${FileSystem.cacheDirectory}upload_${Date.now()}_${name}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      uri = dest;
    }
  } catch {
    // La copie a échoué : on garde l'URI d'origine (comportement inchangé).
  }
  return { uri, name, type };
};

const VEHICLE_COLORS = [
  { value: "white",  en: "White",  fr: "Blanc",  hex: "#FFFFFF", border: "#ccc" },
  { value: "black",  en: "Black",  fr: "Noir",   hex: "#000000", border: "#000" },
  { value: "gray",   en: "Gray",   fr: "Gris",   hex: "#808080", border: "#808080" },
  { value: "silver", en: "Silver", fr: "Argent", hex: "#C0C0C0", border: "#aaa" },
  { value: "blue",   en: "Blue",   fr: "Bleu",   hex: "#2196F3", border: "#2196F3" },
  { value: "red",    en: "Red",    fr: "Rouge",  hex: "#F44336", border: "#F44336" },
  { value: "green",  en: "Green",  fr: "Vert",   hex: "#4CAF50", border: "#4CAF50" },
  { value: "yellow", en: "Yellow", fr: "Jaune",  hex: "#FFEB3B", border: "#ccc" },
  { value: "brown",  en: "Brown",  fr: "Marron", hex: "#795548", border: "#795548" },
  { value: "orange", en: "Orange", fr: "Orange", hex: "#FF9800", border: "#FF9800" },
  { value: "purple", en: "Purple", fr: "Violet", hex: "#9C27B0", border: "#9C27B0" },
  { value: "other",  en: "Other",  fr: "Autre",  hex: "#9E9E9E", border: "#9E9E9E" },
];

export default function Verification({ navigation }: { navigation: any }) {
  const { t, i18n } = useTranslation();

  const [focusedInput, setFocusedInput] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [modelVehicle, setModelVehicle] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");
  const [prestation, setPrestation] = useState("economy");
  const [documents, setDocuments] = useState({
    photo: null,
    contrat: null,
    recto: null,
    verso: null,
    control: null,
    casier: null,
    transport_s5: null,
    carte_bleue: null,
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [colorModalVisible, setColorModalVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  type PickedFile = {
    uri: string;
    name: string;
    mimeType: string;
  };

  useFocusEffect(
    useCallback(() => {
      fetchValidationStatus();
    }, [])
  );

  const pickDocument = async (key: string) => {
    // copyToCacheDirectory : renvoie une copie file:// locale (plus fiable que
    // l'URI content:// d'origine pour l'upload).
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true });
    if (!result.canceled) {
      const file = result.assets[0];
      setDocuments((prev) => ({ ...prev, [key]: file }));
    }
  };

  const fetchValidationStatus = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const res = await fetch(`${BASE_URL}/drivers/vehicle/validation_status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Erreur de récupération du statut.");
      const data = await res.json();
      setStatus(data?.Data || "");
    } catch {
      // silently ignore
    }
  };

  const isApproved = status?.toLowerCase() === "validated";

  const handleSubmit = async () => {
    const { photo, contrat, recto, verso, control, casier, transport_s5, carte_bleue } = documents;

    // ✅ Validation conditionnelle : stricte pour création, flexible pour mise à jour
    if (!isApproved) {
      // Mode création : tous les champs obligatoires
      if (
        !vehicleBrand ||
        !modelVehicle ||
        !licensePlate ||
        !vehicleColor ||
        !photo ||
        !contrat ||
        !recto ||
        !verso ||
        !control ||
        !transport_s5 ||
        !carte_bleue ||
        (prestation === "prestige" && !casier)
      ) {
        setMessage(t("allfile"));
        setModalVisible(true);
        return;
      }
    } else {
      // Mode mise à jour : au moins un champ doit être modifié
      const hasChanges =
        vehicleBrand ||
        modelVehicle ||
        licensePlate ||
        vehicleColor ||
        photo ||
        contrat ||
        recto ||
        verso ||
        control ||
        casier ||
        transport_s5 ||
        carte_bleue;

      if (!hasChanges) {
        setMessage(t("no_changes") || "Aucune modification détectée");
        setModalVisible(true);
        return;
      }
    }

    setLoading(true);
    try {
      const info = await AsyncStorage.getItem("Info");
      const token = await AsyncStorage.getItem("authToken");
      const data = info ? JSON.parse(info) : null;

      const formData = new FormData();
      formData.append("driver_id", data?.Data?.id);
      
      // ✅ Ajouter uniquement si modifié
      if (vehicleBrand) formData.append("vehicle_brand", vehicleBrand);
      if (modelVehicle) formData.append("vehicle_model", modelVehicle);
      if (licensePlate) formData.append("license_plate", licensePlate);
      if (vehicleColor) {
        formData.append("vehicle_color", vehicleColor);
      }
      if (prestation) formData.append("prestation", prestation);

      // ✅ Mapping correct des champs
      const fieldMapping = {
        photo: "photos",
        contrat: "vehicle_rental_contract",
        recto: "driving_licence_front",
        verso: "driving_licence_back",
        control: "insurrance_file",
        casier: "criminal_record_certificate",
        transport_s5: "transport_license_s5",
        carte_bleue: "blue_card",
      };

      for (const [key, file] of Object.entries(documents)) {
        if (!file) continue;

        // ✅ Ne pas envoyer le casier si pas prestige
        if (key === "casier" && prestation !== "prestige") continue;

        const fieldName = fieldMapping[key];

        // Normalise le fichier (content:// → file://, type/name garantis) pour
        // un envoi fiable sur tous les appareils.
        const prepared = await prepareFileForUpload(file as any);
        formData.append(fieldName, prepared as any);
      }

      const method = isApproved ? "PUT" : "POST";
      const url = `${BASE_URL}/drivers/vehicle/${isApproved ? "update/" : ""}`;

      const xhrResult = await new Promise<{ ok: boolean; status: number; text: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.timeout = 30000;
        xhr.onload = () => resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText });
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => {
          reject(new Error("Timeout"));
        };
        xhr.send(formData);
      });

      if (xhrResult.ok) {
        setMessage(isApproved ? t("update_success") : t("sendsuccefuly"));
        fetchValidationStatus();
        setVehicleBrand("");
        setModelVehicle("");
        setLicensePlate("");
        setVehicleColor("");
        setDocuments({
          photo: null,
          contrat: null,
          recto: null,
          verso: null,
          control: null,
          casier: null,
          transport_s5: null,
          carte_bleue: null,
        });
      } else {
        setMessage(t("network_error"));
      }
    } catch (error: any) {
      if (error?.message === "Timeout") {
        setMessage("Délai dépassé. Vérifiez votre connexion.");
      } else {
        setMessage(t("network_error"));
      }
    } finally {
      setModalVisible(true);
      setLoading(false);
    }
  };

  const getStatusDisplay = (currentStatus: string) => {
    const map = {
      validated: {
        text: t("Approved"),
        color: "#4CAF50",
        icon: "check-circle",
      },
      "in pending": {
        text: t("Pending"),
        color: "#FFC107",
        icon: "timer-sand",
      },
      rejected: { text: t("rejected"), color: "#F44336", icon: "close-circle" },
    };
    const defaultVal = {
      text: t("Statut inconnu"),
      color: "#9E9E9E",
      icon: "help-circle",
    };
    return map[currentStatus?.toLowerCase()] || defaultVal;
  };

  const statusDisplay = getStatusDisplay(status);

  // 🟫 Rendu du composant
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={vNavStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={vNavStyles.backBtn}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={vNavStyles.title}>{t("verification")}</Text>
        <View style={vNavStyles.spacer} />
      </View>
    <View style={[styles.container, { paddingTop: 0, marginTop: 0 }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "center", paddingBottom: 20 }}
        style={{ marginTop: 0 }}
      >
        <Text style={localStyles.description}>
          {isApproved 
            ? t("update_document_text") || "Vous pouvez mettre à jour vos documents. Modifiez uniquement les informations que vous souhaitez changer."
            : t("textforjustificatif")
          }
        </Text>

        {status ? (
          <View
            style={[
              localStyles.statusContainer,
              { borderLeftColor: statusDisplay.color },
            ]}
          >
            <Icon
              source={statusDisplay.icon}
              size={24}
              color={statusDisplay.color}
            />
            <Text
              style={[localStyles.statusText, { color: statusDisplay.color }]}
            >
              {t("Statusvalidation")}: {statusDisplay.text}
            </Text>
          </View>
        ) : null}

        <TextInput
          style={[
            localStyles.input,
            focusedInput === "brand" && localStyles.inputFocused,
          ]}
          placeholder={
            isApproved
              ? t("vehicle_brand") + " (" + t("optional") + ")"
              : t("vehicle_brand") + " *"
          }
          placeholderTextColor="#999"
          value={vehicleBrand}
          onChangeText={setVehicleBrand}
          onFocus={() => setFocusedInput("brand")}
          onBlur={() => setFocusedInput("")}
        />
        <TextInput
          style={[
            localStyles.input,
            focusedInput === "model" && localStyles.inputFocused,
          ]}
          placeholder={
            isApproved
              ? t("vehicle_model") + " (" + t("optional") + ")"
              : t("vehicle_model") + " *"
          }
          placeholderTextColor="#999"
          value={modelVehicle}
          onChangeText={setModelVehicle}
          onFocus={() => setFocusedInput("model")}
          onBlur={() => setFocusedInput("")}
        />
        <TextInput
          style={[
            localStyles.input,
            focusedInput === "plate" && localStyles.inputFocused,
          ]}
          placeholder={
            isApproved
              ? t("license_plate") + " (" + t("optional") + ")"
              : t("license_plate") + " *"
          }
          placeholderTextColor="#999"
          value={licensePlate}
          onChangeText={setLicensePlate}
          onFocus={() => setFocusedInput("plate")}
          onBlur={() => setFocusedInput("")}
        />
        {/* Sélecteur de couleur via modal */}
        <TouchableOpacity
          style={localStyles.colorPickerButton}
          onPress={() => setColorModalVisible(true)}
        >
          {vehicleColor ? (
            <>
              <View
                style={[
                  localStyles.colorDot,
                  {
                    backgroundColor: VEHICLE_COLORS.find(c => c.value === vehicleColor)?.hex ?? "#9E9E9E",
                    borderColor: VEHICLE_COLORS.find(c => c.value === vehicleColor)?.border ?? "#ccc",
                  },
                ]}
              />
              <Text style={localStyles.colorPickerText}>
                {i18n.language.startsWith("fr")
                  ? VEHICLE_COLORS.find(c => c.value === vehicleColor)?.fr
                  : VEHICLE_COLORS.find(c => c.value === vehicleColor)?.en}
              </Text>
            </>
          ) : (
            <>
              <Icon source="palette" size={22} color="#666" />
              <Text style={localStyles.colorPickerPlaceholder}>
                {t("vehicle_color")} {!isApproved && "*"}
              </Text>
            </>
          )}
          <Icon source="chevron-down" size={22} color="#666" />
        </TouchableOpacity>

        {/* ✅ Sélecteur de prestation avec boutons */}
        <View style={localStyles.prestationContainer}>
          <Text style={localStyles.label}>
            {t("service_type")} {!isApproved && "*"}
          </Text>
          <View style={localStyles.prestationButtons}>
            <TouchableOpacity
              style={[
                localStyles.prestationButton,
                prestation === "economy" && localStyles.prestationButtonActive,
              ]}
              onPress={() => setPrestation("economy")}
            >
              <Icon
                source="car"
                size={20}
                color={prestation === "economy" ? "white" : "#666"}
              />
              <Text
                style={[
                  localStyles.prestationButtonText,
                  prestation === "economy" &&
                    localStyles.prestationButtonTextActive,
                ]}
              >
                {t("economy")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                localStyles.prestationButton,
                prestation === "confort" && localStyles.prestationButtonActive,
              ]}
              onPress={() => setPrestation("confort")}
            >
              <Icon
                source="car-side"
                size={20}
                color={prestation === "confort" ? "white" : "#666"}
              />
              <Text
                style={[
                  localStyles.prestationButtonText,
                  prestation === "confort" &&
                    localStyles.prestationButtonTextActive,
                ]}
              >
                {t("comfort")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                localStyles.prestationButton,
                prestation === "prestige" && localStyles.prestationButtonActive,
              ]}
              onPress={() => setPrestation("prestige")}
            >
              <Icon
                source="car-sports"
                size={20}
                color={prestation === "prestige" ? "white" : "#666"}
              />
              <Text
                style={[
                  localStyles.prestationButtonText,
                  prestation === "prestige" &&
                    localStyles.prestationButtonTextActive,
                ]}
              >
                {t("prestige")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {[
          { key: "photo", label: t("add_photo"), icon: "camera" },
          { key: "contrat", label: t("vehicle_contract"), icon: "file-document" },
          { key: "recto", label: t("permit_front"), icon: "card-account-details" },
          { key: "verso", label: t("permit_back"), icon: "card-account-details" },
          { key: "control", label: t("technical_control"), icon: "tools" },
          { key: "transport_s5", label: i18n.language.startsWith("fr") ? "Licence de transport public S5 *" : "Public transport license S5 *", icon: "license" },
          { key: "carte_bleue", label: i18n.language.startsWith("fr") ? "Carte bleue *" : "Blue card *", icon: "credit-card" },
        ].map(({ key, label, icon }) => (
          <TouchableOpacity
            key={key}
            style={localStyles.card}
            onPress={() => pickDocument(key)}
          >
            <Icon source={icon} size={24} color="gray" />
            <Text style={styles.normal_text}>
              {label} {!isApproved && "*"}
            </Text>
            <Icon
              source={documents[key] ? "check" : "cloud-download"}
              size={24}
              color={documents[key] ? "green" : "gray"}
            />
          </TouchableOpacity>
        ))}

        {/* ✅ Casier judiciaire (uniquement si prestige) */}
        {prestation === "prestige" && (
          <TouchableOpacity
            style={[localStyles.card, localStyles.prestigeCard]}
            onPress={() => pickDocument("casier")}
          >
            <Icon source="shield-alert" size={24} color="#FF9800" />
            <Text style={[styles.normal_text, { color: "#FF9800" }]}>
              {t("criminal_record")} {!isApproved && "*"}
            </Text>
            <Icon
              source={documents.casier ? "check" : "cloud-download"}
              size={24}
              color={documents.casier ? "green" : "#FF9800"}
            />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={localStyles.button}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={localStyles.buttonText}>
              {isApproved ? t("update") || "Mettre à jour" : t("share")}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 80 }} />

        {/* Modal sélection couleur */}
        <Modal visible={colorModalVisible} transparent animationType="slide">
          <View style={localStyles.modalContainer}>
            <View style={[localStyles.modalContent, { width: "90%", paddingBottom: 10 }]}>
              <Text style={[localStyles.messageText, { fontWeight: "bold", fontSize: 17, marginBottom: 12 }]}>
                {i18n.language.startsWith("fr") ? "Couleur du véhicule" : "Vehicle Color"}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {VEHICLE_COLORS.map(({ value, en, fr, hex, border }) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      localStyles.colorOption,
                      vehicleColor === value && { backgroundColor: Colors.light.lighterTint, borderColor: Colors.light.tint, borderWidth: 1.5 },
                    ]}
                    onPress={() => {
                      setVehicleColor(value);
                      setColorModalVisible(false);
                    }}
                  >
                    <View style={[localStyles.colorDot, { backgroundColor: hex, borderColor: border }]} />
                    <Text style={localStyles.colorOptionText}>
                      {i18n.language.startsWith("fr") ? fr : en}
                    </Text>
                    {vehicleColor === value && (
                      <Icon source="check" size={20} color={Colors.light.tint} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Button title={t("close")} onPress={() => setColorModalVisible(false)} />
            </View>
          </View>
        </Modal>

        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={localStyles.modalContainer}>
            <View style={localStyles.modalContent}>
              <ScrollView>
                <Text style={localStyles.messageText}>{message}</Text>
              </ScrollView>
              <Button
                title={t("close")}
                onPress={() => setModalVisible(false)}
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </View>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  container: { flex: 1, alignItems: "center" },
  description: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 10,
    textAlign: "center",
    fontSize: 16,
    color: "#333",
    fontWeight:'bold'
  },
  input: {
    width: "95%",
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 15,
    backgroundColor: Colors.light.lighterTint,
  },
  inputFocused: { borderColor: Colors.light.tint, borderWidth: 2 },

  prestationContainer: {
    width: "95%",
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 10,
  },
  prestationButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  prestationButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.lighterTint,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: "transparent",
    minHeight: 70,
  },
  prestationButtonActive: {
    backgroundColor: Colors.light.tint,
    borderColor: Colors.light.tint,
  },
  prestationButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },
  prestationButtonTextActive: {
    color: "white",
  },

  prestigeCard: {
    borderWidth: 2,
    borderColor: "#FF9800",
    backgroundColor: "#FFF3E0",
  },

  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "95%",
    padding: "5%",
    backgroundColor: Colors.light.lighterTint,
    borderRadius: 10,
    marginTop: 10,
  },
  button: {
    backgroundColor: Colors.light.tint,
    padding: 15,
    borderRadius: 10,
    marginTop: 60,
    alignItems: "center",
    width: "50%",
  },
  buttonText: { color: "white", fontWeight: "bold" },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    width: "80%",
    padding: 20,
    backgroundColor: "white",
    borderRadius: 10,
  },
  messageText: { marginBottom: 20, fontSize: 16 },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    marginVertical: 10,
    width: "95%",
    borderRadius: 10,
    backgroundColor: "white",
    borderLeftWidth: 5,
    elevation: 2,
  },
  statusText: { fontSize: 15, fontWeight: "bold", marginLeft: 15 },

  colorPickerButton: {
    width: "95%",
    height: 50,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 15,
    backgroundColor: Colors.light.lighterTint,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  colorPickerText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  colorPickerPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#999",
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  colorOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 4,
    gap: 12,
  },
  colorOptionText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
});

const vNavStyles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { flex: 1, textAlign: "center", fontSize: 23, fontWeight: "bold", color: "#333" },
  spacer: { width: 32 },
});