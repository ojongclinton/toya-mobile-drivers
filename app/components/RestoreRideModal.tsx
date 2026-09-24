import React from "react";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Icon } from "react-native-paper";
import { useTranslation } from "react-i18next";
import { Colors } from "@/constants/Colors";

type Phase = "pickup" | "in_progress";

type Props = {
  visible: boolean;
  phase: Phase;
  rideData: any;
  onConfirm: () => void;
  onCancel?: () => void;
  onComplete?: () => void;
  onClose: () => void;
};

export const RestoreRideModal = ({
  visible,
  phase,
  rideData,
  onConfirm,
  onCancel,
  onComplete,
  onClose,
}: Props) => {
  const { t } = useTranslation();
  const isPickup = phase === "pickup";

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Icon
              source={isPickup ? "clock-alert-outline" : "car-arrow-right"}
              size={28}
              color={Colors.light.tint}
            />
            <Text style={styles.title}>
              {t(isPickup ? "restore_ride_title_pickup" : "restore_ride_title_inprogress")}
            </Text>
          </View>
          <Text style={styles.subtitle}>
            {t(isPickup ? "restore_ride_subtitle_pickup" : "restore_ride_subtitle_inprogress")}
          </Text>

          {rideData && (
            <>
              <View style={styles.clientRow}>
                <Image
                  style={styles.avatar}
                  source={
                    rideData.client?.profile_picture
                      ? { uri: rideData.client.profile_picture }
                      : require("../../assets/images/profile.jpg")
                  }
                />
                <Text style={styles.clientName}>{rideData.client?.full_name}</Text>
              </View>

              {isPickup && (
                <View style={styles.infoRow}>
                  <Icon source="map-marker-check" size={18} color="#4CAF50" />
                  <Text style={styles.infoText} numberOfLines={2}>
                    <Text style={styles.infoLabel}>{t("pickup_label")}: </Text>
                    {rideData.pickup?.location}
                  </Text>
                </View>
              )}

              <View style={styles.infoRow}>
                <Icon source="map-marker" size={18} color={Colors.light.tint} />
                <Text style={styles.infoText} numberOfLines={2}>
                  <Text style={styles.infoLabel}>{t("destination_label")}: </Text>
                  {rideData.destination?.location}
                </Text>
              </View>

              <View style={styles.priceRow}>
                <Text style={styles.price}>{rideData.ride_details?.final_price} CFA</Text>
                <Text style={styles.distance}>{rideData.ride_details?.distance} km</Text>
              </View>
            </>
          )}

          <TouchableOpacity style={styles.btnPrimary} onPress={onConfirm}>
            <Icon source="navigation" size={18} color="white" />
            <Text style={styles.btnPrimaryText}>
              {t(isPickup ? "restore_ride_resume" : "restore_ride_resume_inprogress")}
            </Text>
          </TouchableOpacity>

          {isPickup ? (
            <TouchableOpacity style={styles.btnDanger} onPress={onCancel}>
              <Icon source="close-circle-outline" size={18} color={Colors.light.tint} />
              <Text style={styles.btnDangerText}>{t("restore_ride_cancel")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnSecondary} onPress={onComplete}>
              <Icon source="flag-checkered" size={18} color={Colors.light.tint} />
              <Text style={styles.btnSecondaryText}>{t("restore_ride_complete")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  card: { width: "88%", backgroundColor: "white", borderRadius: 20, padding: 22, alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  title: { fontSize: 18, fontWeight: "bold", color: Colors.light.tint },
  subtitle: { fontSize: 13, color: "#666", textAlign: "center", marginBottom: 16 },
  clientRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, alignSelf: "flex-start", gap: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: Colors.light.tint },
  clientName: { fontWeight: "bold", fontSize: 15, color: "#222", flex: 1 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, alignSelf: "flex-start", gap: 6, width: "100%" },
  infoLabel: { fontWeight: "600", color: "#333" },
  infoText: { fontSize: 13, color: "#444", flex: 1, flexWrap: "wrap" },
  priceRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginVertical: 14, paddingHorizontal: 4 },
  price: { fontWeight: "bold", fontSize: 16, color: Colors.light.tint },
  distance: { fontSize: 14, color: "#777" },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: Colors.light.tint, borderRadius: 12, paddingVertical: 13, width: "100%", marginBottom: 10, gap: 8 },
  btnPrimaryText: { color: "white", fontWeight: "bold", fontSize: 15 },
  btnDanger: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.light.tint, borderRadius: 12, paddingVertical: 12, width: "100%", gap: 8 },
  btnDangerText: { color: Colors.light.tint, fontWeight: "600", fontSize: 15 },
  btnSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.light.tint, borderRadius: 12, paddingVertical: 12, width: "100%", gap: 8 },
  btnSecondaryText: { color: Colors.light.tint, fontWeight: "600", fontSize: 15 },
});
