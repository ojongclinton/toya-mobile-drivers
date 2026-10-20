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
  TextInput,
  Alert,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useEffect, useRef, useState } from "react";
import BASE_URL from "@/constants/api/BASE_URL";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import React from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "react-native-paper";

const TX_TYPE_KEYS: Record<string, string> = {
  deposit:              "deposit",
  ride_earning:         "tx_ride_earning",
  referral_bonus:       "tx_referral_bonus",
  admin_credit:         "tx_admin_credit",
  discount_subsidy:     "tx_discount_subsidy",
  commission_deduction: "tx_commission_deduction",
  subscription_fee:     "tx_subscription_fee",
  penalty:              "tx_penalty",
  admin_debit:          "tx_admin_debit",
};

const TX_STATUS_KEYS: Record<string, string> = {
  pending:   "tx_status_pending",
  completed: "tx_status_completed",
  failed:    "tx_status_failed",
};

const resolveTxLabel = (type: string, fallback: string, t: (k: string) => string): string =>
  TX_TYPE_KEYS[type] ? t(TX_TYPE_KEYS[type]) : (fallback || type);

const resolveTxStatus = (status: string, t: (k: string) => string): string =>
  TX_STATUS_KEYS[status] ? t(TX_STATUS_KEYS[status]) : status;

