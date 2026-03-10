import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import { colors } from "../theme";
import { parseRecipe } from "../api/recipes";

export default function ParsePage() {
  const navigate = useNavigate();
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleParse() {
    if (!rawText.trim()) return;
    setError("");
    setLoading(true);
    try {
      const recipe = await parseRecipe(rawText);
      navigate(`/recipes/${recipe.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 40px)", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 6 }}>
            Add a Recipe
          </h2>
          <p style={{ color: colors.muted, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
            Paste any recipe text below — from a website, a book, or your own notes. AI will extract and structure it for you.
          </p>
        </div>

        <div style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: "4px",
          flex: 1,
        }}>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            disabled={loading}
            placeholder={`Paste your recipe here...\n\nExample:\nChocolate Chip Cookies\nMakes 24 cookies\n\nIngredients:\n2 cups all-purpose flour\n1 tsp baking soda\n...`}
            style={{
              width: "100%",
              minHeight: 360,
              padding: "16px",
              border: "none",
              outline: "none",
              resize: "vertical",
              fontSize: 14,
              fontFamily: "system-ui, sans-serif",
              lineHeight: 1.7,
              color: colors.text,
              background: "transparent",
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "12px 16px", color: colors.error, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner label="Parsing recipe with AI..." />
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "none",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                color: colors.muted,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleParse}
              disabled={!rawText.trim()}
              style={{
                background: rawText.trim() ? colors.green : colors.muted,
                color: colors.white,
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                cursor: rawText.trim() ? "pointer" : "not-allowed",
              }}
            >
              Parse Recipe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
