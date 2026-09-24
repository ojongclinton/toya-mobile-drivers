import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SpeakOptions = {
  repeatCount?: number;
  onStart?: () => void;
  onEnd?: () => void;
};

let speechEnabled = true;
let ttsEngineUsed = false;

export const setSpeechEnabled = (enabled: boolean): void => {
  speechEnabled = enabled;
  if (!enabled && ttsEngineUsed) {
    try { Speech.stop(); } catch {}
  }
};

export const isSpeechEnabled = (): boolean => speechEnabled;

export const speak = async (text: string, opts: SpeakOptions = {}): Promise<void> => {
  if (!speechEnabled) return;
  const { repeatCount = 1, onStart, onEnd } = opts;
  const lang = (await AsyncStorage.getItem("language")) || "fr";
  const speakOnce = () =>
    new Promise<void>((resolve) => {
      if (ttsEngineUsed) {
        try { Speech.stop(); } catch {}
      }
      ttsEngineUsed = true;
      onStart?.();
      Speech.speak(text, {
        language: lang === "fr" ? "fr-FR" : "en-US",
        pitch: 1.0,
        rate: 0.85,
        onDone: () => {
          onEnd?.();
          resolve();
        },
        onStopped: () => {
          onEnd?.();
          resolve();
        },
        onError: () => {
          onEnd?.();
          resolve();
        },
      });
    });
  for (let i = 0; i < repeatCount; i++) {
    if (!speechEnabled) return;
    await speakOnce();
    if (i < repeatCount - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
};

export const stopSpeech = (): void => {
  if (ttsEngineUsed) {
    try { Speech.stop(); } catch {}
  }
};
