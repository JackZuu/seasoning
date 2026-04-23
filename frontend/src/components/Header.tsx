import { useNavigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme";
import Wordmark from "./Wordmark";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Recipe Book" },
  { path: "/larder", label: "Larder" },
  { path: "/friends", label: "Friends" },
  { path: "/basket", label: "Basket" },
  { path: "/preferences", label: "Preferences" },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <div
      style={{
        background: colors.green,
        color: colors.white,
        padding: "clamp(10px, 2vw, 14px) clamp(16px, 5vw, 40px)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        fontFamily: fonts.sans,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link
          to={user ? "/dashboard" : "/"}
          style={{ textDecoration: "none", color: colors.white, marginRight: "auto" }}
        >
          <Wordmark layout="inline" iconSize={30} wordSize={22} variant="light" />
        </Link>

        {user && (
          <>
            <Link
              to="/recipes/new"
              style={{
                fontSize: 13,
                background: colors.greenMid,
                color: colors.white,
                padding: "7px 14px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              + Add Recipe
            </Link>
            <button
              onClick={handleLogout}
              style={{
                background: "none",
                border: "1px solid rgba(255,255,255,0.4)",
                borderRadius: 8,
                color: colors.white,
                padding: "6px 12px",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: fonts.sans,
              }}
            >
              Log out
            </button>
          </>
        )}
      </div>

      {user && (
        <nav style={{
          display: "flex", gap: 0, marginTop: 10,
          overflowX: "auto", WebkitOverflowScrolling: "touch",
        }}>
          {NAV_ITEMS.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  fontSize: 13,
                  color: colors.white,
                  opacity: active ? 1 : 0.75,
                  textDecoration: "none",
                  padding: "8px 14px",
                  borderBottom: active ? "2px solid white" : "2px solid transparent",
                  fontWeight: active ? 600 : 500,
                  whiteSpace: "nowrap",
                  transition: "opacity 0.15s",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
