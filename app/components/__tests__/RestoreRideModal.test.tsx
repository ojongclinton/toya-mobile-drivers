import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import { RestoreRideModal } from "../RestoreRideModal";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-paper", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Icon: ({ source }: { source: string }) =>
      React.createElement(Text, { testID: `icon-${source}` }, source),
  };
});

jest.mock("@/constants/Colors", () => ({
  Colors: { light: { tint: "#7D5FFF" } },
}));

const baseRideData = {
  client: { full_name: "Jean Dupont", profile_picture: null },
  pickup: { location: "Aéroport de Douala" },
  destination: { location: "Centre-ville" },
  ride_details: { final_price: "3500", distance: "12" },
};

const defaultProps = {
  visible: true,
  phase: "pickup" as const,
  rideData: baseRideData,
  onConfirm: jest.fn(),
  onCancel: jest.fn(),
  onComplete: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ─── titre selon la phase ─────────────────────────────────────────────────────

describe("RestoreRideModal — titre par phase", () => {
  it("phase pickup → clé restore_ride_title_pickup", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="pickup" />
    );
    expect(getByText("restore_ride_title_pickup")).toBeTruthy();
  });

  it("phase in_progress → clé restore_ride_title_inprogress", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="in_progress" />
    );
    expect(getByText("restore_ride_title_inprogress")).toBeTruthy();
  });

  it("phase pickup → sous-titre restore_ride_subtitle_pickup", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="pickup" />
    );
    expect(getByText("restore_ride_subtitle_pickup")).toBeTruthy();
  });

  it("phase in_progress → sous-titre restore_ride_subtitle_inprogress", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="in_progress" />
    );
    expect(getByText("restore_ride_subtitle_inprogress")).toBeTruthy();
  });
});

// ─── boutons selon la phase ───────────────────────────────────────────────────

describe("RestoreRideModal — boutons par phase", () => {
  it("phase pickup → bouton annuler présent (restore_ride_cancel)", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="pickup" />
    );
    expect(getByText("restore_ride_cancel")).toBeTruthy();
  });

  it("phase pickup → pas de bouton terminer", async () => {
    const { queryByText } = await render(
      <RestoreRideModal {...defaultProps} phase="pickup" />
    );
    expect(queryByText("restore_ride_complete")).toBeNull();
  });

  it("phase in_progress → bouton terminer présent (restore_ride_complete)", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="in_progress" />
    );
    expect(getByText("restore_ride_complete")).toBeTruthy();
  });

  it("phase in_progress → pas de bouton annuler", async () => {
    const { queryByText } = await render(
      <RestoreRideModal {...defaultProps} phase="in_progress" />
    );
    expect(queryByText("restore_ride_cancel")).toBeNull();
  });
});

// ─── données de course ────────────────────────────────────────────────────────

describe("RestoreRideModal — données rideData", () => {
  it("affiche le nom du client", async () => {
    const { getByText } = await render(<RestoreRideModal {...defaultProps} />);
    expect(getByText("Jean Dupont")).toBeTruthy();
  });

  it("affiche l'adresse de destination", async () => {
    const { getByText } = await render(<RestoreRideModal {...defaultProps} />);
    expect(getByText(/Centre-ville/)).toBeTruthy();
  });

  it("phase pickup → affiche l'adresse de ramassage", async () => {
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} phase="pickup" />
    );
    expect(getByText(/Aéroport de Douala/)).toBeTruthy();
  });

  it("affiche le prix et la distance", async () => {
    const { getByText } = await render(<RestoreRideModal {...defaultProps} />);
    expect(getByText("3500 CFA")).toBeTruthy();
    expect(getByText("12 km")).toBeTruthy();
  });

  it("rideData=null → pas d'erreur, composant rendu quand même", async () => {
    await expect(
      render(<RestoreRideModal {...defaultProps} rideData={null} />)
    ).resolves.toBeDefined();
  });
});

// ─── callbacks ────────────────────────────────────────────────────────────────

describe("RestoreRideModal — callbacks", () => {
  it("appui bouton primary → onConfirm appelé", async () => {
    const onConfirm = jest.fn();
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} onConfirm={onConfirm} phase="pickup" />
    );
    await act(() => { fireEvent.press(getByText("restore_ride_resume")); });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("phase pickup — appui annuler → onCancel appelé", async () => {
    const onCancel = jest.fn();
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} onCancel={onCancel} phase="pickup" />
    );
    await act(() => { fireEvent.press(getByText("restore_ride_cancel")); });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("phase in_progress — appui terminer → onComplete appelé", async () => {
    const onComplete = jest.fn();
    const { getByText } = await render(
      <RestoreRideModal {...defaultProps} onComplete={onComplete} phase="in_progress" />
    );
    await act(() => { fireEvent.press(getByText("restore_ride_complete")); });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
