import React from "react";
import { Animated, StyleSheet, Text } from "react-native";

type Props = {
  visible: boolean;
  opacity: Animated.Value;
  text: string;
  variant: "cancel" | "accept" | "complete";
};

const BG_COLORS: Record<Props["variant"], string> = {
  cancel: "#2e7d32",
  accept: "#1565c0",
  complete: "#6a1b9a",
};

export const Toast = ({ visible, opacity, text, variant }: Props) => {
  if (!visible) return null;
  return (
    <Animated.View
      style={[styles.container, { backgroundColor: BG_COLORS[variant], opacity }]}
      pointerEvents="none"
    >
      <Text style={styles.text}>{text}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    zIndex: 999,
    elevation: 10,
  },
  text: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});
