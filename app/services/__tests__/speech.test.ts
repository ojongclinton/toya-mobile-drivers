import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as speech from "../speech";

jest.mock("expo-speech", () => ({
  speak: jest.fn((_text: any, opts: any) => {
    // Résout immédiatement la promesse en appelant onDone
    opts?.onDone?.();
  }),
  stop: jest.fn(),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
  },
}));

const mockSpeechSpeak = Speech.speak as jest.Mock;
const mockSpeechStop = Speech.stop as jest.Mock;
const mockGet = AsyncStorage.getItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  speech.setSpeechEnabled(true); // Réinitialise l'état module entre chaque test
  mockGet.mockResolvedValue("fr"); // Langue par défaut
});

// ─── isSpeechEnabled / setSpeechEnabled ─────────────────────────────────────

describe("isSpeechEnabled / setSpeechEnabled", () => {
  it("est activé par défaut", () => {
    expect(speech.isSpeechEnabled()).toBe(true);
  });

  it("setSpeechEnabled(false) désactive la synthèse", () => {
    speech.setSpeechEnabled(false);
    expect(speech.isSpeechEnabled()).toBe(false);
  });

  it("setSpeechEnabled(true) réactive la synthèse", () => {
    speech.setSpeechEnabled(false);
    speech.setSpeechEnabled(true);
    expect(speech.isSpeechEnabled()).toBe(true);
  });

  it("setSpeechEnabled(false) appelle Speech.stop()", () => {
    speech.setSpeechEnabled(false);
    expect(mockSpeechStop).toHaveBeenCalled();
  });

  it("setSpeechEnabled(true) n'appelle pas Speech.stop()", () => {
    speech.setSpeechEnabled(true);
    expect(mockSpeechStop).not.toHaveBeenCalled();
  });
});

// ─── speak ──────────────────────────────────────────────────────────────────

describe("speak", () => {
  it("n'appelle pas Speech.speak quand la synthèse est désactivée", async () => {
    speech.setSpeechEnabled(false);
    await speech.speak("Bonjour");
    expect(mockSpeechSpeak).not.toHaveBeenCalled();
  });

  it("appelle Speech.speak avec le texte fourni", async () => {
    await speech.speak("Bienvenu sur Toya");
    expect(mockSpeechSpeak).toHaveBeenCalledWith(
      "Bienvenu sur Toya",
      expect.any(Object)
    );
  });

  it("utilise la langue fr-FR quand la langue stockée est 'fr'", async () => {
    mockGet.mockResolvedValue("fr");
    await speech.speak("Bonjour");
    expect(mockSpeechSpeak).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ language: "fr-FR" })
    );
  });

  it("utilise la langue en-US quand la langue stockée est 'en'", async () => {
    mockGet.mockResolvedValue("en");
    await speech.speak("Hello");
    expect(mockSpeechSpeak).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ language: "en-US" })
    );
  });

  it("appelle les callbacks onStart et onEnd", async () => {
    const onStart = jest.fn();
    const onEnd = jest.fn();
    await speech.speak("test", { onStart, onEnd });
    expect(onStart).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalled();
  });
});

// ─── stopSpeech ─────────────────────────────────────────────────────────────

describe("stopSpeech", () => {
  it("appelle Speech.stop()", () => {
    speech.stopSpeech();
    expect(mockSpeechStop).toHaveBeenCalled();
  });
});
