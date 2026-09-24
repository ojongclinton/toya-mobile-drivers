import {
  getDriverProfile,
  getVehicleValidation,
  getWalletHistory,
  updateAvailability,
} from "../driver";
import { apiFetch } from "../http";

jest.mock("../http", () => ({
  apiFetch: jest.fn(),
}));

const mockApiFetch = apiFetch as jest.Mock;
const fakeResponse = new Response("{}", { status: 200 });

beforeEach(() => {
  mockApiFetch.mockResolvedValue(fakeResponse);
});
afterEach(() => jest.clearAllMocks());

// ─── getDriverProfile ─────────────────────────────────────────────────────────

describe("getDriverProfile", () => {
  it("appelle apiFetch sur /drivers/profile/", async () => {
    await getDriverProfile();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/drivers/profile/",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getDriverProfile()).toBe(fakeResponse);
  });
});

// ─── getVehicleValidation ─────────────────────────────────────────────────────

describe("getVehicleValidation", () => {
  it("appelle apiFetch sur /drivers/vehicle/validation_status", async () => {
    await getVehicleValidation();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/drivers/vehicle/validation_status",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getVehicleValidation()).toBe(fakeResponse);
  });
});

// ─── getWalletHistory ─────────────────────────────────────────────────────────

describe("getWalletHistory", () => {
  it("appelle apiFetch sur /payments/wallet/history", async () => {
    await getWalletHistory();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/payments/wallet/history",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await getWalletHistory()).toBe(fakeResponse);
  });
});

// ─── updateAvailability ───────────────────────────────────────────────────────

describe("updateAvailability", () => {
  it("appelle apiFetch avec la méthode POST sur /drivers/update_availability/", async () => {
    await updateAvailability(true);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/drivers/update_availability/",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("transmet available=true dans le body", async () => {
    await updateAvailability(true);
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: { available: true } })
    );
  });

  it("transmet available=false dans le body", async () => {
    await updateAvailability(false);
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: { available: false } })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await updateAvailability(true)).toBe(fakeResponse);
  });
});
