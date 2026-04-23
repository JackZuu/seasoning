import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import { useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ParsePage from "./pages/ParsePage";
import RecipeDetailPage from "./pages/RecipeDetailPage";
import LarderPage from "./pages/LarderPage";
import FriendsPage from "./pages/FriendsPage";
import BasketPage from "./pages/BasketPage";
import PreferencesPage from "./pages/PreferencesPage";

function LandingRoute() {
  const { token } = useAuth();
  return token ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

export default function App() {
  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #394036; background: #f0f2f1; }
        a { color: inherit; }
      `}</style>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/recipes/new" element={<PrivateRoute><ParsePage /></PrivateRoute>} />
        <Route path="/recipes/:id" element={<PrivateRoute><RecipeDetailPage /></PrivateRoute>} />
        <Route path="/larder" element={<PrivateRoute><LarderPage /></PrivateRoute>} />
        <Route path="/friends" element={<PrivateRoute><FriendsPage /></PrivateRoute>} />
        <Route path="/friends/:friendId/recipes/:recipeId" element={<PrivateRoute><RecipeDetailPage /></PrivateRoute>} />
        <Route path="/basket" element={<PrivateRoute><BasketPage /></PrivateRoute>} />
        <Route path="/preferences" element={<PrivateRoute><PreferencesPage /></PrivateRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
