import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./components/PrivateRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ParsePage from "./pages/ParsePage";
import RecipeDetailPage from "./pages/RecipeDetailPage";

export default function App() {
  return (
    <>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } body { margin: 0; }`}</style>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        <Route path="/recipes/new" element={<PrivateRoute><ParsePage /></PrivateRoute>} />
        <Route path="/recipes/:id" element={<PrivateRoute><RecipeDetailPage /></PrivateRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
