import React from "react";
import { render } from "@testing-library/react-native";
import { GPSWaitingLoader } from "../GPSWaitingLoader";

jest.mock("react-native-paper", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    Icon: ({ source }: { source: string }) =>
      React.createElement(Text, { testID: `icon-${source}` }, source),
  };
});

// ─── rendu ───────────────────────────────────────────────────────────────────

describe("GPSWaitingLoader — rendu", () => {
  it("se rend sans erreur avec visible=true", async () => {
    await expect(render(<GPSWaitingLoader visible={true} />)).resolves.toBeDefined();
  });

  it("se rend sans erreur avec visible=false", async () => {
    await expect(render(<GPSWaitingLoader visible={false} />)).resolves.toBeDefined();
  });

  it("affiche l'icône map-marker", async () => {
    const { getByTestId } = await render(<GPSWaitingLoader visible={true} />);
    expect(getByTestId("icon-map-marker")).toBeTruthy();
  });
});

// ─── snapshots ────────────────────────────────────────────────────────────────

describe("GPSWaitingLoader — snapshots", () => {
  it("snapshot visible=true", async () => {
    const { toJSON } = await render(<GPSWaitingLoader visible={true} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("snapshot visible=false", async () => {
    const { toJSON } = await render(<GPSWaitingLoader visible={false} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
