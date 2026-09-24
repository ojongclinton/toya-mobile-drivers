import {
  getPendingRides,
  acceptRide,
  cancelRide,
  startRide,
  completeRide,
  getClientProfile,
  getRideAcceptedDetails,
  getCurrentRide,
} from "../rides";
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

// ─── getPendingRides ──────────────────────────────────────────────────────────

describe("getPendingRides", () => {
  it("appelle apiFetch avec le bon path", async () => {
    await getPendingRides();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/pending",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    const result = await getPendingRides();
    expect(result).toBe(fakeResponse);
  });
});

// ─── acceptRide ───────────────────────────────────────────────────────────────

describe("acceptRide", () => {
  it("appelle apiFetch avec le rideId dans le path (number)", async () => {
    await acceptRide(42);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/42/accept",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("appelle apiFetch avec le rideId dans le path (string)", async () => {
    await acceptRide("abc-123");
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/abc-123/accept",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("retourne la réponse de apiFetch", async () => {
    expect(await acceptRide(1)).toBe(fakeResponse);
  });
});

// ─── cancelRide ───────────────────────────────────────────────────────────────

describe("cancelRide", () => {
  it("appelle apiFetch avec la méthode POST et le bon path", async () => {
    await cancelRide(7);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/7/cancel",
      expect.objectContaining({ method: "POST" })
    );
  });
});

// ─── startRide ────────────────────────────────────────────────────────────────

describe("startRide", () => {
  it("appelle apiFetch avec la méthode GET et le bon path", async () => {
    await startRide(3);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/3/start",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ─── completeRide ─────────────────────────────────────────────────────────────

describe("completeRide", () => {
  it("appelle apiFetch avec la méthode GET et le bon path", async () => {
    await completeRide(5);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/5/complete",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ─── getClientProfile ─────────────────────────────────────────────────────────

describe("getClientProfile", () => {
  it("appelle apiFetch avec le clientId dans le path", async () => {
    await getClientProfile(99);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/profile/99",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ─── getRideAcceptedDetails ───────────────────────────────────────────────────

describe("getRideAcceptedDetails", () => {
  it("appelle apiFetch avec le trailing slash", async () => {
    await getRideAcceptedDetails(10);
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/10/accepted/",
      expect.objectContaining({ method: "GET" })
    );
  });
});

// ─── getCurrentRide ───────────────────────────────────────────────────────────

describe("getCurrentRide", () => {
  it("appelle apiFetch sur /rides/driver/current-ride", async () => {
    await getCurrentRide();
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/rides/driver/current-ride",
      expect.objectContaining({ method: "GET" })
    );
  });
});
