import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";

import BASE_URL from "@/constants/api/BASE_URL";
import { Colors } from "@/constants/Colors";

type WithdrawalRequest = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
};

type SelectedFile = {
  uri: string;
  name?: string;
  mimeType?: string;
};

const fcfa = (amount: number) => `${Math.round(Number(amount || 0)).toLocaleString("fr-FR")} FCFA`;

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending_manager: "En attente du gestionnaire",
    pending_finance: "En attente du service financier",
    executed: "Retrait exécuté",
    rejected: "Demande refusée",
  };
  return labels[status] || status;
};

const statusColor = (status: string) => {
  if (status === "executed") return "#16803c";
  if (status === "rejected") return "#bb2424";
  return "#9a6700";
};

export default function ExceptionalWithdrawal({ navigation }: { navigation: any }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawableBalance, setWithdrawableBalance] = useState(0);
  const [canRequest, setCanRequest] = useState(false);
  const [pendingRequest, setPendingRequest] = useState<WithdrawalRequest | null>(null);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [proof, setProof] = useState<SelectedFile | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(`${BASE_URL}/payments/wallet/exceptional-withdrawal/`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "Impossible de charger vos demandes.");

      const data = body?.Data || {};
      setWithdrawableBalance(Number(data.withdrawable_balance || 0));
      setCanRequest(Boolean(data.can_request));
      setPendingRequest(data.pending_request || null);
      setRequests(Array.isArray(data.requests) ? data.requests : []);
    } catch (error: any) {
      Alert.alert("Erreur", error?.message || "Impossible de charger cette page.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chooseProof = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) setProof(result.assets[0]);
  };

  const submit = async () => {
    const numericAmount = Number(amount.replace(/[^0-9]/g, ""));
    if (!numericAmount || numericAmount <= 0 || numericAmount > withdrawableBalance) {
      Alert.alert("Montant invalide", `Indiquez un montant entre 1 et ${fcfa(withdrawableBalance)}.`);
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Motif requis", "Expliquez la situation exceptionnelle qui motive votre demande.");
      return;
    }
    if (!proof) {
      Alert.alert("Justificatif requis", "Ajoutez un document ou une image pour appuyer votre demande.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const formData = new FormData();
      formData.append("amount", String(numericAmount));
      formData.append("reason", reason.trim());
      formData.append("justification", {
        uri: proof.uri,
        name: proof.name || "justificatif",
        type: proof.mimeType || "application/octet-stream",
      } as any);

      const response = await fetch(`${BASE_URL}/payments/wallet/exceptional-withdrawal/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: formData,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.detail || "La demande n'a pas pu être envoyée.");

      setAmount("");
      setReason("");
      setProof(null);
      Alert.alert("Demande envoyée", "Votre demande sera examinée par le gestionnaire puis le service financier.");
      await load();
    } catch (error: any) {
      Alert.alert("Erreur", error?.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={26} color="#1f1538" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retrait exceptionnel</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator size="large" color={Colors.light.tint} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.notice}>
            <Icon source="information-outline" size={22} color="#65449b" />
            <View style={styles.noticeTextWrap}>
              <Text style={styles.noticeTitle}>À utiliser uniquement en cas exceptionnel</Text>
              <Text style={styles.noticeText}>
                Seul l'argent que vous avez rechargé peut être demandé. La demande doit être justifiée,
                validée par un gestionnaire puis exécutée par le service financier.
              </Text>
            </View>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Argent rechargé disponible</Text>
            <Text style={styles.balanceValue}>{fcfa(withdrawableBalance)}</Text>
          </View>

          {pendingRequest ? (
            <View style={styles.pendingCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Demande en cours</Text>
                <Text style={[styles.status, { color: statusColor(pendingRequest.status) }]}>
                  {statusLabel(pendingRequest.status)}
                </Text>
              </View>
              <Text style={styles.pendingAmount}>{fcfa(pendingRequest.amount)}</Text>
              <Text style={styles.muted}>{pendingRequest.reason}</Text>
            </View>
          ) : canRequest ? (
            <View style={styles.formCard}>
              <Text style={styles.cardTitle}>Faire une demande</Text>
              <Text style={styles.fieldLabel}>Montant demandé</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Ex. 5 000"
                placeholderTextColor="#948e9e"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Motif de la demande</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Expliquez votre situation"
                placeholderTextColor="#948e9e"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.reasonInput]}
              />
              <Text style={styles.fieldLabel}>Justificatif</Text>
              <TouchableOpacity style={styles.proofButton} onPress={chooseProof}>
                <Icon source="paperclip" size={20} color={Colors.light.tint} />
                <Text style={styles.proofButtonText}>{proof?.name || "Joindre un fichier (PDF ou image)"}</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={submitting} style={[styles.submitButton, submitting && styles.disabled]} onPress={submit}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Envoyer la demande</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.unavailableCard}>
              <Icon source="wallet-outline" size={26} color="#746b7e" />
              <Text style={styles.cardTitle}>Aucun retrait disponible</Text>
              <Text style={styles.muted}>Vous pouvez demander uniquement le montant que vous avez rechargé dans votre portefeuille.</Text>
            </View>
          )}

          {requests.length > 0 && (
            <View style={styles.historyCard}>
              <Text style={styles.cardTitle}>Mes demandes</Text>
              {requests.map((item) => (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.historyText}>
                    <Text style={styles.historyAmount}>{fcfa(item.amount)}</Text>
                    <Text style={styles.muted} numberOfLines={1}>{item.reason}</Text>
                    {item.status === "rejected" && !!item.rejection_reason && (
                      <Text style={styles.rejection}>{item.rejection_reason}</Text>
                    )}
                  </View>
                  <Text style={[styles.status, { color: statusColor(item.status) }]}>{statusLabel(item.status)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8f7fa" },
  header: { height: 66, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#eeeaf2" },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#1f1538" },
  headerSpacer: { width: 40 }, loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 42 },
  notice: { flexDirection: "row", padding: 14, gap: 10, borderRadius: 14, backgroundColor: "#f0ebf8", marginBottom: 14 },
  noticeTextWrap: { flex: 1 }, noticeTitle: { color: "#3e216b", fontWeight: "700", marginBottom: 4 },
  noticeText: { color: "#5c5367", fontSize: 13, lineHeight: 19 },
  balanceCard: { backgroundColor: "#30115b", borderRadius: 16, padding: 18, marginBottom: 14 },
  balanceLabel: { color: "#e9dffd", fontSize: 13 }, balanceValue: { color: "#fff", fontSize: 27, fontWeight: "800", marginTop: 5 },
  formCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, shadowColor: "#31283d", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  pendingCard: { backgroundColor: "#fff8e8", borderColor: "#f0d99f", borderWidth: 1, borderRadius: 16, padding: 16 },
  unavailableCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 22 },
  historyCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { color: "#211733", fontSize: 16, fontWeight: "700", marginBottom: 12 },
  fieldLabel: { color: "#4b4257", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#ded9e6", borderRadius: 11, paddingHorizontal: 12, height: 48, color: "#1f1538", backgroundColor: "#fff" },
  reasonInput: { height: 94, paddingTop: 12 },
  proofButton: { minHeight: 49, borderRadius: 11, borderWidth: 1, borderColor: "#cfc2e5", borderStyle: "dashed", flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 9, marginBottom: 16 },
  proofButtonText: { flex: 1, color: "#54318a", fontSize: 13 },
  submitButton: { height: 50, borderRadius: 12, backgroundColor: Colors.light.tint, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.65 }, submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  rowBetween: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  status: { fontWeight: "700", fontSize: 12, textAlign: "right", maxWidth: 135 }, pendingAmount: { fontSize: 22, color: "#2d1b45", fontWeight: "800", marginBottom: 4 },
  muted: { color: "#746b7e", fontSize: 13, lineHeight: 18 },
  historyRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: "#f0edf3" },
  historyText: { flex: 1 }, historyAmount: { color: "#2c203e", fontWeight: "700", marginBottom: 3 }, rejection: { color: "#b3261e", fontSize: 12, marginTop: 4 },
});
