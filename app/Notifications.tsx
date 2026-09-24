import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "react-native-paper";
import { Colors } from "@/constants/Colors";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import BASE_URL from "../constants/api/BASE_URL";

// Fonction pour mapper le type de notification vers les icônes et couleurs
const getNotificationStyle = (notificationType: string, t: (key: string) => string) => {
  const map: Record<string, any> = {

    // ── 🚗 Courses ──────────────────────────────────────────────────────────
    new_ride: {
      icon: "car-plus",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_new_ride"),
    },
    course_available: {
      icon: "car-clock",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_course_available"),
    },
    ride_accepted: {
      icon: "check-circle",
      iconColor: "#7A42F4",
      iconBackground: "#F3EEFF",
      title: t("notif_ride_accepted"),
    },
    ride_started: {
      icon: "play-circle",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_ride_started"),
    },
    ride_completed: {
      icon: "check-circle-outline",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_ride_completed"),
    },
    ride_canceled: {
      icon: "cancel",
      iconColor: "#F44336",
      iconBackground: "#FFEBEE",
      title: t("notif_ride_canceled"),
    },
    driver_nearby: {
      icon: "map-marker-radius",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_driver_nearby"),
    },
    driver_arrived: {
      icon: "map-marker-check",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_driver_arrived"),
    },
    new_review: {
      icon: "star",
      iconColor: "#FFC107",
      iconBackground: "#FFF8E1",
      title: t("notif_rating"),
    },
    promo_applied: {
      icon: "tag",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_promo_applied"),
    },

    // ── 💰 Paiements / Wallet ────────────────────────────────────────────────
    recharge_wallet: {
      icon: "cash-plus",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_recharge_wallet"),
    },
    payment_failed: {
      icon: "close-circle",
      iconColor: "#F44336",
      iconBackground: "#FFEBEE",
      title: t("notif_payment_failed"),
    },
    commission_deducted: {
      icon: "percent",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_commission_deducted"),
    },
    subscription_payment: {
      icon: "calendar-check",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_subscription_payment"),
    },
    payment_success: {
      icon: "check-circle",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_payment_success"),
    },
    withdraw_wallet: {
      icon: "cash-minus",
      iconColor: "#F44336",
      iconBackground: "#FFEBEE",
      title: t("notif_withdraw_wallet"),
    },

    // ── 🎁 Parrainage / Bonus ────────────────────────────────────────────────
    referral_sent: {
      icon: "account-arrow-right",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_referral_sent"),
    },
    referral_received: {
      icon: "account-arrow-left",
      iconColor: "#7A42F4",
      iconBackground: "#F3EEFF",
      title: t("notif_referral_received"),
    },
    referral_first_ride_done: {
      icon: "check-decagram",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_referral_first_ride_done"),
    },
    referral_earning: {
      icon: "cash-plus",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_referral_earning"),
    },
    signup_bonus: {
      icon: "gift",
      iconColor: "#E91E63",
      iconBackground: "#FCE4EC",
      title: t("notif_signup_bonus"),
    },
    referral: {
      icon: "account-multiple",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_referral"),
    },
    referral_discount_pending: {
      icon: "tag-outline",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_referral_discount_pending"),
    },

    // ── 📄 Documents / Véhicule ──────────────────────────────────────────────
    vehicle_submission_for_verification: {
      icon: "car-cog",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_vehicle_verification"),
    },
    documents_approved: {
      icon: "file-check",
      iconColor: "#4CAF50",
      iconBackground: "#E8F5E9",
      title: t("notif_documents_approved"),
    },
    documents_rejected: {
      icon: "file-remove",
      iconColor: "#F44336",
      iconBackground: "#FFEBEE",
      title: t("notif_documents_rejected"),
    },
    document_expiry_reminder: {
      icon: "clock-alert",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_document_expiry_reminder"),
    },

    // ── 💬 Messagerie / Support ──────────────────────────────────────────────
    message_received: {
      icon: "message-text",
      iconColor: "#2196F3",
      iconBackground: "#E3F2FD",
      title: t("notif_message_received"),
    },
    support_message_received: {
      icon: "headset",
      iconColor: "#7A42F4",
      iconBackground: "#F3EEFF",
      title: t("notif_support_message_received"),
    },
    support_ticket: {
      icon: "ticket-outline",
      iconColor: "#FF9800",
      iconBackground: "#FFF3E0",
      title: t("notif_support_ticket"),
    },

    // ── 🛠️ Admin ─────────────────────────────────────────────────────────────
    admin_message: {
      icon: "bullhorn",
      isImage: true,
      imageSource: require("../assets/images/toyalogo.png"),
      iconColor: "#FF9800",
      iconBackground: "#FFF8F0",
      title: "Toya",
    },

    // ── Aliases legacy (anciens types émis — conservés pour rétrocompat) ─────
    ride_cancelled:  { icon: "cancel",        iconColor: "#F44336", iconBackground: "#FFEBEE", title: t("notif_ride_canceled") },
    start_ride:      { icon: "play-circle",   iconColor: "#2196F3", iconBackground: "#E3F2FD", title: t("notif_ride_started") },
    payment:         { icon: "check-circle",  iconColor: "#4CAF50", iconBackground: "#E8F5E9", title: t("notif_payment_success") },
    rating:          { icon: "star",          iconColor: "#FFC107", iconBackground: "#FFF8E1", title: t("notif_rating") },
    bonus:           { icon: "gift",          iconColor: "#E91E63", iconBackground: "#FCE4EC", title: t("notif_bonus") },
    system:          { icon: "bullhorn",      iconColor: "#FF9800", iconBackground: "#FFF3E0", title: t("notif_system") },
  };

  return (
    map[notificationType] ?? {
      icon: "bell",
      iconColor: "#9E9E9E",
      iconBackground: "#F5F5F5",
      title: t("notif_default"),
    }
  );
};