export default function Wallet({ navigation }: { navigation: any }) {
  const [url, seturl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { t, i18n } = useTranslation();
  const [focusedInput, setFocusedInput] = useState("");

  const formatTxDate = (raw: string | undefined, mode: "date" | "time" | "full" = "full"): string => {
    if (!raw) return "";
    const MONTHS: Record<string, number> = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
    };
    const match = raw.match(/^(\d{1,2})\s(\w{3})\s(\d{4}),\s(\d{2}):(\d{2})/);
    const d = match
      ? new Date(Number(match[3]), MONTHS[match[2]] ?? 0, Number(match[1]), Number(match[4]), Number(match[5]))
      : new Date(raw);
    if (isNaN(d.getTime())) return raw;
    const locale = i18n.language.startsWith("fr") ? "fr-FR" : "en-GB";
    if (mode === "date") return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    if (mode === "time") return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  };
  
  // ✅ NOUVEAUX STATES pour WebSocket
  const [paymentStatus, setPaymentStatus] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ NOUVEAU STATE pour le refresh
  const [refreshing, setRefreshing] = useState(false);

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
      flex: 1,
      alignItems: "center",
      marginTop: 25,
    },
    infoContent: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 50,
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
      justifyContent: "space-between",
    },
    titleBody: {
      color: "black",
      fontSize: 20,
      fontWeight: "bold",
      marginTop: 20,
      marginLeft: 15,
    },
    list: {
      marginTop: 15,
      marginLeft: 15,
      flexDirection: "row",
      alignItems: "center",
    },
    listImage: {
      width: 50,
      height: 50,
    },
    listText: {
      marginLeft: 15,
    },
    buttonAddCredit: {
      marginBottom: 60,
      borderRadius: 10,
      marginHorizontal: 15,
      paddingVertical: 20,
      backgroundColor: Colors.light.tint,
      alignItems: "center",
    },
    buttonAddCredi: {
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
      fontSize: 18,
      fontWeight: "bold",
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
    },
    closeButtonAddCredit: {
      position: "absolute",
      top: 10,
      right: 10,
      backgroundColor: Colors.light.tint,
      borderRadius: 20,
      padding: 10,
      zIndex: 10,
    },
    closeButtonTextAddCredit: {
      fontSize: 18,
      fontWeight: "bold",
      color: "white",
    },
    addCreditQuestion: {
      paddingTop: "20%",
      color: "black",
      marginHorizontal: 15,
      fontSize: 20,
      textAlign: "center",
      marginBottom: 15,
    },
    closeButton: {
      position: "absolute",
      top: 10,
      right: 10,
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
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      padding: 15,
    },
    modalContent: {
      backgroundColor: "white",
      borderRadius: 10,
      padding: 20,
      elevation: 5,
      position: "relative",
    },
    title: {
      color: "#333",
      fontSize: 20,
      textAlign: "center",
      marginBottom: 20,
      marginTop: 20,
    },
    input: {
      height: 50,
      borderWidth: 2,
      borderColor: "#f0f0f0",
      borderRadius: 10,
      paddingLeft: 15,
      paddingRight: 15,
      marginBottom: 15,
      backgroundColor: "#f8f8f8",
      fontSize: 16,
    },
    inputtext: {
      maxHeight: 150,
      borderWidth: 2,
      borderColor: "#f0f0f0",
      borderRadius: 10,
      paddingLeft: 15,
      paddingRight: 15,
      marginBottom: 15,
      backgroundColor: "#f8f8f8",
      fontSize: 16,
    },
    inputFocused: {
      borderColor: "#2e6ddf",
    },
    dropdown: {
      maxHeight: 150,
      borderRadius: 10,
      backgroundColor: "white",
      marginTop: -10,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: "#eee",
    },
    dropdownItem: {
      padding: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#eee",
    },
    errorText: {
      color: "red",
      marginBottom: 10,
      textAlign: "center",
    },
    addButton: {
      backgroundColor: "#2e6ddf",
      color: "white",
      padding: 15,
      borderRadius: 10,
      fontSize: 16,
      fontWeight: "bold",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      backgroundColor: "#f0f0f0",
      marginHorizontal: 5,
      marginBottom: 20,
      paddingHorizontal: 5,
    },
    prefix: {
      backgroundColor: "#f9fafb",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderTopLeftRadius: 8,
      borderBottomLeftRadius: 8,
    },
    prefixText: {
      color: "#6b7280",
      fontWeight: "bold",
    },
    phoneInput: {
      flex: 1,
      height: 50,
      paddingLeft: 10,
      fontSize: 16,
      color: "#333",
    },
    lista: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },
    listContent: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginLeft: 12,
    },
    listTexta: {
      flex: 1,
      overflow: "hidden",
      minWidth: 0,
    },
    listAmount: {
      fontSize: 14,
      fontWeight: "600",
      color: "#333",
      marginLeft: 10,
    },
    statusContainer: {
      backgroundColor: "#E3F2FD",
      padding: 15,
      borderRadius: 10,
      marginHorizontal: 15,
      marginBottom: 15,
      borderLeftWidth: 4,
      borderLeftColor: "#2196F3",
    },
    statusText: {
      fontSize: 14,
      color: "#1976D2",
      textAlign: "center",
      fontWeight: "600",
    },
    checkStatusButton: {
      marginTop: 10,
      padding: 12,
      backgroundColor: "#E3F2FD",
      borderRadius: 8,
      marginHorizontal: 15,
    },
    checkStatusText: {
      color: "#2196F3",
      textAlign: "center",
      fontWeight: "600",
    },

    // Ligne de transaction
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: "#F0F0F0",
    },
    txIcon: {
      width: 40,
      height: 40,
      marginRight: 12,
    },
    txMiddle: {
      flex: 1,
      marginRight: 8,
    },
    txDesc: {
      fontSize: 14,
      fontWeight: "600",
      color: "#222",
      marginBottom: 2,
    },
    txDate: {
      fontSize: 12,
      color: "#999",
    },
    txAmount: {
      fontSize: 15,
      fontWeight: "700",
    },

    // Modal détail transaction
    txModalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    txModalCard: {
      backgroundColor: "white",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
    },
    txModalTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#555",
      textAlign: "center",
      marginBottom: 8,
    },
    txModalAmount: {
      fontSize: 32,
      fontWeight: "bold",
      textAlign: "center",
      marginBottom: 16,
    },
    txModalDivider: {
      height: 1,
      backgroundColor: "#F0F0F0",
      marginBottom: 16,
    },
    txModalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
      gap: 12,
    },
    txModalLabel: {
      fontSize: 13,
      color: "#999",
      fontWeight: "500",
      minWidth: 90,
    },
    txModalValue: {
      fontSize: 13,
      color: "#222",
      fontWeight: "600",
    },
    txStatusBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
    },
    txModalCloseBtn: {
      marginTop: 8,
      backgroundColor: Colors.light.tint,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    txModalCloseTxt: {
      color: "white",
      fontWeight: "700",
      fontSize: 15,
    },
  });

  const [errorMessage, setErrorMessage] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [credit, setCredit] = useState(0);
  const [inputCredit, setInputCredit] = useState("");
  const [info, setInfo] = useState("");
  const [isAddCredit, setIsAddCredit] = useState(false);
  const [message, setMessage] = useState("");
  const [tokens, setTokens] = useState("");
  const [id, setId] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [adresse, setAdresse] = useState("");
  const [dateJoined, setDateJoined] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [modalinfoVisible, setModalInfoVisible] = useState(false);
  const [options, setoptions] = useState<string[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [txModalVisible, setTxModalVisible] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      GetData();
      getAllTransactions();
      getAllnumberphone();
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

  useEffect(() => {
    return () => {
      disconnectWebSocket();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // ✅ NOUVELLE FONCTION: Rafraîchir les données
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await getAllTransactions();
    } catch (error) {
      // console.error("Erreur lors du rafraîchissement:", error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const getAllTransactions = async () => {
    const storage = await AsyncStorage.getItem("authToken");
    try {
      const response = await fetch(BASE_URL + "/payments/wallet/history", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      const data = await response.json();
      const payload = data.Data ?? data;

      if (Array.isArray(payload.transactions)) {
        setTransactions(payload.transactions);
        setCredit(payload.current_balance ?? 0);
      } else if (Array.isArray(payload["All Transactions Wallet"])) {
        setTransactions([...payload["All Transactions Wallet"]].reverse());
        setCredit(payload["All Gain"] ?? 0);
      }
    } catch (error) {
      // console.error("Erreur wallet history:", error);
    }
  };

  const getAllnumberphone = async () => {
    const storage = await AsyncStorage.getItem("authToken");
    await fetch(BASE_URL + "/payments/wallet/manage-payment-numbers/", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + storage,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        const tabletoformat = data.Data["Payment Phone Numbers"];
        const phoneNumbers = tabletoformat.map((item: any) => item.phone_number);
        setoptions(phoneNumbers);
      })
      .catch((error) => {
        // console.error("Erreur lors de la requete HTTP : " + error.message);
      });
  };

  const showAddCredit = () => {
    setIsAddCredit(true);
    setPaymentStatus("");
    setTransactionId("");
  };

  const closeAddCredit = () => {
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsAddCredit(false);
      setPaymentStatus("");
      disconnectWebSocket();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    });
  };

  const showModalInfo = (id: string) => {
    setInfo(id);
    setModalInfoVisible(true);
  };

  const closeModalInfo = () => {
    setModalInfoVisible(false);
  };

  const validatePhoneNumber = (phoneNumber: string) => {
    const phoneRegex = /^\+237\d{9}$/;
    return phoneRegex.test(phoneNumber);
  };

  const addNewNumberphone = async (value: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const storage = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + "/payments/wallet/add-payment-phone-number/", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ phone_number: value }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        options.push(value);
      }
    } catch {
      clearTimeout(timeoutId);
      Alert.alert(t("connection_error"));
    }
  };

  const detectOperator = (phoneNumber: string) => {
    const cleaned = phoneNumber
      .replace(/\s+/g, "")
      .replace(/^(\+237|00237|237)/, "");

    const orangeRegex =
      /^(655|656|657|658|659|686|687|688|689|640|69[0-9])[0-9]{6}$/;
    const mtnRegex =
      /^(650|651|652|653|654|680|681|682|683|684|67[0-9])[0-9]{6}$/;
    
    if (orangeRegex.test(cleaned)) {
      return "orange_money";
    } else if (mtnRegex.test(cleaned)) {
      return "mtn_money";
    } else {
      return null;
    }
  };

  const connectWebSocket = (txId: string, userId: string) => {
    try {
      let wsUrl = BASE_URL;
      
      if (wsUrl.includes('/api')) {
        wsUrl = wsUrl.replace('/api', '');
      }
      
      wsUrl = wsUrl.replace("http://", "ws://").replace("https://", "wss://");
      
      const wsEndpoint = `${wsUrl}/ws/payment/status/${txId}/${userId}/`;
      
      // console.log("🔌 Connexion WebSocket:", wsEndpoint);
      
      wsRef.current = new WebSocket(wsEndpoint);

      wsRef.current.onopen = () => {
        // console.log("✅ WebSocket connecté");
        setWsConnected(true);
        setPaymentStatus(t("ws_connected") || "Connecté. En attente de confirmation...");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // console.log("📨 Message WebSocket reçu:", data);

          const status = data.status?.status || data.status;
          
          if (status === "SUCCESS") {
            setPaymentStatus(t("payment_success") || "Paiement réussi !");
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            
            Alert.alert(
              t("success") || "Succès",
              t("wallet_recharged") || "Votre portefeuille a été rechargé avec succès !",
              [
                {
                  text: "OK",
                  onPress: () => {
                    closeAddCredit();
                    getAllTransactions();
                  },
                },
              ]
            );
            
            disconnectWebSocket();
          } else if (status === "FAILED" || status === "ERRORED" || status === "EXPIRED") {
            const terminalTitle = status === "EXPIRED"
              ? t("payment_expired") || "Demande de recharge expirée"
              : t("payment_failed") || "Paiement échoué";
            const errorMsg = data.status?.failure_message ||
                           data.status?.message?.fr?.message_fr ||
                           data.status?.message?.en?.message_en || 
                           terminalTitle;
            
            setPaymentStatus(terminalTitle);
            setIsLoading(false);
            
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            
            Alert.alert(
              terminalTitle,
              errorMsg
            );
            
            disconnectWebSocket();
          } else if (status === "PENDING") {
            setPaymentStatus(t("payment_pending") || "Paiement en attente de confirmation...");
          }
        } catch (error) {
          // console.error("❌ Erreur parsing WebSocket:", error);
        }
      };

      wsRef.current.onerror = (error) => {
        // console.error("❌ Erreur WebSocket:", error);
        setWsConnected(false);
        startPollingStatus(txId);
      };

      wsRef.current.onclose = () => {
        // console.log("🔌 WebSocket déconnecté");
        setWsConnected(false);
      };
    } catch (error) {
      // console.error("❌ Erreur connexion WebSocket:", error);
      startPollingStatus(txId);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  const startPollingStatus = (txId: string) => {
    // console.log("🔄 Démarrage du polling (fallback)");
    setPaymentStatus(t("checking_status") || "Vérification du statut...");
    
    pollIntervalRef.current = setInterval(() => {
      checkPaymentStatus(txId);
    }, 20000) as unknown as NodeJS.Timeout;
  };

  const checkPaymentStatus = async (txId?: string) => {
    try {
      const storage = await AsyncStorage.getItem("authToken");
      const checkTxId = txId || transactionId;
      
      if (!checkTxId) return;

      const response = await fetch(
        `${BASE_URL}/payments/wallet/check-status?transaction_id=${checkTxId}`,
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + storage,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      // console.log("🔍 Statut vérifié:", data);

      if (data.status === "SUCCESS") {
        setIsLoading(false);
        setPaymentStatus(t("payment_success") || "Paiement réussi !");
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        
        Alert.alert(
          t("success") || "Succès",
          t("wallet_recharged") || "Votre portefeuille a été rechargé avec succès !",
          [
            {
              text: "OK",
              onPress: () => {
                closeAddCredit();
                getAllTransactions();
              },
            },
          ]
        );
      } else if (data.status === "FAILED" || data.status === "EXPIRED") {
        const terminalTitle = data.status === "EXPIRED"
          ? t("payment_expired") || "Demande de recharge expirée"
          : t("payment_failed") || "Paiement échoué";
        setIsLoading(false);
        setPaymentStatus(terminalTitle);
        
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        
        Alert.alert(
          terminalTitle,
          data.details?.failure_message || t("try_again") || "Veuillez réessayer."
        );
      } else {
        setPaymentStatus(t("payment_pending") || "Paiement toujours en attente...");
      }
    } catch (error) {
      // console.error("❌ Erreur vérification statut:", error);
    }
  };

  const addCredit = async () => {
    setIsLoading(true);
    setPaymentStatus("");
    
    var nbphone = "+237" + inputValue;
    const isNumberInList = options.includes(nbphone);

    if (!isNumberInList) {
      if (!validatePhoneNumber(nbphone)) {
        setErrorMessage(t("putPlus"));
        setTimeout(() => {
          setErrorMessage("");
        }, 1500);
        setIsLoading(false);
        return;
      } else {
        await addNewNumberphone(nbphone);
      }
    }

    if (parseFloat(inputCredit) < 2000) {
      setErrorMessage(t("minamout"));
      setIsLoading(false);
      setTimeout(() => {
        setErrorMessage("");
      }, 1500);
      return;
    }

    const operator = detectOperator(nbphone);
    
    if (!operator) {
      setErrorMessage(t("invalid_operator") || "Opérateur non détecté");
      setIsLoading(false);
      setTimeout(() => {
        setErrorMessage("");
      }, 1500);
      return;
    }

    // console.log("💰 Initiation du paiement:", {
    //   operator,
    //   amount: parseFloat(inputCredit),
    //   phone: nbphone,
    // });

    try {
      const storage = await AsyncStorage.getItem("authToken");
      
      const response = await fetch(BASE_URL + "/payments/wallet/make-deposit", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          amount: parseFloat(inputCredit),
          payment_method: operator,
          phone_number: nbphone,
        }),
      });

      const data = await response.json();

      if (response.ok && data.data?.transaction_id) {
        const txId = data.data.transaction_id;
        setTransactionId(txId);
        
        setInputCredit("");
        setInputValue("");
        
        setPaymentStatus(
          t("payment_initiated") || 
          "Paiement initié. Veuillez vérifier votre téléphone pour confirmer."
        );
        
        Alert.alert(
          t("payment_initiated_title") || "Paiement initié",
          t("payment_initiated_msg") || 
          "Veuillez vérifier votre téléphone pour le prompt USSD et entrer votre PIN pour compléter le paiement.",
          [{ text: "OK" }]
        );

        connectWebSocket(txId, id);
        
        setIsLoading(false);
      } else {
        throw new Error(data.Message || "Échec de l'initiation du paiement");
      }
    } catch (error) {
      setIsLoading(false);
      // console.error("❌ Erreur initiation paiement:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : t("network_error") || "Erreur réseau. Veuillez réessayer."
      );
      
      setTimeout(() => {
        setErrorMessage("");
      }, 3000);
    }
  };

  const GetData = async () => {
    try {
      const test = await AsyncStorage.getItem("Info");
      const data = JSON.parse(test ?? "{}");
      // data.Data peut être absent (Info partiel/ancien format) → fallback {}
      // pour ne pas crasher sur l'accès aux propriétés.
      const info = data.Data ?? {};
      setMessage(data.Message);
      setTokens(data.Tokens);
      setId(info.id);
      setUsername(info.username);
      setEmail(info.email);
      setFirstName(info.first_name);
      setLastName(info.last_name);
      setPhoneNumber(info.phone_number);
      setAdresse(info.adresse);
      setDateJoined(info.date_joined);
      setReferralCode(info.referral_code);
      seturl(data.profile_picture);
    } catch {
      // Info absent ou JSON malformé → on n'affiche simplement rien de plus.
    }
  };

  const handleInputChange = (text: string) => {
    let cleanValue = text.replace(/\D/g, "");
    if (cleanValue.length > 9) {
      cleanValue = cleanValue.slice(0, 9);
    }
    setInputValue(cleanValue);
    setDropdownVisible(true);
  };

  const handleOptionSelect = (option: string) => {
    const cleanedOption = option.startsWith("+237")
      ? option.replace("+237", "")
      : option;

    setInputValue(cleanedOption.trim());
    setDropdownVisible(false);
  };

  const formattedNumber = inputValue
    ? inputValue.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3")
    : "";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{t("wallet")}</Text>
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
            {t("total_balance")}
          </Text>
          <Text style={{ color: "white", fontWeight: "bold", fontSize: 30 }}>
            {Number(credit).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-GB")} F CFA
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.titleBody}>{t("transactions")}</Text>

        {/* ✅ AJOUT du RefreshControl */}
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.tint]} // Android
              tintColor={Colors.light.tint} // iOS
            />
          }
        >
          {transactions.length > 0 ? (
            transactions.map((tx) => {
              const isCredit = tx.sign === "+";
              const date = formatTxDate(tx.timestamp, "date");
              const time = formatTxDate(tx.timestamp, "time");
              return (
                <TouchableOpacity
                  key={tx.id}
                  style={styles.txRow}
                  onPress={() => { setSelectedTx(tx); setTxModalVisible(true); }}
                  activeOpacity={0.7}
                >
                  {/* Logo Toya */}
                  <Image
                    source={require("../assets/images/toyalogo.png")}
                    style={styles.txIcon}
                    resizeMode="contain"
                  />

                  {/* Description + date */}
                  <View style={styles.txMiddle}>
                    <Text style={styles.txDesc} numberOfLines={1} ellipsizeMode="tail">
                      {resolveTxLabel(tx.transaction_type, tx.description, t)}
                    </Text>
                    <Text style={styles.txDate}>{date}  {time}</Text>
                  </View>

                  {/* Montant coloré */}
                  <Text style={[styles.txAmount, { color: isCredit ? "#2E7D32" : "#C62828" }]}>
                    {isCredit ? "+" : "-"}{Number(tx.amount).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-GB")} F CFA
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={{ alignItems: "center", paddingTop: 80 }}>
              <Text style={{ textAlign: "center", color: "#999", fontSize: 15 }}>
                {t("no_transactions")}
              </Text>
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.buttonAddCredit}
          onPress={showAddCredit}
        >
          <Text style={styles.textButtonAddCredit}>
            {t("add_funds_button")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal détail transaction */}
      <Modal
        animationType="slide"
        transparent
        visible={txModalVisible}
        onRequestClose={() => setTxModalVisible(false)}
      >
        <View style={styles.txModalOverlay}>
          <View style={styles.txModalCard}>
            {selectedTx && (() => {
              const isCredit = selectedTx.sign === "+";
              return (
                <>
                  {/* Logo Toya */}
                  <Image
                    source={require("../assets/images/toyalogo.png")}
                    style={{ width: 56, height: 56, alignSelf: "center", marginBottom: 10 }}
                    resizeMode="contain"
                  />

                  <Text style={styles.txModalTitle}>
                    {resolveTxLabel(selectedTx.transaction_type, selectedTx.description, t)}
                  </Text>

                  <Text style={[styles.txModalAmount, { color: isCredit ? "#2E7D32" : "#C62828" }]}>
                    {isCredit ? "+" : "-"}{Number(selectedTx.amount).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-GB")} F CFA
                  </Text>

                  <View style={styles.txModalDivider} />

                  <View style={styles.txModalRow}>
                    <Text style={styles.txModalLabel}>{t("tx_date")}</Text>
                    <Text style={styles.txModalValue}>
                      {formatTxDate(selectedTx.timestamp, "full")}
                    </Text>
                  </View>

                  <View style={styles.txModalRow}>
                    <Text style={styles.txModalLabel}>{t("tx_status")}</Text>
                    <View style={[styles.txStatusBadge, {
                      backgroundColor: selectedTx.status === "completed" ? "#E8F5E9"
                        : selectedTx.status === "failed" ? "#FFEBEE"
                        : "#FFF3E0",
                    }]}>
                      <Text style={{
                        color: selectedTx.status === "completed" ? "#2E7D32"
                          : selectedTx.status === "failed" ? "#C62828"
                          : "#E65100",
                        fontSize: 12,
                        fontWeight: "600",
                      }}>
                        {resolveTxStatus(selectedTx.status, t)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.txModalRow}>
                    <Text style={styles.txModalLabel}>{t("balance_before")}</Text>
                    <Text style={styles.txModalValue}>{Number(selectedTx.balance_before).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-GB")} F CFA</Text>
                  </View>

                  <View style={styles.txModalRow}>
                    <Text style={styles.txModalLabel}>{t("balance_after")}</Text>
                    <Text style={styles.txModalValue}>{Number(selectedTx.balance_after).toLocaleString(i18n.language.startsWith("fr") ? "fr-FR" : "en-GB")} F CFA</Text>
                  </View>

                  {selectedTx.commission_percentage && (
                    <View style={styles.txModalRow}>
                      <Text style={styles.txModalLabel}>{t("commission")}</Text>
                      <Text style={styles.txModalValue}>{selectedTx.commission_percentage}</Text>
                    </View>
                  )}

                  {selectedTx.grade_name && (
                    <View style={styles.txModalRow}>
                      <Text style={styles.txModalLabel}>{t("grades_label")}</Text>
                      <Text style={styles.txModalValue}>{selectedTx.grade_name}</Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.txModalCloseBtn} onPress={() => setTxModalVisible(false)}>
                    <Text style={styles.txModalCloseTxt}>{t("close")}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        animationType="none"
        transparent={true}
        visible={isAddCredit}
        onRequestClose={closeAddCredit}
      >
        <KeyboardAvoidingView
          // Android gère déjà le clavier via softwareKeyboardLayoutMode:"resize".
          // "height" en plus provoquait un double redimensionnement → tremblement.
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalAddCreditContainer}
        >
          <Animated.View
            style={[
              styles.modalAddCreditContent,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Text style={styles.addCreditQuestion}>{t("payment")}</Text>

            {paymentStatus ? (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{paymentStatus}</Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.input,
                focusedInput === "input1" && styles.inputFocused,
              ]}
              placeholder={t("amount")}
              placeholderTextColor="#999"
              onFocus={() => setFocusedInput("input1")}
              onBlur={() => setFocusedInput("")}
              onChangeText={(text) => {
                if (/^\d*$/.test(text)) {
                  setInputCredit(text);
                }
              }}
              value={inputCredit}
              keyboardType="numeric"
              editable={!isLoading && !transactionId}
            />

            <View
              style={[
                styles.inputWrapper,
                focusedInput === "phone" && styles.inputFocused,
              ]}
            >
              <View style={styles.prefix}>
                <Text style={styles.prefixText}>+237</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                value={formattedNumber}
                onChangeText={handleInputChange}
                placeholder="XXX XXX XXX"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                onFocus={() => setFocusedInput("phone")}
                onBlur={() => setFocusedInput("")}
                editable={!isLoading && !transactionId}
              />
            </View>

            {dropdownVisible && !transactionId && (
              <FlatList
                style={styles.inputtext}
                data={options.filter((option) =>
                  option.toLowerCase().includes(inputValue.toLowerCase())
                )}
                keyExtractor={(item, index) => index.toString()}
                keyboardShouldPersistTaps="always"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.dropdownItem}
                    onPress={() => handleOptionSelect(item)}
                  >
                    <Text>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            {errorMessage ? (
              <Text
                style={{ color: "red", marginBottom: 10, marginHorizontal: 15 }}
              >
                {errorMessage}
              </Text>
            ) : null}

            {!transactionId ? (
              <TouchableOpacity
                style={styles.buttonAddCredi}
                disabled={isLoading}
                onPress={addCredit}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.textButtonAddCredit}>{t("pay")}</Text>
                )}
              </TouchableOpacity>
            ) : (
              <></>
            )}
            <TouchableOpacity
              onPress={closeAddCredit}
              style={styles.closeButtonAddCredit}
            >
              <Icon source="close" size={24} color="white" />
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
