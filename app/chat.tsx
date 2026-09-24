import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  Animated,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "@/constants/Colors";
import BASE_URL from "@/constants/api/BASE_URL";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/app/services/api/http";
import { useTranslation } from "react-i18next";
import CONVERSATION_URL from "@/constants/api/CONVERSATION_URL";
import { Icon } from "react-native-paper";
import { useFocusEffect } from "expo-router";

// Interface pour la structure de la nouvelle API
interface Conversation {
  conversation_id: string;
  ride_id: string;
  ride_status: string;
  other_user: {
    user_id: string;
    user_type: string;
    full_name: string;
    profile_picture: string;
  };
  last_message: {
    text: string;
    timestamp: string;
    sender: "you" | "other";
  };
  unread_count: number;
}

export default function Chat({ navigation }: { navigation: any }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("Clients");

  const [modalinfoVisible, setModalInfoVisible] = useState(false);
  const [modalsupport, setmodalsupport] = useState(false);
  const [idduclient, setidduclient] = useState("");
  const [idride, setidride] = useState("");
  const [message, setmessage] = useState("");

  const [fistnameclient, setfirstnameclient] = useState("");
  const [lastnameclient, setlastnameclient] = useState("");
  const [fistnameChauf, setfirstnameChauf] = useState("");
  const [lastnameChauf, setlastnameChauf] = useState("");
  const [numeroclient, setnumeroclient] = useState("");
  const [photoclient, setphotoclient] = useState("");
  const [infochat, setinfochat] = useState<Conversation[]>([]);
  const [infotikets, setinfotikets] = useState([]);
  const [boolclientId, setistrueClientId] = useState(false);

  const [id, setId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSendingTicket, setIsSendingTicket] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  const ws = useRef<WebSocket | null>(null);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([getchattikets(), infoclient(), getchat()]);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getchattikets(), infoclient(), getchat()]);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Remonter le FAB au-dessus du clavier sur iOS
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', e => setKeyboardHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      GetData();
      getchat(); // Rafraîchir les conversations quand on revient sur l'écran
    }, [])
  );

  // ✅ Gestion de la connexion WebSocket
  useEffect(() => {
    if (idride && activeTab === "Clients") {
      if (ws.current) {
        ws.current.close();
      }

      const wsUrl = CONVERSATION_URL + `${idride}/`;
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        // console.log("✅ WebSocket connecté pour le client (chauffeur)");
      };

      ws.current.onerror = () => {};

      ws.current.onclose = () => {
        // console.log("🔌 WebSocket fermé");
      };
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [idride, activeTab]);

  const showModalInfo = () => {
    if (activeTab === "Clients") {
      setModalInfoVisible(true);
    } else {
      setmodalsupport(true);
    }
  };

  const closeModalInfo = () => {
    setModalInfoVisible(false);
  };

  const handleModalInfo = () => {
    sendMessage();
    setModalInfoVisible(false);
  };

  const closesupport = () => {
    setmodalsupport(false);
  };

  const GetData = async () => {
    try {
      const test = await AsyncStorage.getItem("Info");
      const idclient = await AsyncStorage.getItem("idclientcurentride");

      // console.log("📋 AsyncStorage - idclientcurentride:", idclient);

      if (idclient == null) {
        setistrueClientId(false);
      } else {
        setistrueClientId(true);
      }

      if (!test) return;
      const data = JSON.parse(test);
      if (!data?.Data) return;
      setfirstnameChauf(data.Data.first_name);
      setlastnameChauf(data.Data.last_name);
      setId(data.Data.id);
      
      // console.log("✅ User ID chauffeur chargé:", data.Data.id);
    } catch {
      // silently ignore
    }
  };

  const infoclient = async () => {
    try {
      const idclient = await AsyncStorage.getItem("idclientcurentride");
      const idride = await AsyncStorage.getItem("idride");
      
      // console.log("📋 idclientcurentride depuis AsyncStorage:", idclient);
      // console.log("📋 idride depuis AsyncStorage:", idride);
      
      setidduclient(idclient!);
      setidride(idride!);

      if (!idclient || idclient === "null") {
        return;
      }

      // console.log("✅ Info client - Client ID:", idclient);
      // console.log("✅ Info client - Ride ID:", idride);

      const storage = await AsyncStorage.getItem("authToken");

      const response = await fetch(
        BASE_URL + `/rides/driver/profile/${idclient}`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + storage,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const data = await response.json();
      // console.log("📥 Profil client:", data);

      if (!data?.Data) return;
      setfirstnameclient(data.Data.first_name);
      setlastnameclient(data.Data.last_name);
      setnumeroclient(data.Data.phone_number);
      setphotoclient(data.Data.profile_picture || "");
    } catch {
      // silently ignore
    }
  };

  const sendMessage = async () => {
    if (!ws.current) {
      alert("Connexion non établie");
      return;
    }

    if (ws.current.readyState !== WebSocket.OPEN) {
      alert("Connexion en cours, veuillez réessayer dans un instant");
      return;
    }

    if (!message.trim()) {
      return;
    }

    // console.log("=== 📤 ENVOI MESSAGE (CHAUFFEUR) ===");
    // console.log("Message:", message);
    // console.log("Mon ID (chauffeur):", id);
    // console.log("Client ID:", idduclient);
    // console.log("Ride ID:", idride);

    if (!idduclient || idduclient === "null") {
      alert("Erreur: Client ID manquant");
      return;
    }

    const payload = {
      message: message,
      sender_id: id,
      receiver_id: idduclient,
      rides_id: idride,
    };

    // console.log("📦 Payload:", JSON.stringify(payload, null, 2));

    try {
      ws.current.send(JSON.stringify(payload));
      setmessage("");
      // console.log("✅ Message envoyé avec succès");
      fetchData();
      showToast(t("message_sent_success"));
    } catch {
      alert("Erreur lors de l'envoi du message");
    }
  };

  const sendtikets = async () => {
    setIsSendingTicket(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const storage = await AsyncStorage.getItem("authToken");
      const payload = { issue_description: message };
      const response = await fetch(BASE_URL + "/support/driver/contact", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok) {
        setmodalsupport(false);
        setmessage("");
        fetchData();
        showToast(t("ticket_created_success"));
      } else {
        const errorBody = await response.text().catch(() => "(unreadable)");
        console.log("[sendtikets] réponse non-OK", "status:", response.status, "body:", errorBody);
        Alert.alert(t("connection_error"));
      }
    } catch (error) {
      clearTimeout(timeoutId);
      console.log("[sendtikets] exception catch", error);
      Alert.alert(t("connection_error"));
    } finally {
      setIsSendingTicket(false);
    }
  };

  const deleteTicket = (ticketId: string) => {
    Alert.alert(
      t("delete_ticket_title"),
      t("delete_ticket_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const res = await apiFetch(`/support/tickets/${ticketId}`, { method: "DELETE" });
              if (res.ok || res.status === 404) {
                setinfotikets((prev: any[]) => prev.filter((t: any) => (t.ticket_id ?? t.id) !== ticketId));
                showToast(t("ticket_deleted_success"));
              } else if (res.status === 403) {
                showToast(t("ticket_delete_forbidden"));
              }
            } catch {
              Alert.alert(t("connection_error"));
            }
          },
        },
      ]
    );
  };

  // ✅ NOUVEAU : Récupération des conversations avec la nouvelle structure API
  const getchat = async () => {
    try {
      const storage = await AsyncStorage.getItem("authToken");
      if (!storage) {
        return;
      }
      const conversationUrl = BASE_URL + `/conversation/all`;
      // console.log("📡 [getchat] Endpoint appelé:", conversationUrl);
      const response = await fetch(conversationUrl, {
        method: "GET",
        headers: {
          Authorization: "Bearer " + storage,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      // console.log("📡 [getchat] Status HTTP:", response.status);
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      // console.log("📥 [getchat] Réponse complète:", JSON.stringify(data, null, 2));
      
      // ✅ Stocker directement les données de la nouvelle structure
      if (data.Data && Array.isArray(data.Data)) {
        setinfochat(data.Data);
        console.log("[CHAT_DRIVER] Liste affichée:", data.Data.length, "conv —", JSON.stringify(data.Data[0]));
      } else {
        setinfochat([]);
      }
    } catch {
      setinfochat([]);
    }
  };

  const getchattikets = async () => {
    const storage = await AsyncStorage.getItem("authToken");
    await fetch(BASE_URL + `/support/driver/tickets`, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + storage,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
      .then(async (response) => {
        const text = await response.text();
        if (!response.ok) return;
        try {
          const data = JSON.parse(text);
          const tickets = data.Data || [];
          const sorted = [...tickets].sort((a: any, b: any) =>
            new Date(b.date || b.created_at || 0).getTime() -
            new Date(a.date || a.created_at || 0).getTime()
          );
          setinfotikets(sorted);
        } catch {
          // silently ignore
        }
      })
      .catch(() => {
        // silently ignore
      });
  };

  useEffect(() => {
    getchat();
  }, []);

  // ✅ Formater la date relative (ex: "il y a 5 min", "hier", etc.)
  const formatRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) {
      return "à l'instant";
    } else if (diffInMinutes < 60) {
      return `il y a ${diffInMinutes} min`;
    } else if (diffInHours < 24) {
      return `il y a ${diffInHours} h`;
    } else if (diffInDays === 1) {
      return "hier";
    } else if (diffInDays <= 3) {
      return `il y a ${diffInDays} jours`;
    } else {
      const day = String(messageDate.getDate()).padStart(2, "0");
      const month = String(messageDate.getMonth() + 1).padStart(2, "0");
      const year = messageDate.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  // ✅ Formater l'heure complète (pour l'affichage détaillé)
  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ✅ Supprimer une conversation
  const deleteConversation = async (ridesId: string) => {
    Alert.alert(
      t("delete_conversation_title"),
      t("delete_conversation_message"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("delete"),
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("authToken");
              const response = await fetch(BASE_URL + `/conversation/${ridesId}/delete`, {
                method: "DELETE",
                headers: {
                  Authorization: "Bearer " + token,
                  "Content-Type": "application/json",
                },
              });
              if (response.ok) {
                setinfochat((prev) => prev.filter((c) => c.ride_id !== ridesId));
              } else {
                Alert.alert(t("connection_error"));
              }
            } catch {
              Alert.alert(t("connection_error"));
            }
          },
        },
      ]
    );
  };

  // ✅ Supprimer toutes les conversations
  const deleteAllConversations = () => {
    setShowDeleteAllModal(true);
  };

  const confirmDeleteAll = async () => {
    setShowDeleteAllModal(false);
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + `/conversation/delete-all`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
      });
      if (response.ok) {
        setinfochat([]);
      } else {
        Alert.alert(t("connection_error"));
      }
    } catch {
      Alert.alert(t("connection_error"));
    }
  };

  // ✅ Ouvrir une conversation
  const handleChatPress = async (conversation: Conversation) => {
    if (!conversation?.other_user) return;
    if (conversation.ride_status === "completed") {
      showToast(t("chat_unavailable"), "error");
      return;
    }

    const enhancedItem = {
      conversation_id: conversation.conversation_id,
      ride_id: conversation.ride_id,
      ride_status: conversation.ride_status,
      driver_id: conversation.other_user.user_id,
      full_name: conversation.other_user.full_name,
      last_message: conversation.last_message,
      unread_count: conversation.unread_count,
    };

    // console.log("✅ Conversation à ouvrir:", JSON.stringify(enhancedItem, null, 2));

    const rootNav = navigation.getParent()?.getParent() ?? navigation.getParent() ?? navigation;
    rootNav.navigate("chatcontent", { paramName: enhancedItem });
  };

  const handleSupportPress = (item: any) => {
    // console.log("=== 🎫 OUVERTURE TICKET SUPPORT ===");
    // console.log("Ticket item:", JSON.stringify(item, null, 2));
    const rootNav = navigation.getParent()?.getParent() ?? navigation.getParent() ?? navigation;
    rootNav.navigate("chatcontent", { paramName: item });
  };

  // ✅ Rendu d'un ticket support
  const renderSupportItem = ({ item }: { item: any }) => {
    const isClosed = item.status === "closed" || item.status === "resolved";
    const statusConfig: Record<string, { label: string; bg: string; color: string }> = {
      open:        { label: t("status_open"),     bg: "#e6f4ea", color: "#2e7d32" },
      pending:     { label: t("status_pending"),  bg: "#fff3e0", color: "#e65100" },
      in_progress: { label: t("status_progress"), bg: "#e3f2fd", color: "#1565c0" },
      closed:      { label: t("status_closed"),   bg: "#f5f5f5", color: "#757575" },
      resolved:    { label: t("status_resolved"), bg: "#f5f5f5", color: "#757575" },
    };
    const st = statusConfig[item.status] ?? { label: item.status ?? "", bg: "#f5f5f5", color: "#757575" };
    return (
      <View style={styles.chatItem}>
        <TouchableOpacity style={styles.chatItemContent} onPress={() => handleSupportPress(item)}>
          <View style={styles.avatarContainer}>
            <View style={styles.supportAvatar}>
              <Icon source="headset" size={24} color="#fff" />
            </View>
          </View>
          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
                <Text style={[styles.name, { flex: 0 }]}>Support Toya</Text>
                {!!item.status && (
                  <View style={{ backgroundColor: st.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: st.color }}>{st.label}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.time}>{(() => {
                  const raw = item.date || item.created_at;
                  if (!raw) return "";
                  const d = new Date(raw);
                  if (isNaN(d.getTime())) return raw;
                  const locale = i18n.language.startsWith("fr") ? "fr-FR" : "en-GB";
                  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
                })()}</Text>
            </View>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.issue_description || "Ticket de support"}
            </Text>
          </View>
        </TouchableOpacity>
        {isClosed && (
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteTicket(item.ticket_id ?? item.id)}
          >
            <Icon source="trash-can-outline" size={20} color="#e53935" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const chats = activeTab === "Clients" ? infochat : infotikets;

  // ✅ Rendu d'un élément de conversation
  const renderChatItem = ({ item }: { item: Conversation }) => {
    const isCompleted = item.ride_status === "completed";
    const profilePicture = item.other_user?.profile_picture || "";
    const fullName = item.other_user?.full_name || "Inconnu";
    const lastMessage = item.last_message?.text || "Aucun message";
    const timestamp = item.last_message?.timestamp;
    const unreadCount = item.unread_count || 0;
    const isLastMessageFromMe = item.last_message?.sender === "you";

    const imageSource =
      profilePicture && profilePicture.trim() !== ""
        ? { uri: profilePicture }
        : require("../assets/images/profile.jpg");

    return (
      <View style={styles.chatItem}>
        <TouchableOpacity
          style={[styles.chatItemContent, isCompleted && { opacity: 0.4 }]}
          onPress={() => handleChatPress(item)}
        >
          <View style={styles.avatarContainer}>
            <Image style={styles.avatar} source={imageSource} />
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.name} numberOfLines={1}>
                {fullName}
              </Text>
              {timestamp && (
                <Text style={styles.time}>
                  {formatRelativeTime(timestamp)}
                </Text>
              )}
            </View>

            <View style={styles.messagePreview}>
              {isLastMessageFromMe && (
                <Text style={styles.messagePrefix}>Vous: </Text>
              )}
              <Text style={styles.lastMessage} numberOfLines={1}>
                {lastMessage}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => deleteConversation(item.ride_id)}
        >
          <Icon source="trash-can-outline" size={20} color="#e53935" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Titre Message sans fond violet */}
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>Message</Text>
      </View>

      {/* Section violette : Liste des chats + onglets */}
      <View style={styles.headerSection}>
        <View style={styles.headerSubRow}>
          <Text style={styles.headerSubText}>{t("chat_list")}</Text>
        </View>

        <View style={styles.tabsContainer}>
          <View style={styles.tabs}>
            <TouchableOpacity
              onPress={() => setActiveTab("Clients")}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Clients" && styles.activeTabText,
                ]}
              >
                Clients
              </Text>
              {activeTab === "Clients" && (
                <View style={styles.activeTabIndicator} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab("Support")}
              style={styles.tab}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Support" && styles.activeTabText,
                ]}
              >
                Support
              </Text>
              {activeTab === "Support" && (
                <View style={styles.activeTabIndicator} />
              )}
            </TouchableOpacity>
          </View>
          {activeTab === "Clients" && infochat.length >= 2 && (
            <TouchableOpacity style={styles.deleteAllBtn} onPress={deleteAllConversations}>
              <Icon source="trash-can-outline" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste des chats avec fond blanc */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
        </View>
      ) : chats && chats.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" }}>
          <Text style={{ fontSize: 16, color: "#888" }}>
            {activeTab === "Clients" ? t("no_client_chats") : t("no_support_tickets")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={chats}
          renderItem={activeTab === "Clients" ? renderChatItem : renderSupportItem}
          keyExtractor={(item, index) =>
            activeTab === "Clients"
              ? (item as Conversation).conversation_id || index.toString()
              : item.id?.toString() || index.toString()
          }
          contentContainerStyle={[styles.chatList, { paddingBottom: 120 }]}
          style={styles.chatListContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#6D56F2"]} />
          }
        />
      )}

      <Modal
        animationType="none"
        transparent={true}
        visible={modalinfoVisible}
        onRequestClose={closeModalInfo}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalAddCreditContainer} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={styles.modalAddCreditKAV}
          pointerEvents="box-none"
        >
          <Animated.View style={styles.modalAddCreditContent}>
            <View style={styles.headerContent}>
              <Image
                style={styles.headerImage}
                source={
                  photoclient && photoclient.trim() !== ""
                    ? { uri: photoclient }
                    : require("../assets/images/profile.jpg")
                }
              />
              <Text style={styles.modalHeaderText}>
                {fistnameclient} {lastnameclient}
              </Text>
            </View>
            <View style={styles.infoContent}>
              <Text>{numeroclient}</Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                marginTop: 20,
                marginBottom: 20,
              }}
            >
              Message
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("message_placeholder")}
              placeholderTextColor="#999"
              onChangeText={setmessage}
              value={message}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.closeInfo, { marginTop: "10%" }]}
              onPress={handleModalInfo}
            >
              <Text style={styles.textButtonAddCredit}>{t("send")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={closeModalInfo}
            >
              <Icon source="close" size={24} color="#333" />
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        animationType="none"
        transparent={true}
        visible={modalsupport}
        onRequestClose={closesupport}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalAddCreditContainer} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
          style={styles.modalAddCreditKAV}
          pointerEvents="box-none"
        >
          <Animated.View style={styles.modalAddCreditContent}>
            <View style={styles.headerContent}>
              <Image
                style={styles.toyaLogoModal}
                source={require("../assets/images/toyalogo.png")}
              />
              <Text style={styles.modalHeaderText}>{t("create_ticket")}</Text>
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "bold",
                marginTop: 20,
                marginBottom: 20,
              }}
            >
              Message
            </Text>
            <TextInput
              style={styles.input}
              placeholder={t("message_placeholder")}
              placeholderTextColor="#999"
              onChangeText={setmessage}
              value={message}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.closeInfo, { marginTop: "10%" }, isSendingTicket && { opacity: 0.7 }]}
              onPress={sendtikets}
              disabled={isSendingTicket}
            >
              {isSendingTicket
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.textButtonAddCredit}>{t("send")}</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={closesupport}>
              <Icon source="close" size={24} color="#333" />
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <TouchableOpacity
        style={[
          styles.newChatButton,
          activeTab === "Clients" && !boolclientId && { backgroundColor: "#ccc" },
          keyboardHeight > 0 && { bottom: keyboardHeight + 16 },
        ]}
        onPress={() => {
          if (activeTab === "Clients") {
            if (!idride || !idduclient) return;
            const rootNav = navigation.getParent()?.getParent() ?? navigation.getParent() ?? navigation;
            rootNav.navigate("chatcontent", {
              paramName: { ride_id: idride, driver_id: idduclient },
            });
          } else {
            setmodalsupport(true);
          }
        }}
        disabled={activeTab === "Clients" && !boolclientId}
      >
        <Icon source="message-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Toast notification */}
      <Animated.View
        style={[styles.toast, { opacity: toastOpacity, backgroundColor: toastType === "error" ? "#c62828" : "#2e7d32" }]}
        pointerEvents="none"
      >
        <Icon source={toastType === "error" ? "alert-circle" : "check-circle"} size={18} color="#fff" />
        <Text style={styles.toastText}>{toastMessage}</Text>
      </Animated.View>

      {/* Modal confirmation suppression toutes conversations */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showDeleteAllModal}
        onRequestClose={() => setShowDeleteAllModal(false)}
      >
        <View style={styles.confirmModalOverlay}>
          <View style={styles.confirmModalContent}>
            <Text style={styles.confirmModalTitle}>
              {t("delete_all_conversations_title")}
            </Text>
            <Text style={styles.confirmModalMessage}>
              {t("delete_all_conversations_message")}
            </Text>
            <View style={styles.confirmModalButtons}>
              <TouchableOpacity
                style={[styles.confirmModalBtn, styles.confirmCancelBtn]}
                onPress={() => setShowDeleteAllModal(false)}
              >
                <Text style={styles.confirmCancelText}>{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmModalBtn, styles.confirmDeleteBtn]}
                onPress={confirmDeleteAll}
              >
                <Text style={styles.confirmDeleteText}>{t("delete")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  textButtonAddCredit: {
    color: "#fff",
    fontSize: 16,
  },
  closeInfo: {
    borderRadius: 10,
    marginHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: Colors.light.tint,
    alignItems: "center",
  },
  infoContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  headerImage: {
    borderColor: Colors.light.tint,
    borderWidth: 5,
    marginTop: 25,
    width: 80,
    height: 80,
    borderRadius: 100,
  },
  toyaLogoModal: {
    marginTop: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    resizeMode: "cover",
  },
  headerBody: {
    alignItems: "center",
    marginBottom: 50,
  },
  header: {
    height: 350,
    alignItems: "center",
    backgroundColor: Colors.light.tint,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  modalAddCreditContainer: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalAddCreditKAV: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: "center",
  },
  modalAddCreditContent: {
    height: 450,
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
    zIndex: 10,
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
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  headerSection: {
    backgroundColor: "#6D56F2",
  },
  headerRow: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    paddingBottom: 8,
  },
  headerSubRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 12,
  },
  tabsContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.3)",
    marginTop: 10,
  },
  deleteAllBtn: {
    paddingLeft: 8,
    paddingRight: 30,
    paddingVertical: 8,
  },
  chatItemContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  deleteBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 25,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 16,
    color: "#6D56F2",
  },
  headerSubText: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  modalHeaderText: {
    fontSize: 26,
    fontWeight: "bold",
    textAlign: "center",
    marginTop: 20,
    color: "#000",
  },
  tabs: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  tab: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  tabText: {
    fontSize: 20,
    color: "rgba(255, 255, 255, 0.7)",
  },
  activeTabText: {
    color: "#fff",
    fontWeight: "bold",
  },
  activeTabIndicator: {
    height: 2,
    backgroundColor: "#fff",
    marginTop: 4,
  },
  chatListContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  chatList: {
    padding: 16,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  supportAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.tint,
    justifyContent: "center",
    alignItems: "center",
  },
  chatInfo: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  time: {
    fontSize: 11,
    color: "#999",
    marginLeft: 8,
  },
  messagePreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  messagePrefix: {
    fontSize: 13,
    color: "#999",
    marginRight: 4,
  },
  lastMessage: {
    flex: 1,
    fontSize: 13,
    color: "#888",
  },
  bottomNavigation: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  newChatButton: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "#8f5eff",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  toast: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#2e7d32",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  confirmModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  confirmModalContent: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 24,
    marginHorizontal: 32,
    width: "85%",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
  },
  confirmModalMessage: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  confirmModalButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  confirmModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  confirmCancelBtn: {
    backgroundColor: "#f0f0f0",
  },
  confirmCancelText: {
    color: "#555",
    fontWeight: "600",
    fontSize: 15,
  },
  confirmDeleteBtn: {
    backgroundColor: "#e53935",
  },
  confirmDeleteText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});