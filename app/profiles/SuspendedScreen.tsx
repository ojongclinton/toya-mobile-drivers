import React, { useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/Colors";
import { useTranslation } from "react-i18next";

export default function SuspendedScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  useEffect(() => {
    AsyncStorage.getItem("suspensionReason").then((r) => setReason(r ?? ""));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image
          source={require("../../assets/images/toyalogo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <View style={styles.iconWrap}>
          <Icon source="account-cancel" size={72} color="#F44336" />
        </View>

        <Text style={styles.title}>{t("account_suspended_title")}</Text>
        <Text style={styles.body}>{t("account_suspended_body")}</Text>

        {!!reason && (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>{t("suspension_reason_label")} :</Text>
            <Text style={styles.reasonText}>{reason}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("verification")}
        >
          <Icon source="file-upload" size={20} color="white" />
          <Text style={styles.primaryTxt}>{t("resubmit_documents")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate("chatcommenceDirect")}
        >
          <Icon source="headset" size={20} color={Colors.light.tint} />
          <Text style={styles.secondaryTxt}>{t("contact_support")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => navigation.replace("index")}
        >
          <Icon source="refresh" size={18} color="#888" />
          <Text style={styles.refreshTxt}>{t("check_account_status")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { alignItems: "center", padding: 28, paddingTop: 40 },
  logo: { width: 120, height: 70, marginBottom: 28 },
  iconWrap: { marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#222", textAlign: "center", marginBottom: 12 },
  body: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  reasonBox: {
    backgroundColor: "#FFF3E0",
    borderRadius: 10,
    padding: 14,
    width: "100%",
    marginBottom: 28,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  reasonLabel: { fontSize: 12, fontWeight: "600", color: "#E65100", marginBottom: 4 },
  reasonText: { fontSize: 14, color: "#333", lineHeight: 20 },
  primaryBtn: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  primaryTxt: { color: "white", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryTxt: { color: Colors.light.tint, fontWeight: "600", fontSize: 15 },
  refreshBtn: {
    flexDirection: "row",
    gap: 6,
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  refreshTxt: { color: "#888", fontSize: 13 },
});
