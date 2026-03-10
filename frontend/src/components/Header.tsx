import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div
      style={{
        background: colors.green,
        color: colors.white,
        padding: "clamp(10px, 2.5vw, 16px) clamp(16px, 5vw, 40px)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <Link
        to="/dashboard"
        style={{ textDecoration: "none", color: colors.white, marginRight: "auto" }}
      >
        <span style={{ fontSize: "clamp(16px, 3.5vw, 22px)", fontFamily: "Georgia, serif", fontWeight: "bold", letterSpacing: 1 }}>
          Seasoning
        </span>
      </Link>

      {user ? (
        <>
          <span style={{ fontSize: 13, opacity: 0.8, display: "none" }}>{user.email}</span>
          <Link
            to="/dashboard"
            style={{ fontSize: 14, color: colors.white, opacity: 0.9, textDecoration: "none" }}
          >
            My Recipes
          </Link>
          <Link
            to="/recipes/new"
            style={{
              fontSize: 13,
              background: colors.greenMid,
              color: colors.white,
              padding: "6px 14px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            + New Recipe
          </Link>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 6,
              color: colors.white,
              padding: "5px 12px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ fontSize: 14, color: colors.white, opacity: 0.9, textDecoration: "none" }}>
            Log in
          </Link>
          <Link
            to="/signup"
            style={{
              fontSize: 13,
              background: colors.greenMid,
              color: colors.white,
              padding: "6px 14px",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Sign up
          </Link>
        </>
      )}
    </div>
  );
}
