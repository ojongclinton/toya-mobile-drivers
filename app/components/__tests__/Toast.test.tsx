import React from "react";
import { Animated } from "react-native";
import { render } from "@testing-library/react-native";
import { Toast } from "../Toast";

const makeOpacity = (val = 1) => new Animated.Value(val);

// ─── visibilité ──────────────────────────────────────────────────────────────

describe("Toast — visibilité", () => {
  it("retourne null quand visible=false", async () => {
    const { toJSON } = await render(
      <Toast visible={false} opacity={makeOpacity()} text="test" variant="cancel" />
    );
    expect(toJSON()).toBeNull();
  });

  it("affiche le texte quand visible=true", async () => {
    const { getByText } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="Course annulée" variant="cancel" />
    );
    expect(getByText("Course annulée")).toBeTruthy();
  });
});

// ─── variantes ───────────────────────────────────────────────────────────────

describe("Toast — variantes de couleur", () => {
  it("variant cancel → backgroundColor #2e7d32", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="msg" variant="cancel" />
    );
    const json = toJSON() as any;
    const styles: object[] = Array.isArray(json.props.style)
      ? json.props.style
      : [json.props.style];
    expect(styles).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#2e7d32" })])
    );
  });

  it("variant accept → backgroundColor #1565c0", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="msg" variant="accept" />
    );
    const json = toJSON() as any;
    const styles: object[] = Array.isArray(json.props.style)
      ? json.props.style
      : [json.props.style];
    expect(styles).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#1565c0" })])
    );
  });

  it("variant complete → backgroundColor #6a1b9a", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="msg" variant="complete" />
    );
    const json = toJSON() as any;
    const styles: object[] = Array.isArray(json.props.style)
      ? json.props.style
      : [json.props.style];
    expect(styles).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: "#6a1b9a" })])
    );
  });
});

// ─── snapshots ───────────────────────────────────────────────────────────────

describe("Toast — snapshots", () => {
  it("snapshot variant cancel", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="Annulé" variant="cancel" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("snapshot variant accept", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="Accepté" variant="accept" />
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("snapshot variant complete", async () => {
    const { toJSON } = await render(
      <Toast visible={true} opacity={makeOpacity()} text="Terminé" variant="complete" />
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
