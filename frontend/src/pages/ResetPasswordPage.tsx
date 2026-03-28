import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { colors } from "../theme";
import { resetPassword } from "../api/auth";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const email = params.get("email") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setError("");
    setLoading(true);
    try {
      await resetPassword(email, token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
          <div style={{ background: colors.white, borderRadius: 12, padding: "32px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: `1px solid ${colors.border}` }}>
            <p style={{ fontFamily: "system-ui, sans-serif", color: colors.error, fontSize: 14, marginBottom: 16 }}>
              Invalid reset link. Please request a new one.
            </p>
            <Link to="/forgot-password" style={{ color: colors.green, textDecoration: "none", fontWeight: 500, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
              Request reset link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <h1 style={{ fontFamily: "Georgia, serif", color: colors.green, textAlign: "center", marginBottom: 8, fontSize: 28 }}>
          Seasoning
        </h1>
        <p style={{ textAlign: "center", color: colors.muted, fontFamily: "system-ui, sans-serif", fontSize: 14, marginBottom: 32 }}>
          A pinch of you
        </p>

        <div style={{ background: colors.white, borderRadius: 12, padding: "32px 28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", border: `1px solid ${colors.border}` }}>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, marginBottom: 24, fontSize: 20 }}>Set new password</h2>

          {error && (
            <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "10px 14px", color: colors.error, fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {done ? (
            <div style={{ background: colors.greenLight, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "14px 16px", fontFamily: "system-ui, sans-serif", fontSize: 14, color: colors.green }}>
              Password reset successfully.{" "}
              <Link to="/login" style={{ color: colors.green, fontWeight: 600, textDecoration: "underline" }}>
                Log in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>New password</label>
                <input
                  type="password"
                  name="new-password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 15, fontFamily: "system-ui, sans-serif", outline: "none", color: colors.text }}
                />
                <span style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>Minimum 8 characters</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 13, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>Confirm password</label>
                <input
                  type="password"
                  name="confirm-password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
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
                {loading ? "Resetting..." : "Reset password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
