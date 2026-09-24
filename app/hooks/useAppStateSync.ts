import { useEffect, useRef } from "react";
import { AppState } from "react-native";

export const useAppStateSync = (onForeground: () => Promise<void> | void): void => {
  const onForegroundRef = useRef(onForeground);
  onForegroundRef.current = onForeground;

  useEffect(() => {
    const previousState = { current: AppState.currentState };
    const subscription = AppState.addEventListener("change", async (nextAppState) => {
      if (previousState.current.match(/inactive|background/) && nextAppState === "active") {
        await onForegroundRef.current();
      }
      previousState.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);
};
