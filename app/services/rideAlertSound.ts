import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

// Alarme sonore "nouvelle course" jouée en boucle jusqu'à ce que le chauffeur
// accepte / refuse la course (piloté par l'état isRequetteclient dans home.tsx).
// Le fichier assets/sounds/new_ride.wav est un placeholder : il peut être
// remplacé par n'importe quel son (.wav/.mp3) — un nouveau build EAS est requis
// pour qu'un nouveau fichier soit embarqué.

let player: AudioPlayer | null = null;
let active = false;
let audioModeConfigured = false;

const ensureAudioMode = async (): Promise<void> => {
  if (audioModeConfigured) return;
  try {
    await setAudioModeAsync({
      // Sonne même si le téléphone est en mode silencieux / vibreur
      playsInSilentMode: true,
      // Prend le focus audio (met en pause la musique des autres apps)
      interruptionMode: "doNotMix",
      // Lecture uniquement quand l'app est au premier plan
      shouldPlayInBackground: false,
    });
    audioModeConfigured = true;
  } catch {
    // si la config échoue, on tente quand même de jouer le son
  }
};

export const startRideAlert = async (): Promise<void> => {
  if (active) return;
  active = true;
  try {
    await ensureAudioMode();
    if (!player) {
      player = createAudioPlayer(require("../../assets/sounds/new_ride.wav"));
      player.loop = true;
      player.volume = 1.0;
    }
    // un stopRideAlert() a pu être appelé pendant le chargement
    if (!active) return;
    try {
      await player.seekTo(0);
    } catch {
      // ignore
    }
    player.play();
  } catch {
    active = false;
  }
};

export const stopRideAlert = (): void => {
  active = false;
  try {
    player?.pause();
  } catch {
    // ignore
  }
};

export const releaseRideAlert = (): void => {
  active = false;
  try {
    player?.remove();
  } catch {
    // ignore
  }
  player = null;
};
