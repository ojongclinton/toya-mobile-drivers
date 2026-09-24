import * as Location from "expo-location";
import * as navigationApi from "../api/navigation";
import { reportDriverLocation } from "../locationReporter";

jest.mock("expo-location", () => ({
  reverseGeocodeAsync: jest.fn(),
}));

jest.mock("../api/navigation", () => ({
  sendDriverLocation: jest.fn(),
}));

const mockReverseGeocode = Location.reverseGeocodeAsync as jest.Mock;
const mockSendLocation = navigationApi.sendDriverLocation as jest.Mock;

// Coordonnées de test (Douala, Cameroun)
const LAT = 4.0511;
const LON = 9.7679;

beforeEach(() => {
  jest.clearAllMocks();
  mockSendLocation.mockResolvedValue({ ok: true } as Response);
});

// ─── reportDriverLocation ───────────────────────────────────────────────────

describe("reportDriverLocation", () => {
  it("envoie l'adresse formatée 'ville, pays' au backend", async () => {
    mockReverseGeocode.mockResolvedValue([
      { city: "Douala", country: "Cameroun" },
    ]);
    await reportDriverLocation(LAT, LON);
    expect(mockSendLocation).toHaveBeenCalledWith(LAT, LON, "Douala, Cameroun");
  });

  it("supprime la virgule de tête si la ville est vide", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "", country: "Cameroun" }]);
    await reportDriverLocation(LAT, LON);
    expect(mockSendLocation).toHaveBeenCalledWith(LAT, LON, "Cameroun");
  });

  it("utilise les coordonnées comme adresse de secours si reverseGeocode échoue", async () => {
    mockReverseGeocode.mockRejectedValue(new Error("Réseau indisponible"));
    await reportDriverLocation(LAT, LON);
    expect(mockSendLocation).toHaveBeenCalledWith(
      LAT,
      LON,
      `${LAT.toFixed(5)}, ${LON.toFixed(5)}`
    );
  });

  it("utilise les coordonnées comme adresse de secours si reverseGeocode retourne []", async () => {
    mockReverseGeocode.mockResolvedValue([]);
    await reportDriverLocation(LAT, LON);
    expect(mockSendLocation).toHaveBeenCalledWith(
      LAT,
      LON,
      `${LAT.toFixed(5)}, ${LON.toFixed(5)}`
    );
  });

  it("appelle reverseGeocodeAsync avec les bonnes coordonnées", async () => {
    mockReverseGeocode.mockResolvedValue([{ city: "Yaoundé", country: "Cameroun" }]);
    await reportDriverLocation(LAT, LON);
    expect(mockReverseGeocode).toHaveBeenCalledWith({ latitude: LAT, longitude: LON });
  });

  it("n'émet pas d'exception si sendDriverLocation échoue", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    mockReverseGeocode.mockResolvedValue([{ city: "Douala", country: "Cameroun" }]);
    mockSendLocation.mockRejectedValue(new Error("Backend indisponible"));
    await expect(reportDriverLocation(LAT, LON)).resolves.not.toThrow();
  });
});
