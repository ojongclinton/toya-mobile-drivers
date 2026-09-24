import {
  View,
  Text,
  StatusBar,
  StyleSheet,
  Image,
  TouchableOpacity,
  SafeAreaView,
  Modal,
  Animated,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useEffect, useRef, useState } from "react";
import BASE_URL from "@/constants/api/BASE_URL";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";
import i18n from "./translation";

export default function Historical() {
  const [url, seturl] = useState("");
  const { t } = useTranslation();
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: StatusBar.currentHeight,
      backgroundColor: Colors.light.tint,
    },
    header: {
      height: 350,
      alignItems: "center",
      backgroundColor: Colors.light.tint,
    },
    headerContent: {
      alignItems: "center",
      marginTop: 25,
      marginBottom: 15,
    },
    infoContent: {
      justifyContent: "space-between",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 25,
      paddingHorizontal: 12,
    },

    headerTitle: {
      fontSize: 25,
      fontWeight: "bold",
      color: "white",
    },
    headerImage: {
      marginTop: 25,
      width: 80,
      height: 80,
      borderRadius: 100,
    },
    headerText: {
      fontSize: 20,
      color: "white",
    },
    headerBody: {
      alignItems: "center",
      marginBottom: 50,
    },
    body: {
      flex: 1,
      top: -30,
      backgroundColor: "white",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    titleBody: {
      color: "black",
      fontSize: 20,
      fontWeight: "bold",
      marginTop: 20,
      marginLeft: 15,
    },

    // List
    list: {
      marginTop: 15,
      marginBottom: 15,
      marginLeft: 15,
      flexDirection: "row",
      alignItems: "center",
    },
    listImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
    },
    listContent: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginLeft: 10,
    },
    listText: {
      flex: 1,
      overflow: "hidden",
      minWidth: 0,
    },
    listPrice: {
      fontWeight: "600",
      fontSize: 14,
      color: "#4CAF50",
    },

    buttonAddCredit: {
      marginBottom: 60,
      borderRadius: 10,
      marginHorizontal: 15,
      paddingVertical: 20,
      backgroundColor: Colors.light.tint,
      alignItems: "center",
    },
    closeInfo: {
      borderRadius: 10,
      marginHorizontal: 15,
      paddingVertical: 20,
      backgroundColor: Colors.light.tint,
      alignItems: "center",
    },

    textButtonAddCredit: {
      color: "#fff",
      fontSize: 16,
    },

    modalAddCreditContainer: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalAddCreditContent: {
      backgroundColor: "white",
      borderRadius: 10,
      padding: 20,
      margin: 15,
      paddingTop: 50,
      maxHeight: "85%",
    },
    closeButtonAddCredit: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: Colors.light.tint,
      borderRadius: 20,
      padding: 10,
    },
    closeButtonTextAddCredit: {
      fontSize: 18,
      fontWeight: "bold",
      color: "white",
    },
    addCreditQuestion: {
      color: "black",
      marginHorizontal: 15,
      fontSize: 20,
      textAlign: "center",
      marginBottom: 15,
    },
    input: {
      height: 50,
      borderColor: "transparent",
      borderWidth: 2,
      borderRadius: 10,
      paddingHorizontal: 10,
      marginHorizontal: 15,
      marginBottom: 20,
      backgroundColor: "#f0f0f0",
    },
    inputFocused: {
      borderColor: Colors.light.tint,
    },
    closeButton: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: Colors.light.tint,
      borderRadius: 20,
      padding: 8,
      zIndex: 1,
    },
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
      height: 500,
      backgroundColor: "white",
      borderRadius: 10,
      padding: 20,
      margin: 15,
    },
    modalButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#be9fbf",
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 20,
      marginBottom: 20,
      width: "100%",
      height: 70,
    },
    space: {
      height: 80,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingTop: 80,
    },
    emptyMessage: {
      textAlign: "center",
      color: "#999",
      fontSize: 15,
    },
    labelText: {
      fontSize: 14,
      flexShrink: 1,
    },

    valueText: {
      fontSize: 14,
    },
  });
  const [transactions, setTransactions] = useState([]);
  const [credit, setCredit] = useState(0);
  const [info, setInfo] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [isAddCredit, setIsAddCredit] = useState(false);
  const [modalinfoVisible, setModalInfoVisible] = useState(false);
  const [id, setId] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [adresse, setAdresse] = useState("");
  const [dateJoined, setDateJoined] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      GetData();
    }, [])
  );

  const slideAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    if (isAddCredit) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isAddCredit]);

  const getAllTransactions = async () => {
    const storage = await AsyncStorage.getItem("authToken");
    await fetch(BASE_URL + "/rides/driver/history", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + storage,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.Data["History"] != "") {
          setTransactions(
            [...data.Data["History"]].sort(
              (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
            )
          );
          setCredit(data.Data["Total Gains"]);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    getAllTransactions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await getAllTransactions();
    setRefreshing(false);
  };

  const showModalInfo = (id) => {
    setInfo(id);
    setModalInfoVisible(true);
  };
  const closeModalInfo = () => {
    setModalInfoVisible(false);
  };

  const GetData = async () => {
    const test = await AsyncStorage.getItem("Info");
    const data = JSON.parse(test);
    setId(data.Data.id);
    setUsername(data.Data.username);
    setEmail(data.Data.email);
    setFirstName(data.Data.first_name);
    setLastName(data.Data.last_name);
    setPhoneNumber(data.Data.phone_number);
    setAdresse(data.Data.adresse);
    setDateJoined(data.Data.date_joined);
    setReferralCode(data.Data.referral_code);
    seturl(data.profile_picture);
  };
  const formatDate = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };
  const formatTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const hours = date.getUTCHours().toString().padStart(2, "0");
    const minutes = date.getUTCMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Libellé du mode de paiement (les noms de marque restent identiques en FR/EN)
  const paymentLabel = (mode) => {
    switch (mode) {
      case "orange_money":
        return "Orange Money";
      case "mtn_money":
        return "MTN Mobile Money";
      case "cash":
        return t("cash");
      default:
        return mode || "—";
    }
  };

  // Libellé du type de remise
  const discountTypeLabel = (type) => {
    switch (type) {
      case "first_ride":
        return t("hist_discount_first_ride");
      case "promo":
        return t("hist_discount_promo");
      case "referral":
      case "referral_reward":
        return t("hist_discount_referral_reward");
      default:
        return type || "";
    }
  };

  // Durée lisible à partir d'un nombre de secondes (ex. "5 min 12 s", "47 s")
  const formatSeconds = (seconds) => {
    if (seconds == null || isNaN(seconds)) return "";
    const total = Math.round(Number(seconds));
    const m = Math.floor(total / 60);
    const s = total % 60;
    if (m <= 0) return `${s} s`;
    return `${m} min ${s.toString().padStart(2, "0")} s`;
  };
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t("history")}</Text>
          {url ? (
            <Image style={styles.headerImage} source={{ uri: url }} />
          ) : (
            <Image
              style={styles.headerImage}
              source={require("../assets/images/profile.jpg")}
            />
          )}
          <Text style={styles.headerText}>
            {firstName} {lastName}
          </Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={{ color: "white", fontSize: 20 }}>
            {t("total_earnings")}
          </Text>
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 30 }}>
            {Number(credit).toLocaleString("fr-FR")} F CFA
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.titleBody}>{t("history")}</Text>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.tint]} />
          }
        >
          {transactions.length > 0 ? (
            transactions.map((transaction) => (
                <TouchableOpacity
                  key={transaction.id}
                  style={styles.list}
                  onPress={() => showModalInfo(transaction)}
                >
                  {transaction.image_profile ? (
                    <Image
                      style={styles.listImage}
                      source={{ uri: transaction.image_profile }}
                    />
                  ) : (
                    <Image
                      style={styles.listImage}
                      source={require("../assets/images/profile.jpg")}
                    />
                  )}
                  <View style={styles.listContent}>
                    <View style={styles.listText}>
                      <Text
                        style={{ fontWeight: "700", fontSize: 16 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {transaction.full_name}
                      </Text>
                      <Text
                        style={{
                          fontWeight: "300",
                          fontSize: 14,
                          color: "#A3A3A3",
                        }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {transaction.ride_date || formatDate(transaction.accepted_time)}
                      </Text>
                    </View>
                    <Text style={styles.listPrice}>
                      {Number(transaction.final_price).toLocaleString("fr-FR")} F CFA
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyMessage}>{t("no_transactions")}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.space} />
      </View>
      <Modal
        animationType="none"
        transparent={true}
        visible={modalinfoVisible}
        onRequestClose={closeModalInfo}
      >
        <View style={styles.modalAddCreditContainer}>
          <Animated.View style={styles.modalAddCreditContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerContent}>
              {info.image_profile ? (
                <Image
                  style={styles.headerImage}
                  source={{ uri: info.image_profile }}
                />
              ) : (
                <Image
                  style={styles.headerImage}
                  source={require("../assets/images/profile.jpg")}
                />
              )}
              <Text style={{ fontSize: 15, fontWeight: "bold" }}>
                {info.full_name}
              </Text>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                {info.ride_rating
                  ? [1, 2, 3, 4, 5].map((n) => (
                      <Icon
                        key={n}
                        source={n <= info.ride_rating ? "star" : "star-outline"}
                        size={16}
                        color="#FFC107"
                      />
                    ))
                  : (
                    <Text style={{ fontSize: 13, color: "#A3A3A3" }}>{t("hist_not_rated")}</Text>
                  )}
              </View>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "bold" }}>
              {t("info_title")}
            </Text>
            {info.discount_amount > 0 && (
              <>
                <View style={styles.infoContent}>
                  <Text style={styles.labelText}>{t("hist_gross_price")}</Text>
                  <Text style={styles.valueText}>{Number(info.gross_price).toLocaleString("fr-FR")} F CFA</Text>
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.labelText, { flex: 1 }]} numberOfLines={2}>
                    {t("hist_discount")}
                    {info.discount_percentage ? ` (-${info.discount_percentage}%)` : ""}
                    {info.discount_type ? ` · ${discountTypeLabel(info.discount_type)}` : ""}
                  </Text>
                  <Text style={[styles.valueText, { color: "#E53935" }]}>
                    -{Number(info.discount_amount).toLocaleString("fr-FR")} F CFA
                  </Text>
                </View>
                {info.promo_code ? (
                  <View style={styles.infoContent}>
                    <Text style={styles.labelText}>{t("hist_promo_code")}</Text>
                    <Text style={styles.valueText}>{info.promo_code}</Text>
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.infoContent}>
              <Text style={styles.labelText}>{t("price_course")}</Text>
              <Text style={[styles.valueText, { fontWeight: "700", color: "#4CAF50" }]}>{Number(info.final_price).toLocaleString("fr-FR")} F CFA</Text>
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.labelText}>{t("mode_of_payments")}</Text>
              <Text style={styles.valueText}>{paymentLabel(info.mode_of_payments)}</Text>
            </View>
            <View style={styles.infoContent}>
              <Text>Date</Text>
              <Text>{info.ride_date || formatDate(info.accepted_time)}</Text>
            </View>
            {!info.ride_date && (
              <View style={styles.infoContent}>
                <Text>{t("heure")}</Text>
                <Text>{formatTime(info.accepted_time)}</Text>
              </View>
            )}
            <View style={styles.infoContent}>
              <Text>{t("distance")}</Text>
              <Text style={styles.valueText}>{info.distance} km</Text>
            </View>
            {info.duration_seconds != null ? (
              <View style={styles.infoContent}>
                <Text>{t("duration")}</Text>
                <Text style={styles.valueText}>{formatSeconds(info.duration_seconds)}</Text>
              </View>
            ) : !!info.duration_minutes && (
              <View style={styles.infoContent}>
                <Text>{t("duration")}</Text>
                <Text style={styles.valueText}>{Math.round(info.duration_minutes)} min</Text>
              </View>
            )}
            {info.waiting_seconds != null && (
              <View style={styles.infoContent}>
                <Text>{t("hist_waiting_time")}</Text>
                <Text style={styles.valueText}>{formatSeconds(info.waiting_seconds)}</Text>
              </View>
            )}
            <Text style={{ fontSize: 15, fontWeight: "bold", marginTop: 20, paddingHorizontal: 12 }}>Trajet</Text>
            <View style={styles.infoContent}>
              <Icon source="directions" size={16} color="#4CAF50" />
              <Text style={[styles.labelText, { flex: 1, marginLeft: 6 }]} numberOfLines={2} ellipsizeMode="tail">{info.start_location}</Text>
            </View>
            <View style={styles.infoContent}>
              <Icon source="map-marker" size={16} color={Colors.light.tint} />
              <Text style={[styles.labelText, { flex: 1, marginLeft: 6 }]} numberOfLines={2} ellipsizeMode="tail">{info.end_location}</Text>
            </View>

            <TouchableOpacity
              style={[styles.closeInfo, { marginTop: "10%" }]}
              onPress={closeModalInfo}
            >
              <Text style={styles.textButtonAddCredit}>{t("close")}</Text>
            </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
