import { renderHook, act } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRideStatusSocket } from "../useRideStatusSocket";

// ─── Mock WebSocket ──────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  send = jest.fn();
  close: jest.Mock;

  constructor(url: string) {
    this.url = url;
    this.readyState = MockWebSocket.OPEN;
    this.close = jest.fn(() => { this.readyState = MockWebSocket.CLOSED; });
    MockWebSocket.instances.push(this);
  }

  static last() { return MockWebSocket.instances[MockWebSocket.instances.length - 1]; }
  static reset() { MockWebSocket.instances = []; }
}

(global as any).WebSocket = MockWebSocket;

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn() },
}));

const mockGet = AsyncStorage.getItem as jest.Mock;

beforeEach(() => {
  MockWebSocket.reset();
  jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
  mockGet.mockResolvedValue("token-test");
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── connect ─────────────────────────────────────────────────────────────────

describe("useRideStatusSocket — connect", () => {
  it("lit le token depuis AsyncStorage et l'inclut dans l'URL", async () => {
    mockGet.mockResolvedValue("mon-token-secret");
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    expect(MockWebSocket.last().url).toContain("mon-token-secret");
  });

  it("crée un WebSocket après connect()", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("onmessage parse le JSON et appelle onMessage", async () => {
    const onMessage = jest.fn();
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "ride_cancelled" }) }); });
    expect(onMessage).toHaveBeenCalledWith({ type: "ride_cancelled" });
  });

  it("onmessage avec JSON invalide — pas d'erreur", async () => {
    const onMessage = jest.fn();
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onmessage?.({ data: "not-json" }); });
    expect(onMessage).not.toHaveBeenCalled();
  });
});

// ─── ping keep-alive ─────────────────────────────────────────────────────────

describe("useRideStatusSocket — ping", () => {
  it("envoie un ping toutes les 30 s après onopen", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onopen?.(); });
    await act(() => { jest.advanceTimersByTime(30000); });
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ action: "ping" }));
  });

  it("envoie plusieurs pings sur la durée", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onopen?.(); });
    await act(() => { jest.advanceTimersByTime(90000); });
    expect(ws.send).toHaveBeenCalledTimes(3);
  });
});

// ─── gestion fermeture ───────────────────────────────────────────────────────

describe("useRideStatusSocket — fermeture", () => {
  it("fermeture avec code 4001 (token invalide) → pas de reconnexion", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onclose?.({ code: 4001 }); });
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("fermeture avec code 1000 → reconnexion programmée", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onclose?.({ code: 1000 }); });
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });
});

// ─── reconnectIfNeeded ───────────────────────────────────────────────────────

describe("useRideStatusSocket — reconnectIfNeeded", () => {
  it("reconnecte si le WS est absent ou fermé", async () => {
    const { result } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { result.current.reconnectIfNeeded(); });
    await act(async () => { await Promise.resolve(); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});

// ─── cleanup ─────────────────────────────────────────────────────────────────

describe("useRideStatusSocket — cleanup", () => {
  it("démontage arrête le ping et ferme le WebSocket", async () => {
    const { result, unmount } = await renderHook(() => useRideStatusSocket({ onMessage: jest.fn() }));
    await act(async () => { await result.current.connect(); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onopen?.(); });
    await unmount();
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(ws.send).not.toHaveBeenCalled();
  });
});
