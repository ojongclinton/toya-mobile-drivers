import { renderHook, act, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Location from "expo-location";
import { useDriverLocation } from "../useDriverLocation";

jest.mock("expo-location", () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { BestForNavigation: 6 },
}));

let capturedCallback: ((loc: any) => void) | null = null;
const mockSubscription = { remove: jest.fn() };

const makeLocation = (overrides: Record<string, any> = {}) => ({
  coords: {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10,
    heading: 45,
    speed: 5,
    ...overrides,
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  capturedCallback = null;
  mockSubscription.remove.mockClear();

  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: "granted",
  });
  (Location.watchPositionAsync as jest.Mock).mockImplementation((_opts, cb) => {
    capturedCallback = cb;
    return Promise.resolve(mockSubscription);
  });
});

// ─── permissions ─────────────────────────────────────────────────────────────

describe("useDriverLocation — permissions", () => {
  it("demande les permissions GPS au montage", async () => {
    const { unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled());
    await unmount();
  });

  it("lance watchPositionAsync avec BestForNavigation si permissions accordées", async () => {
    const { unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(Location.watchPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ accuracy: Location.Accuracy.BestForNavigation }),
      expect.any(Function)
    ));
    await unmount();
  });

  it("affiche une alerte si permissions refusées", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    const { unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await unmount();
    alertSpy.mockRestore();
  });

  it("isLocationReady reste false si permissions refusées", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: "denied",
    });
    const { result, unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(result.current.isLocationReady).toBe(false);
    await unmount();
    alertSpy.mockRestore();
  });
});

// ─── premier fix GPS ─────────────────────────────────────────────────────────

describe("useDriverLocation — premier fix GPS", () => {
  it("isLocationReady passe à true après le premier fix", async () => {
    const { result, unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    expect(result.current.isLocationReady).toBe(true);
    await unmount();
  });

  it("latchauffeur et lonchauffeur sont mis à jour", async () => {
    const { result, unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    expect(result.current.latchauffeur).toBeCloseTo(48.8566, 4);
    expect(result.current.lonchauffeur).toBeCloseTo(2.3522, 4);
    await unmount();
  });

  it("appelle onUpdate avec isFirst=true sur le premier fix", async () => {
    const onUpdate = jest.fn();
    const { unmount } = await renderHook(() => useDriverLocation({ onUpdate }));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ isFirst: true })
    );
    await unmount();
  });

  it("appelle onUpdate avec isFirst=false sur les fixes suivants", async () => {
    const onUpdate = jest.fn();
    const { unmount } = await renderHook(() => useDriverLocation({ onUpdate }));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    await act(() => { capturedCallback!(makeLocation({ latitude: 48.86, longitude: 2.36 })); });
    const secondCall = onUpdate.mock.calls[1][0];
    expect(secondCall.isFirst).toBe(false);
    await unmount();
  });
});

// ─── filtre de Kalman ────────────────────────────────────────────────────────

describe("useDriverLocation — filtre de Kalman", () => {
  it("filtre activé par défaut (enableKalman=true)", async () => {
    const onUpdate = jest.fn();
    const { unmount } = await renderHook(() => useDriverLocation({ onUpdate }));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: expect.closeTo(48.8566, 4),
        longitude: expect.closeTo(2.3522, 4),
      })
    );
    await unmount();
  });

  it("filtre désactivé (enableKalman=false) → position brute transmise", async () => {
    const onUpdate = jest.fn();
    const { unmount } = await renderHook(() => useDriverLocation({ onUpdate, enableKalman: false }));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    await act(() => { capturedCallback!(makeLocation()); });
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 48.8566,
        longitude: 2.3522,
      })
    );
    await unmount();
  });
});

// ─── cleanup ─────────────────────────────────────────────────────────────────

describe("useDriverLocation — cleanup", () => {
  it("démontage supprime le watcher de position", async () => {
    const { unmount } = await renderHook(() => useDriverLocation({}));
    await waitFor(() => expect(capturedCallback).not.toBeNull());
    // S'assurer que locationWatchRef.current est assigné (après la résolution de la Promise)
    await act(async () => { await Promise.resolve(); });
    await unmount();
    expect(mockSubscription.remove).toHaveBeenCalled();
  });
});
