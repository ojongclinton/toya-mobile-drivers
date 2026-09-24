import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Icon } from "react-native-paper";

type Props = {
  servicesEnabled: boolean;
  lowAccuracy: boolean;
  onOpenSettings: () => void;
};

// Bandeau non-bloquant de statut GPS :
//  - P3 : services de localisation coupés → message CRITIQUE, reste affiché
//    (l'utilisateur doit aller activer la Haute précision).
//  - P4 : précision faible (appareil bas de gamme) → s'affiche 5 s puis disparaît,
//    pour ne pas recouvrir le texte des instructions de navigation.
// Touchable : ouvre les réglages de localisation du téléphone.
export const GpsStatusBanner = ({ servicesEnabled, lowAccuracy, onOpenSettings }: Props) => {
  // Le bandeau « GPS faible » est éphémère : visible 5 s à chaque (ré)apparition
  // de la mauvaise précision, puis masqué même si le GPS reste faible.
  const [weakVisible, setWeakVisible] = useState(false);
  useEffect(() => {
    if (lowAccuracy) {
      setWeakVisible(true);
      const t = setTimeout(() => setWeakVisible(false), 5000);
      return () => clearTimeout(t);
    }
    setWeakVisible(false);
  }, [lowAccuracy]);

  if (!servicesEnabled) {
    return (
      <TouchableOpacity style={[styles.banner, styles.critical]} onPress={onOpenSettings} activeOpacity={0.8}>
        <Icon source="map-marker-off" size={18} color="#fff" />
        <Text style={styles.text}>
          Localisation désactivée — touchez pour activer la Haute précision
        </Text>
      </TouchableOpacity>
    );
  }
  if (lowAccuracy && weakVisible) {
    return (
      <TouchableOpacity style={[styles.banner, styles.warning]} onPress={onOpenSettings} activeOpacity={0.8}>
        <Icon source="crosshairs-question" size={18} color="#fff" />
        <Text style={styles.text}>
          GPS faible — navigation en mode dégradé. Touchez pour régler la précision.
        </Text>
      </TouchableOpacity>
    );
  }
  return null;
};

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 8,
  },
  critical: { backgroundColor: "#C62828" },
  warning: { backgroundColor: "#E65100" },
  text: { color: "#fff", fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
