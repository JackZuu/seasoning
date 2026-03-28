import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import SaltShakerLogo from "../components/SaltShakerLogo";
import { colors } from "../theme";
import { getRecipe, convertRecipe, Recipe, Ingredient } from "../api/recipes";

function formatQuantity(q: number | null): string {
  if (q === null) return "";
  // Show as fraction-friendly display
  const fractions: [number, string][] = [
    [0.125, "⅛"], [0.25, "¼"], [0.333, "⅓"], [0.5, "½"],
    [0.667, "⅔"], [0.75, "¾"],
  ];
  const whole = Math.floor(q);
  const remainder = q - whole;
  for (const [val, sym] of fractions) {
    if (Math.abs(remainder - val) < 0.04) {
      return whole > 0 ? `${whole} ${sym}` : sym;
    }
  }
  // Round to 2 decimal places, trim trailing zeros
  return parseFloat(q.toFixed(2)).toString();
}

function IngredientRow({ ing }: { ing: Ingredient }) {
  return (
    <li style={{
      display: "flex",
      gap: 8,
      padding: "8px 0",
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: "system-ui, sans-serif",
      fontSize: 14,
      color: colors.text,
      alignItems: "baseline",
    }}>
      <span style={{ minWidth: 60, fontWeight: 500, color: colors.green }}>
        {ing.quantity !== null ? formatQuantity(ing.quantity) : ""}
        {ing.unit ? ` ${ing.unit}` : ""}
      </span>
      <span>
        {ing.item}
        {ing.preparation ? <span style={{ color: colors.muted }}>, {ing.preparation}</span> : null}
        {ing.notes ? <span style={{ color: colors.muted }}> ({ing.notes})</span> : null}
      </span>
    </li>
  );
}

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [displayIngredients, setDisplayIngredients] = useState<Ingredient[]>([]);
  const [unitSystem, setUnitSystem] = useState<"us_customary" | "metric">("us_customary");
  const [converting, setConverting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getRecipe(parseInt(id))
      .then(r => {
        setRecipe(r);
        setDisplayIngredients(r.ingredients);
        // Detect initial unit system from first ingredient
        const first = r.ingredients[0];
        if (first) setUnitSystem(first.unit_system);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleUnitChange(target: "us_customary" | "metric") {
    if (!recipe || target === unitSystem) return;
    setConverting(true);
    try {
      const converted = await convertRecipe(recipe.id, target);
      setDisplayIngredients(converted);
      setUnitSystem(target);
    } catch (e: any) {
      alert("Conversion failed: " + e.message);
    } finally {
      setConverting(false);
    }
  }

  const date = recipe
    ? new Date(recipe.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 40px)", flex: 1 }}>
        {loading && <LoadingSpinner label="Loading recipe..." />}

        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "12px 16px", color: colors.error, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
            {error}
          </div>
        )}

        {recipe && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {/* Title & meta */}
            <div>
              <button
                onClick={() => navigate("/dashboard")}
                style={{ background: "none", border: "none", color: colors.muted, fontSize: 13, fontFamily: "system-ui, sans-serif", cursor: "pointer", padding: "0 0 12px 0", display: "flex", alignItems: "center", gap: 4 }}
              >
                ← All recipes
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <SaltShakerLogo size={28} />
                <h1 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(22px, 5vw, 32px)", margin: 0, lineHeight: 1.2 }}>
                  {recipe.title}
                </h1>
              </div>
              <div style={{ display: "flex", gap: 16, color: colors.muted, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
                {recipe.servings && <span>Serves {recipe.servings}</span>}
                <span>Added {date}</span>
              </div>
            </div>

            {/* Ingredients */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, margin: 0 }}>
                  Ingredients
                </h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {converting && <span style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>Converting...</span>}
                  <select
                    value={unitSystem}
                    onChange={e => handleUnitChange(e.target.value as "us_customary" | "metric")}
                    disabled={converting}
                    style={{
                      fontSize: 13,
                      fontFamily: "system-ui, sans-serif",
                      border: `1px solid ${colors.border}`,
                      borderRadius: 6,
                      padding: "5px 10px",
                      background: colors.white,
                      color: colors.text,
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="us_customary">US Customary</option>
                    <option value="metric">Metric</option>
                  </select>
                </div>
              </div>

              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {displayIngredients.map((ing, i) => (
                  <IngredientRow key={i} ing={ing} />
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, marginBottom: 16 }}>
                Instructions
              </h2>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {recipe.instructions.map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{
                      minWidth: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: colors.green,
                      color: colors.white,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      flexShrink: 0,
                      marginTop: 2,
                    }}>
                      {step.step}
                    </span>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65, color: colors.text }}>
                      {step.text}
                      {step.duration_minutes && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: colors.muted }}>
                          (~{step.duration_minutes} min)
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
