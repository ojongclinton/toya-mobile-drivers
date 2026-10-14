import BASE_URL from "@/constants/api/BASE_URL";
import WS_BASE_URL from "@/constants/api/WS_BASE_URL";
import React, { useState, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Modal,
  ScrollView,
  Button,
} from "react-native";
import { useTranslation } from "react-i18next";

function Validatiopot({ navigation }: { navigation: any }) {
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(60);
  const [transactionEchouee, setTransactionEchouee] = useState(false);
  const [Finish, setFinish] = useState(false);
  const [message, setmessage] = useState("");
  const ws = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (ws.current) {
            ws.current.close();
          }
          setFinish(true);
          navigation.navigate("wallet");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    Connecttoweb();

    return () => clearInterval(timer);
  }, []);

  const Connecttoweb = async () => {
    const deposite = await AsyncStorage.getItem("deposite");
    const idchauffeur = await AsyncStorage.getItem("userId");
    const wsUrl = `${WS_BASE_URL}/ws/payment/status/${deposite}/${idchauffeur}/`;

    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {};

    ws.current.onerror = () => {};

    ws.current.onclose = () => {};

    ws.current.onmessage = async (event) => {
      try {
        const parsedData = JSON.parse(event.data);
        const language = (await AsyncStorage.getItem("language")) || "fr";

        if (parsedData.status.status === "SUCCESS") {
          setFinish(true);
          setCountdown(0);
        } else if (parsedData.status.status === "PENDING") {
          const message =
            parsedData.status.message[language][`message_${language}`];
          const solution =
            parsedData.status.message[language][`solution_${language}`];
          setmessage(`${message}`);
          setModalVisible(true);
        } else if (parsedData.status.status === "FAILED") {
          const message =
            parsedData.status.message[language][`message_${language}`];
          const solution =
            parsedData.status.message[language][`solution_${language}`];
          setmessage(`${message}\n\n${solution}`);
          setTransactionEchouee(true);
          setModalVisible(true);
        }
      } catch {
        // silently ignore
      }
    };
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.mainContent}>
        <Text style={styles.title}>TOYA</Text>

        {transactionEchouee ? (
          <>
            <Text style={styles.subtitle}>{t("teansactionechoue")}</Text>
            <Text style={styles.description}>{message}</Text>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              {t("titletransactioninitialise")}
            </Text>
            <Text style={styles.description}>{message}</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.verifyButton}
        onPress={() => {
          if (transactionEchouee || Finish) {
            navigation.navigate("wallet");
          }
        }}
      >
        <Text style={styles.buttonText}>
          {transactionEchouee
            ? t("tryaigin")
            : `${t("verifyAccountIn")} (${countdown}s)`}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingBottom: 20,
  },
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#7B68EE",
    marginBottom: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  description: {
    color: "#666",
    textAlign: "center",
    marginBottom: 48,
    lineHeight: 24,
  },
  verifyButton: {
    backgroundColor: "#7B68EE",
    width: "100%",
    padding: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "500",
    fontSize: 16,
  },
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
  messageText: {
    marginBottom: 20,
    fontSize: 16,
  },
});

export default Validatiopot;
