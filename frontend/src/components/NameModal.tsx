import { useState } from "react";
import { colors } from "../theme";
import SaltShakerLogo from "./SaltShakerLogo";

interface Props {
  onSave: (name: string) => Promise<void>;
}

export default function NameModal({ onSave }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError("");
    setLoading(true);
    try {
      await onSave(name.trim());
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: colors.white, borderRadius: 16, padding: "40px 32px",
        maxWidth: 400, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.2)",
        textAlign: "center", fontFamily: "system-ui, sans-serif",
      }}>
        <SaltShakerLogo size={48} color={colors.green} />
        <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, marginTop: 16, marginBottom: 8, fontSize: 22 }}>
          Welcome to Seasoning
        </h2>
        <p style={{ color: colors.muted, fontSize: 14, marginBottom: 28, lineHeight: 1.5 }}>
          What shall we call you?
        </p>

        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "10px 14px", color: colors.error, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="text"
            autoFocus
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={loading}
            style={{
              padding: "12px 16px", border: `1px solid ${colors.border}`, borderRadius: 10,
              fontSize: 16, fontFamily: "system-ui, sans-serif", outline: "none",
              color: colors.text, textAlign: "center",
            }}
          />
          <button
            type="submit"
            disabled={!name.trim() || loading}
            style={{
              background: name.trim() && !loading ? colors.green : colors.muted,
              color: colors.white, border: "none", borderRadius: 10,
              padding: "12px", fontSize: 15, fontWeight: 600,
              cursor: name.trim() && !loading ? "pointer" : "not-allowed",
            }}
          >
            {loading ? "Setting up..." : "Let's get cooking"}
          </button>
        </form>
      </div>
    </div>
  );
}
