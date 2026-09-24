import AsyncStorage from "@react-native-async-storage/async-storage";
import { saveOnlineStatus, loadOnlineStatus } from "../onlineStatusStorage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockSet = AsyncStorage.setItem as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── saveOnlineStatus ────────────────────────────────────────────────────────

describe("saveOnlineStatus", () => {
  it("enregistre true avec la clé 'isDriverOnline'", async () => {
    await saveOnlineStatus(true);
    expect(mockSet).toHaveBeenCalledWith("isDriverOnline", "true");
  });

  it("enregistre false avec la clé 'isDriverOnline'", async () => {
    await saveOnlineStatus(false);
    expect(mockSet).toHaveBeenCalledWith("isDriverOnline", "false");
  });

  it("n'émet pas d'erreur si AsyncStorage échoue", async () => {
    mockSet.mockRejectedValue(new Error("Storage error"));
    await expect(saveOnlineStatus(true)).resolves.not.toThrow();
  });
});

// ─── loadOnlineStatus ────────────────────────────────────────────────────────

describe("loadOnlineStatus", () => {
  it("retourne true quand le storage contient 'true'", async () => {
    mockGet.mockResolvedValue("true");
    expect(await loadOnlineStatus()).toBe(true);
  });

  it("retourne false quand le storage contient 'false'", async () => {
    mockGet.mockResolvedValue("false");
    expect(await loadOnlineStatus()).toBe(false);
  });

  it("retourne false quand il n'y a rien en storage (null)", async () => {
    mockGet.mockResolvedValue(null);
    expect(await loadOnlineStatus()).toBe(false);
  });

  it("retourne false si AsyncStorage lève une exception", async () => {
    mockGet.mockRejectedValue(new Error("Storage error"));
    expect(await loadOnlineStatus()).toBe(false);
  });
});
