import { renderHook, act } from "@testing-library/react-native";
import { useNotificationsSocket } from "../useNotificationsSocket";

// ─── Mock WebSocket ──────────────────────────────────────────────────────────

class MockWebSocket {
  static OPEN = 1;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e?: { code?: number }) => void) | null = null;
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

beforeEach(() => {
  MockWebSocket.reset();
  jest.useFakeTimers({ doNotFake: ["setImmediate", "nextTick"] });
});
afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

// ─── connect ─────────────────────────────────────────────────────────────────

describe("useNotificationsSocket — connect", () => {
  it("crée un WebSocket avec l'URL correcte", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-42"); });
    expect(MockWebSocket.last().url).toContain("driver-42");
  });

  it("onopen remet le compteur de tentatives à 0", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onclose?.(); });
    await act(() => { jest.advanceTimersByTime(1000); });
    const ws2 = MockWebSocket.last();
    await act(() => { ws2.onopen?.(); });
    await act(() => { ws2.onclose?.(); });
    await act(() => { jest.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("onmessage parse le JSON et appelle onMessage", async () => {
    const onMessage = jest.fn();
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage }));
    await act(() => { result.current.connect("driver-1"); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onmessage?.({ data: JSON.stringify({ type: "test" }) }); });
    expect(onMessage).toHaveBeenCalledWith({ type: "test" });
  });

  it("onmessage avec JSON invalide — pas d'erreur, onMessage non appelé", async () => {
    const onMessage = jest.fn();
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage }));
    await act(() => { result.current.connect("driver-1"); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onmessage?.({ data: "invalid-json{" }); });
    expect(onMessage).not.toHaveBeenCalled();
  });
});

// ─── reconnexion avec backoff exponentiel ────────────────────────────────────

describe("useNotificationsSocket — reconnexion", () => {
  it("fermeture non intentionnelle → reconnecte après délai", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    const ws1 = MockWebSocket.last();
    await act(() => { ws1.onclose?.(); });
    await act(() => { jest.advanceTimersByTime(1000); });
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("fermeture intentionnelle → pas de reconnexion", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    await act(() => { result.current.connect("driver-1"); }); // fermeture interne intentionnelle
    const wsCount = MockWebSocket.instances.length;
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(MockWebSocket.instances).toHaveLength(wsCount);
  });

  it("délai exponentiel : 1s → 2s → 4s entre tentatives consécutives", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });

    // Tentative 0 → délai 1000ms
    await act(() => { MockWebSocket.last().onclose?.(); });
    await act(() => { jest.advanceTimersByTime(999); });
    expect(MockWebSocket.instances).toHaveLength(1);
    await act(() => { jest.advanceTimersByTime(1); });
    expect(MockWebSocket.instances).toHaveLength(2);

    // Tentative 1 → délai 2000ms
    await act(() => { MockWebSocket.last().onclose?.(); });
    await act(() => { jest.advanceTimersByTime(1999); });
    expect(MockWebSocket.instances).toHaveLength(2);
    await act(() => { jest.advanceTimersByTime(1); });
    expect(MockWebSocket.instances).toHaveLength(3);

    // Tentative 2 → délai 4000ms
    await act(() => { MockWebSocket.last().onclose?.(); });
    await act(() => { jest.advanceTimersByTime(3999); });
    expect(MockWebSocket.instances).toHaveLength(3);
    await act(() => { jest.advanceTimersByTime(1); });
    expect(MockWebSocket.instances).toHaveLength(4);
  });
});

// ─── reconnectIfNeeded ───────────────────────────────────────────────────────

describe("useNotificationsSocket — reconnectIfNeeded", () => {
  it("reconnecte si le WS n'est pas ouvert", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    const ws = MockWebSocket.last();
    ws.readyState = MockWebSocket.CLOSED;
    await act(() => { result.current.reconnectIfNeeded(); });
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("ne reconnecte pas si le WS est déjà ouvert", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    await act(() => { result.current.reconnectIfNeeded(); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("ne reconnecte pas si connect() n'a jamais été appelé", async () => {
    const { result } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.reconnectIfNeeded(); });
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});

// ─── cleanup ─────────────────────────────────────────────────────────────────

describe("useNotificationsSocket — cleanup", () => {
  it("démontage ferme le WebSocket et annule le timer de reconnexion", async () => {
    const { result, unmount } = await renderHook(() => useNotificationsSocket({ onMessage: jest.fn() }));
    await act(() => { result.current.connect("driver-1"); });
    const ws = MockWebSocket.last();
    await act(() => { ws.onclose?.(); });
    await unmount();
    await act(() => { jest.advanceTimersByTime(60000); });
    expect(MockWebSocket.instances).toHaveLength(1);
  });
});
