import AsyncStorage from "@react-native-async-storage/async-storage";
import { resetToLogin } from "../navigationService";
import { apiFetch, getLanguage } from "../api/http";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

jest.mock("../../../constants/api/BASE_URL", () => "https://api.test.com");

jest.mock("../navigationService", () => ({
  resetToLogin: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

const mockGet = AsyncStorage.getItem as jest.Mock;
const mockResetToLogin = resetToLogin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ status: 200, ok: true } as Response);
  mockGet.mockResolvedValue(null);
});

// ─── apiFetch — construction de la requête ──────────────────────────────────

describe("apiFetch — construction de la requête", () => {
  it("appelle fetch avec BASE_URL + path", async () => {
    await apiFetch("/users");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.test.com/users",
      expect.any(Object)
    );
  });

  it("utilise GET comme méthode par défaut", async () => {
    await apiFetch("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "GET" })
    );
  });

  it("utilise la méthode fournie (POST)", async () => {
    await apiFetch("/test", { method: "POST" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("inclut le header Content-Type: application/json", async () => {
    await apiFetch("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      })
    );
  });

  it("inclut le header Authorization: Bearer <token>", async () => {
    mockGet.mockResolvedValue("mon-token-secret");
    await apiFetch("/profile");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer mon-token-secret",
        }),
      })
    );
  });

  it("sérialise le body en JSON", async () => {
    await apiFetch("/rides", { method: "POST", body: { id: 42 } });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: '{"id":42}' })
    );
  });

  it("envoie body: undefined quand aucun body fourni", async () => {
    await apiFetch("/test");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: undefined })
    );
  });

  it("retourne la réponse fetch", async () => {
    const fakeResp = { status: 200, ok: true } as any;
    mockFetch.mockResolvedValue(fakeResp);
    const result = await apiFetch("/test");
    expect(result).toBe(fakeResp);
  });
});

// ─── apiFetch — gestion 401 ─────────────────────────────────────────────────

describe("apiFetch — gestion 401", () => {
  beforeEach(() => {
    mockFetch.mockResolvedValue({ status: 401, ok: false } as Response);
  });

  it("appelle resetToLogin si le token est présent et le compte non suspendu", async () => {
    // getAuthHeaders + 401 handler lisent chacun authToken → mockResolvedValue couvre les deux
    mockGet.mockResolvedValue("token-valide");
    await apiFetch("/protected");
    expect(mockResetToLogin).toHaveBeenCalled();
  });

  it("n'appelle pas resetToLogin si aucun token en storage", async () => {
    mockGet.mockResolvedValue(null);
    await apiFetch("/protected");
    expect(mockResetToLogin).not.toHaveBeenCalled();
  });

  it("n'appelle pas resetToLogin si le compte est suspendu (accountSuspended=true)", async () => {
    mockGet
      .mockResolvedValueOnce("token-valide")  // getAuthHeaders : authToken
      .mockResolvedValueOnce("token-valide")  // handler 401 : authToken
      .mockResolvedValueOnce("true");          // handler 401 : accountSuspended
    await apiFetch("/protected");
    expect(mockResetToLogin).not.toHaveBeenCalled();
  });

  it("retourne quand même la réponse 401 sans la relancer", async () => {
    mockGet.mockResolvedValue(null);
    const result = await apiFetch("/protected");
    expect(result).toMatchObject({ status: 401 });
  });
});

// ─── getLanguage ────────────────────────────────────────────────────────────

describe("getLanguage", () => {
  it("retourne la langue stockée dans AsyncStorage", async () => {
    mockGet.mockResolvedValue("en");
    expect(await getLanguage()).toBe("en");
  });

  it("retourne 'fr' par défaut si rien en storage", async () => {
    mockGet.mockResolvedValue(null);
    expect(await getLanguage()).toBe("fr");
  });
});
