import { colors } from "../theme";

interface Props {
  onClose: () => void;
  onSwitchToText: () => void;
}

export default function NotRecipePopup({ onClose, onSwitchToText }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: colors.white,
          borderRadius: 12,
          padding: "32px 28px",
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 16 }}>🧂</div>
        <h3 style={{
          fontFamily: "Georgia, serif",
          color: colors.text,
          fontSize: 18,
          marginBottom: 12,
        }}>
          Couldn't find a recipe
        </h3>
        <p style={{ color: colors.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Our AI couldn't find a recipe in what you provided. To add a recipe, take a clear
          picture of the recipe including ingredients and method, or try pasting the text instead.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              color: colors.muted,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            onClick={onSwitchToText}
            style={{
              background: colors.green,
              color: colors.white,
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Paste text instead
          </button>
        </div>
      </div>
    </div>
  );
}
