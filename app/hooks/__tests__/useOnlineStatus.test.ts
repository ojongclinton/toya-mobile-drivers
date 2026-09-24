import { renderHook, act } from "@testing-library/react-native";
import { useOnlineStatus } from "../useOnlineStatus";

const makeCallbacks = () => ({
  onLocationTick: jest.fn(),
  onSearchTick: jest.fn(),
});

beforeEach(() => jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] }));
afterEach(async () => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── état initial ────────────────────────────────────────────────────────────

describe("useOnlineStatus — état initial", () => {
  it("isOnline démarre à false", async () => {
    const { result } = await renderHook(() => useOnlineStatus(makeCallbacks()));
    expect(result.current.isOnline).toBe(false);
  });

  it("isOnlineRef.current démarre à false", async () => {
    const { result } = await renderHook(() => useOnlineStatus(makeCallbacks()));
    expect(result.current.isOnlineRef.current).toBe(false);
  });
});

// ─── setOnline ───────────────────────────────────────────────────────────────

describe("useOnlineStatus — setOnline", () => {
  it("setOnline(true) met isOnline et isOnlineRef à true", async () => {
    const { result } = await renderHook(() => useOnlineStatus(makeCallbacks()));
    await act(() => { result.current.setOnline(true); });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.isOnlineRef.current).toBe(true);
  });

  it("setOnline(false) remet isOnline et isOnlineRef à false", async () => {
    const { result } = await renderHook(() => useOnlineStatus(makeCallbacks()));
    await act(() => { result.current.setOnline(true); });
    await act(() => { result.current.setOnline(false); });
    expect(result.current.isOnline).toBe(false);
    expect(result.current.isOnlineRef.current).toBe(false);
  });
});

// ─── intervals de localisation ───────────────────────────────────────────────

describe("useOnlineStatus — startLocationInterval", () => {
  it("appelle onLocationTick après 30 s", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => { result.current.startLocationInterval(); });
    await act(() => { jest.advanceTimersByTime(30000); });
    expect(cb.onLocationTick).toHaveBeenCalledTimes(1);
  });

  it("appelle onLocationTick plusieurs fois (intervalle répété)", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => { result.current.startLocationInterval(); });
    await act(() => { jest.advanceTimersByTime(90000); });
    expect(cb.onLocationTick).toHaveBeenCalledTimes(3);
  });

  it("relancer startLocationInterval annule l'ancien interval", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => { result.current.startLocationInterval(); });
    await act(() => { result.current.startLocationInterval(); });
    await act(() => { jest.advanceTimersByTime(30000); });
    expect(cb.onLocationTick).toHaveBeenCalledTimes(1);
  });
});

// ─── interval de recherche ───────────────────────────────────────────────────

describe("useOnlineStatus — startSearchInterval", () => {
  it("appelle onSearchTick après 5 s", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => { result.current.startSearchInterval(); });
    await act(() => { jest.advanceTimersByTime(5000); });
    expect(cb.onSearchTick).toHaveBeenCalledTimes(1);
  });
});

// ─── arrêt des intervals ─────────────────────────────────────────────────────

describe("useOnlineStatus — stopSearchInterval / stopIntervals", () => {
  it("stopSearchInterval arrête le tick de recherche", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => { result.current.startSearchInterval(); });
    await act(() => { result.current.stopSearchInterval(); });
    await act(() => { jest.advanceTimersByTime(30000); });
    expect(cb.onSearchTick).not.toHaveBeenCalled();
  });

  it("stopIntervals arrête les deux intervals", async () => {
    const cb = makeCallbacks();
    const { result } = await renderHook(() => useOnlineStatus(cb));
    await act(() => {
      result.current.startLocationInterval();
      result.current.startSearchInterval();
      result.current.stopIntervals();
    });
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(cb.onLocationTick).not.toHaveBeenCalled();
    expect(cb.onSearchTick).not.toHaveBeenCalled();
  });
});

// ─── cleanup au démontage ────────────────────────────────────────────────────

describe("useOnlineStatus — cleanup", () => {
  it("démontage arrête les intervals en cours", async () => {
    const cb = makeCallbacks();
    const { result, unmount } = await renderHook(() => useOnlineStatus(cb));
    await act(() => {
      result.current.startLocationInterval();
      result.current.startSearchInterval();
    });
    await unmount();
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(cb.onLocationTick).not.toHaveBeenCalled();
    expect(cb.onSearchTick).not.toHaveBeenCalled();
  });
});
