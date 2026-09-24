import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { Icon } from "react-native-paper";

type Props = { visible: boolean };

export const GPSWaitingLoader = ({ visible }: Props) => {
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const a1 = createPulse(pulseAnim1, 0);
    const a2 = createPulse(pulseAnim2, 600);
    const a3 = createPulse(pulseAnim3, 1200);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  // ⚠️ PAS de <Modal> ici : sur iOS, une Modal ouverte puis fermée au lancement peut
  // laisser une fenêtre native transparente qui capte TOUS les touches (carte + boutons
  // figés alors que l'écran reste visible). On rend donc un simple overlay plein écran,
  // entièrement retiré de l'arbre (return null) quand il n'est pas visible.
  if (!visible) return null;

  const anims = [pulseAnim1, pulseAnim2, pulseAnim3];

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {anims.map((anim, i) => (
          <Animated.View
            key={i}
            style={[
              styles.ring,
              {
                opacity: anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 0.3, 0] }),
                transform: [
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) },
                ],
              },
            ]}
          />
        ))}
        <View style={styles.iconCircle}>
          <Icon source="map-marker" size={34} color="#fff" />
        </View>
        <View style={styles.dotsRow}>
          {anims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  opacity: anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1, 0.3],
                  }),
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 15, 30, 0.92)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    alignItems: "center",
    justifyContent: "center",
    width: 220,
    height: 220,
  },
  ring: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#7D5FFF",
    backgroundColor: "rgba(125, 95, 255, 0.08)",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#7D5FFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7D5FFF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: "row",
    marginTop: 14,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
});
