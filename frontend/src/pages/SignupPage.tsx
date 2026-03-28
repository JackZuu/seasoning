import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";
import { signup } from "../api/auth";

export default function SignupPage() {
  const { login: setAuth } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      const data = await signup(email, password);
      setAuth(data.access_token, data.user);
      navigate("/dashboard");
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
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, marginBottom: 24, fontSize: 20 }}>Create account</h2>

          {error && (
            <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "10px 14px", color: colors.error, fontFamily: "system-ui, sans-serif", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

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

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>Password</label>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8, fontSize: 15, fontFamily: "system-ui, sans-serif", outline: "none", color: colors.text }}
              />
              <span style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>Minimum 8 characters</span>
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
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p style={{ marginTop: 20, textAlign: "center", fontSize: 13, fontFamily: "system-ui, sans-serif", color: colors.muted }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: colors.green, textDecoration: "none", fontWeight: 500 }}>
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
