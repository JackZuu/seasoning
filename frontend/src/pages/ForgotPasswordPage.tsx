import { useState } from "react";
import { Link } from "react-router-dom";
import { colors } from "../theme";
import { forgotPassword } from "../api/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ fontFamily: "Georgia, serif", color: colors.green, textAlign: "center", marginBottom: 8, fontSize: 28 }}>
          Seasoning
        </h1>
        <p style={{ textAlign: "center", color: colors.muted, fontFamily: "system-ui, sans-serif", fontSize: 14, marginBottom: 32 }}>
          Your recipe collection
        </p>

        <div style={{ background: colors.white, borderRadius: 12, padding: "32px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: `1px solid ${colors.border}` }}>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, marginBottom: 8, fontSize: 20 }}>Reset password</h2>
          <p style={{ fontFamily: "system-ui, sans-serif", color: colors.muted, fontSize: 13, marginBottom: 24 }}>
            Enter your email and we'll send you a link to reset your password.
          </p>

          {error && (
            <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "10px 14px", color: colors.error, fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {sent ? (
            <div style={{ background: colors.greenLight, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px 16px", fontFamily: "system-ui, sans-serif", fontSize: 14, color: colors.green }}>
              If an account with that email exists, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>Email</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 15, fontFamily: "system-ui, sans-serif", outline: "none", color: colors.text }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  background: loading ? colors.muted : colors.green,
                  color: colors.white,
                  border: "none",
                  borderRadius: 8,
                  padding: "12px",
                  fontSize: 15,
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  marginTop: 4,
                }}
              >
                {loading ? "Sending..." : "Send reset link"}
              </button>
            </form>
          )}

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, fontFamily: "system-ui, sans-serif", color: colors.muted }}>
            <Link to="/login" style={{ color: colors.green, textDecoration: "none", fontWeight: 500 }}>
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