// Fonction pour formater le timestamp
const formatTimestamp = (timestamp: string, t: (key: string, opts?: object) => string) => {
  const now = new Date();
  const notifDate = new Date(timestamp);
  const diffMs = now.getTime() - notifDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("notif_just_now");
  if (diffMins < 60)
    return diffMins === 1 ? t("notif_minute_ago") : t("notif_minutes_ago", { count: diffMins });
  if (diffHours < 24)
    return diffHours === 1 ? t("notif_hour_ago") : t("notif_hours_ago", { count: diffHours });
  if (diffDays === 1) return t("notif_one_day_ago");
  if (diffDays < 7) return t("notif_days_ago", { count: diffDays });

  // Format pour les dates plus anciennes
  const day = notifDate.getDate().toString().padStart(2, "0");
  const month = (notifDate.getMonth() + 1).toString().padStart(2, "0");
  const year = notifDate.getFullYear();
  return `${day}/${month}/${year}`;
};

// Fonction pour formater le timestamp complet (pour la modal)
const formatFullTimestamp = (timestamp: string) => {
  const notifDate = new Date(timestamp);
  const day = notifDate.getDate().toString().padStart(2, "0");
  const month = (notifDate.getMonth() + 1).toString().padStart(2, "0");
  const year = notifDate.getFullYear();
  const hours = notifDate.getHours().toString().padStart(2, "0");
  const minutes = notifDate.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} à ${hours}:${minutes}`;
};

export default function Notifications({ navigation }: { navigation: any }) {
  const { t } = useTranslation();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Récupérer toutes les notifications
  const fetchNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + "/notifications/all", {
        method: "GET",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.status}`);
      }

      const data = await response.json();
      // console.log("🔔 Notifications response:", data);
      // console.log("📋 Notifications count:", data.Data?.length ?? 0);

      if (data.Data && Array.isArray(data.Data)) {
        const sorted = [...data.Data].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setNotifications(sorted);
      }
    } catch (error) {
      // console.error("Erreur lors de la récupération des notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Récupérer les détails d'une notification
  const fetchNotificationDetail = async (notificationId: string) => {
    try {
      setLoadingDetail(true);
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        BASE_URL + `/notifications/${notificationId}`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur: ${response.status}`);
      }

      const data = await response.json();
      // console.log("📄 Notification detail response:", data);

      if (data.Data) {
        setSelectedNotification(data.Data);
      }
    } catch (error) {
      // console.error("Erreur lors de la récupération des détails:", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Charger les notifications au montage du composant
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Rafraîchir les notifications
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // Filtrer les notifications
  const filteredNotifications =
    filter === "all"
      ? notifications
      : notifications.filter((notif) => !notif.is_read);

  // Compter les notifications non lues
  const unreadCount = notifications.filter((notif) => !notif.is_read).length;

  // Marquer une notification comme lue
  const markAsRead = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(
        BASE_URL + `/notifications/${id}/mark_as_read`,
        {
          method: "GET",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      // console.log("👁️ Mark as read response - status:", response.status);

      if (response.ok) {
        // Mettre à jour localement le statut de la notification
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === id ? { ...notif, is_read: true } : notif
          )
        );

        // Mettre à jour aussi la notification sélectionnée si c'est celle-ci
        if (selectedNotification && selectedNotification.id === id) {
          setSelectedNotification((prev: any) => ({
            ...prev,
            is_read: true,
          }));
        }
      }
    } catch (error) {
      // console.error("Erreur lors du marquage comme lu:", error);
    }
  };

  // Marquer toutes les notifications comme lues
  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + "/notifications/mark-all-read", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, is_read: true }))
        );
      }
    } catch (error) {
      // console.error("Erreur lors du marquage de toutes comme lues:", error);
    }
  };

  // Supprimer une notification
  const deleteNotification = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + `/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (response.ok) {
        setNotifications((prev) => prev.filter((notif) => notif.id !== id));
      }
    } catch (error) {
      // console.error("Erreur lors de la suppression:", error);
    }
  };

  // Suppression en masse
  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const token = await AsyncStorage.getItem("authToken");
      const response = await fetch(BASE_URL + "/notifications/bulk-delete", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ notification_ids: selectedIds }),
      });

      const data = await response.json();
      // console.log("🗑️ Bulk delete response:", data);
      // console.log("✅ Deleted count:", data.deleted_count);
      if (data.failed_ids?.length > 0) {
        // console.warn("⚠️ Failed IDs:", data.failed_ids);
      }
      if (response.ok) {
        const failedIds = data.failed_ids ?? [];
        const deletedIds = selectedIds.filter((id) => !failedIds.includes(id));
        // console.log("🟢 Successfully deleted:", deletedIds);
        setNotifications((prev) =>
          prev.filter((notif) => !deletedIds.includes(notif.id))
        );
        setSelectedIds([]);
        setSelectionMode(false);
      }
    } catch (error) {
      // console.error("❌ Erreur lors de la suppression en masse:", error);
    }
  };

  const toggleSelectNotification = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map((n) => n.id));
    }
  };

  // Ouvrir le modal avec les détails de la notification
  const openNotificationDetail = async (notification: any) => {
    setModalVisible(true);

    // Marquer comme lue IMMÉDIATEMENT si elle ne l'est pas déjà
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }

    // Charger les détails après avoir marqué comme lu
    await fetchNotificationDetail(notification.id);
  };

  // Fermer le modal
  const closeModal = () => {
    setModalVisible(false);
    setSelectedNotification(null);
  };

  // Rendu d'une notification
  const renderNotification = ({ item }: { item: any }) => {
    const notifStyle = getNotificationStyle(item.notification_type, t);

    const isSelected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.is_read && styles.notificationCardUnread,
          isSelected && styles.notificationCardSelected,
        ]}
        onPress={() =>
          selectionMode
            ? toggleSelectNotification(item.id)
            : openNotificationDetail(item)
        }
        onLongPress={() => {
          setSelectionMode(true);
          toggleSelectNotification(item.id);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.notificationContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: notifStyle.iconBackground },
            ]}
          >
            {notifStyle.isImage ? (
              <Image
                source={notifStyle.imageSource}
                style={{ width: 28, height: 28, resizeMode: "contain" }}
              />
            ) : (
              <Icon
                source={notifStyle.icon}
                size={24}
                color={notifStyle.iconColor}
              />
            )}
          </View>

          <View style={styles.notificationText}>
            <View style={styles.notificationHeader}>
              <Text
                style={[styles.title, !item.is_read && styles.titleUnread]}
                numberOfLines={1}
              >
                {notifStyle.title}
              </Text>
              {!item.is_read && !selectionMode && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.time}>{formatTimestamp(item.timestamp, t)}</Text>
          </View>
        </View>
        {selectionMode && (
          <Icon
            source={isSelected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
            size={24}
            color={isSelected ? Colors.light.tint : "#ccc"}
          />
        )}
      </TouchableOpacity>
    );
  };

  // Affichage du loader
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Icon source="arrow-left" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("notifications")}</Text>
          <View style={styles.markAllButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>
            {t("notif_loading")}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (selectionMode) {
              setSelectionMode(false);
              setSelectedIds([]);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.backButton}
        >
          <Icon source={selectionMode ? "close" : "arrow-left"} size={24} color="#000" />
        </TouchableOpacity>

        {selectionMode ? (
          <TouchableOpacity onPress={toggleSelectAll}>
            <Text style={[styles.headerTitle, { fontSize: 15, color: Colors.light.tint }]}>
              {selectedIds.length === filteredNotifications.length
                ? t("notif_deselect_all")
                : t("notif_select_all")}
              {" "}({selectedIds.length})
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.headerTitle}>{t("notifications")}</Text>
        )}

        {selectionMode ? (
          <TouchableOpacity
            onPress={bulkDelete}
            style={styles.markAllButton}
            disabled={selectedIds.length === 0}
          >
            <Icon
              source="delete"
              size={24}
              color={selectedIds.length > 0 ? "#F44336" : "#ccc"}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Icon source="check-all" size={24} color={Colors.light.tint} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "all" && styles.filterButtonActive,
          ]}
          onPress={() => setFilter("all")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "all" && styles.filterTextActive,
            ]}
          >
            {t("notif_filter_all", { count: notifications.length })}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            filter === "unread" && styles.filterButtonActive,
          ]}
          onPress={() => setFilter("unread")}
        >
          <Text
            style={[
              styles.filterText,
              filter === "unread" && styles.filterTextActive,
            ]}
          >
            {t("notif_filter_unread", { count: unreadCount })}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Liste des notifications */}
      {filteredNotifications.length > 0 ? (
        <FlatList
          data={filteredNotifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.light.tint]}
              tintColor={Colors.light.tint}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Icon source="bell-off" size={80} color="#ccc" />
          <Text style={styles.emptyText}>{t("notif_empty_title")}</Text>
          <Text style={styles.emptySubText}>
            {filter === "unread"
              ? t("notif_all_read")
              : t("notif_no_notifications")}
          </Text>
        </View>
      )}

      {/* Modal des détails de notification */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header du modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{t("notif_details")}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <Icon source="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Contenu du modal */}
            {loadingDetail ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={Colors.light.tint} />
                <Text style={styles.modalLoadingText}>{t("notif_loading_short")}</Text>
              </View>
            ) : selectedNotification ? (
              <ScrollView
                style={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Icône et titre */}
                {(() => {
                  const s = getNotificationStyle(selectedNotification.notification_type, t);
                  return (
                    <View style={styles.modalIconSection}>
                      <View style={[styles.modalIconContainer, { backgroundColor: s.iconBackground }]}>
                        {s.isImage ? (
                          <Image
                            source={s.imageSource}
                            style={{ width: 48, height: 48, resizeMode: "contain" }}
                          />
                        ) : (
                          <Icon source={s.icon} size={40} color={s.iconColor} />
                        )}
                      </View>
                      <Text style={styles.modalTitle}>{s.title}</Text>
                    </View>
                  );
                })()}

                {/* Message */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t("notif_message_label")}</Text>
                  <Text style={styles.modalMessage}>
                    {selectedNotification.message}
                  </Text>
                </View>

                {/* Informations supplémentaires */}
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>{t("notif_info_label")}</Text>

                  <View style={styles.modalInfoRow}>
                    <Icon source="clock-outline" size={20} color="#666" />
                    <Text style={styles.modalInfoText}>
                      {formatFullTimestamp(selectedNotification.timestamp)}
                    </Text>
                  </View>

                  <View style={styles.modalInfoRow}>
                    <Icon
                      source={
                        selectedNotification.is_read
                          ? "check-circle"
                          : "circle-outline"
                      }
                      size={20}
                      color={selectedNotification.is_read ? "#4CAF50" : "#666"}
                    />
                    <Text style={styles.modalInfoText}>
                      {selectedNotification.is_read ? t("notif_status_read") : t("notif_status_unread")}
                    </Text>
                  </View>
                </View>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  markAllButton: {
    padding: 5,
  },
  filterContainer: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "white",
    gap: 10,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
  },
  filterButtonActive: {
    backgroundColor: Colors.light.tint,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterTextActive: {
    color: "white",
  },
  listContent: {
    padding: 15,
  },
  notificationCard: {
    backgroundColor: "white",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  notificationCardUnread: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  notificationCardSelected: {
    backgroundColor: "#EDE7FF",
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  notificationContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  notificationText: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  titleUnread: {
    fontWeight: "bold",
    color: "#000",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.tint,
    marginLeft: 8,
  },
  message: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: "#999",
  },
  deleteButton: {
    padding: 8,
    marginLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
  },
  // Styles du modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  modalHeaderTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  closeButton: {
    padding: 5,
  },
  modalLoadingContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  modalLoadingText: {
    marginTop: 15,
    fontSize: 16,
    color: "#666",
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalIconSection: {
    alignItems: "center",
    paddingVertical: 30,
  },
  modalIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  modalSection: {
    marginBottom: 25,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: "#666",
    lineHeight: 24,
  },
  modalInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 12,
    flex: 1,
  },
});