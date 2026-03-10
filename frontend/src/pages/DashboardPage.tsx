import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import RecipeCard from "../components/RecipeCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { colors } from "../theme";
import { listRecipes, deleteRecipe, RecipeListItem } from "../api/recipes";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listRecipes()
      .then(setRecipes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: number) {
    try {
      await deleteRecipe(id);
      setRecipes(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ maxWidth: 1000, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", margin: 0 }}>
            My Recipes
          </h2>
          <button
            onClick={() => navigate("/recipes/new")}
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
            + New Recipe
          </button>
        </div>

        {loading && <LoadingSpinner label="Loading recipes..." />}

        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "12px 16px", color: colors.error, fontSize: 13 }}>
            {error}
          </div>
        )}

        {!loading && !error && recipes.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "64px 24px",
            background: colors.white,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🍴</div>
            <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, marginBottom: 8 }}>No recipes yet</h3>
            <p style={{ color: colors.muted, fontSize: 14, marginBottom: 24 }}>
              Paste in a recipe to get started.
            </p>
            <button
              onClick={() => navigate("/recipes/new")}
              style={{
                background: colors.green,
                color: colors.white,
                border: "none",
                borderRadius: 8,
                padding: "10px 24px",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Parse your first recipe
            </button>
          </div>
        )}

        {!loading && recipes.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 16,
          }}>
            {recipes.map(r => (
              <RecipeCard key={r.id} recipe={r} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
