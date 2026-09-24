import {
  getHotZones,
  getPickupNavigation,
  getDropoffNavigation,
  sendDriverLocation,
} from "../navigation";
import { apiFetch, getLanguage } from "../http";

jest.mock("../http", () => ({
  apiFetch: jest.fn(),
  getLanguage: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;
const mockGetLanguage = getLanguage as jest.Mock;
const fakeResponse = new Response("{}", { status: 200 });

beforeEach(() => {
  mockApiFetch.mockResolvedValue(fakeResponse);
  mockGetLanguage.mockResolvedValue("fr");
});
afterEach(() => jest.clearAllMocks());

// ─── getHotZones ─────────────────────────────────────────────────────────────

describe("getHotZones", () => {
  it("appelle apiFetch avec city_wide=true", async () => {
    await getHotZones();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/navigation/hot-zones?city_wide=true",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getHotZones()).toBe(fakeResponse);
  });
});

// ─── getPickupNavigation ──────────────────────────────────────────────────────

describe("getPickupNavigation", () => {
  it("inclut la langue dans l'URL (fr par défaut)", async () => {
    mockGetLanguage.mockResolvedValue("fr");
    await getPickupNavigation(5);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/navigation/pickup/5?lang=fr",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("inclut la langue dans l'URL (en)", async () => {
    mockGetLanguage.mockResolvedValue("en");
    await getPickupNavigation(5);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/navigation/pickup/5?lang=en",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("appelle getLanguage pour récupérer la langue", async () => {
    await getPickupNavigation(5);
    expect(mockGetLanguage).toHaveBeenCalledTimes(1);
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getPickupNavigation(5)).toBe(fakeResponse);
  });
});

// ─── getDropoffNavigation ─────────────────────────────────────────────────────

describe("getDropoffNavigation", () => {
  it("inclut la langue dans l'URL", async () => {
    mockGetLanguage.mockResolvedValue("fr");
    await getDropoffNavigation(8);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/navigation/dropoff/8?lang=fr",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("appelle getLanguage pour récupérer la langue", async () => {
    await getDropoffNavigation(8);
    expect(mockGetLanguage).toHaveBeenCalledTimes(1);
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getDropoffNavigation(8)).toBe(fakeResponse);
  });
});

// ─── sendDriverLocation ───────────────────────────────────────────────────────

describe("sendDriverLocation", () => {
  it("appelle apiFetch avec la méthode POST", async () => {
    await sendDriverLocation(4.05, 9.77, "Douala");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/navigation/send-driver-location",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("transmet lat, lon et address dans le body", async () => {
    await sendDriverLocation(4.05, 9.77, "Douala, Cameroun");
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: { lat: 4.05, lon: 9.77, address: "Douala, Cameroun" },
      })
    );
  });

  it("lat et lon sont transmis avec précision", async () => {
    await sendDriverLocation(48.8566, 2.3522, "Paris");
    const [, options] = mockApiFetch.mock.calls[0];
    expect(options.body.lat).toBeCloseTo(48.8566, 4);
    expect(options.body.lon).toBeCloseTo(2.3522, 4);
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await sendDriverLocation(0, 0, "")).toBe(fakeResponse);
  });
});
