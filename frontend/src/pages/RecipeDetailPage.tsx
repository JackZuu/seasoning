import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import SaltShakerLogo from "../components/SaltShakerLogo";
import { colors } from "../theme";
import {
  getRecipe, convertRecipe, updateNotes, uploadRecipeImage,
  transformRecipe, substituteIngredient, getNutrition, estimateCost,
  Recipe, Ingredient, TransformResponse, SubstitutionResponse, NutritionResponse, CostResponse,
} from "../api/recipes";
import { addRecipeToBasket } from "../api/basket";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQuantity(q: number | null): string {
  if (q === null) return "";
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
  return parseFloat(q.toFixed(2)).toString();
}

const TRANSFORMATIONS = [
  { key: "personalise", label: "Personalise", tooltip: "Based on your preferences" },
  { key: "veggie", label: "Make Veggie", tooltip: "" },
  { key: "vegan", label: "Make Vegan", tooltip: "" },
  { key: "seasonal", label: "Make Seasonal", tooltip: "" },
  { key: "eco", label: "Reduce Impact", tooltip: "" },
  { key: "cheaper", label: "Make Cheaper", tooltip: "" },
  { key: "luxurious", label: "Make Luxurious", tooltip: "" },
] as const;

const DIETARY_OPTIONS = [
  "Gluten-free", "Dairy-free", "Nut-free", "Egg-free",
  "Soy-free", "Shellfish-free", "Halal", "Kosher",
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function IngredientRow({ ing, scaleFactor, substitution, onSubstitute, substituting }: {
  ing: Ingredient;
  scaleFactor: number;
  substitution?: SubstitutionResponse;
  onSubstitute: () => void;
  substituting: boolean;
}) {
  const scaledQty = ing.quantity !== null ? ing.quantity * scaleFactor : null;

  if (substitution) {
    return (
      <li style={{ padding: "10px 0", borderBottom: `1px solid ${colors.border}`, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ color: colors.green, fontWeight: 500 }}>↻</span>
          <span style={{ color: colors.green, fontWeight: 500 }}>{substitution.substitute}</span>
        </div>
        <div style={{ fontSize: 12, color: colors.muted, marginTop: 4, paddingLeft: 20, lineHeight: 1.5 }}>
          {substitution.reasoning}
        </div>
      </li>
    );
  }

  return (
    <li style={{
      display: "flex", gap: 8, padding: "10px 0",
      borderBottom: `1px solid ${colors.border}`,
      fontFamily: "system-ui, sans-serif", fontSize: 14,
      color: colors.text, alignItems: "baseline",
    }}>
      <span style={{ minWidth: 60, fontWeight: 500, color: colors.green }}>
        {scaledQty !== null ? formatQuantity(scaledQty) : ""}
        {ing.unit ? ` ${ing.unit}` : ""}
      </span>
      <span style={{ flex: 1 }}>
        {ing.item}
        {ing.preparation ? <span style={{ color: colors.muted }}>, {ing.preparation}</span> : null}
        {ing.notes ? <span style={{ color: colors.muted }}> ({ing.notes})</span> : null}
      </span>
      <button
        onClick={onSubstitute}
        disabled={substituting}
        title="Don't have this?"
        style={{
          background: "none", border: `1px solid ${colors.border}`, borderRadius: 6,
          padding: "3px 8px", fontSize: 11, color: colors.muted, cursor: "pointer",
          whiteSpace: "nowrap", flexShrink: 0,
        }}
      >
        {substituting ? "..." : "Swap?"}
      </button>
    </li>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Core state
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Servings
  const [adjustedServings, setAdjustedServings] = useState<number | null>(null);

  // Ingredients display
  const [displayIngredients, setDisplayIngredients] = useState<Ingredient[]>([]);
  const [unitSystem, setUnitSystem] = useState<"us_customary" | "metric">("us_customary");
  const [converting, setConverting] = useState(false);

  // Transformations
  const [activeTransform, setActiveTransform] = useState<string | null>(null);
  const [transformData, setTransformData] = useState<TransformResponse | null>(null);
  const [transforming, setTransforming] = useState(false);

  // Dietary
  const [dietaryReqs, setDietaryReqs] = useState<string[]>([]);
  const [showDietary, setShowDietary] = useState(false);

  // Substitutions
  const [substitutions, setSubstitutions] = useState<Record<string, SubstitutionResponse>>({});
  const [substitutingItem, setSubstitutingItem] = useState<string | null>(null);

  // Notes
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);

  // Nutrition
  const [nutrition, setNutrition] = useState<NutritionResponse | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);

  // Image
  const [uploadingImage, setUploadingImage] = useState(false);

  // Cost
  const [cost, setCost] = useState<CostResponse | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [showCost, setShowCost] = useState(false);

  // Basket
  const [addedToBasket, setAddedToBasket] = useState(false);

  // ─── Load recipe ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return;
    getRecipe(parseInt(id))
      .then(r => {
        setRecipe(r);
        setDisplayIngredients(r.ingredients);
        setNotes(r.notes || "");
        setAdjustedServings(r.servings);
        const first = r.ingredients[0];
        if (first) setUnitSystem(first.unit_system);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ─── Servings scaling ────────────────────────────────────────────────────

  const scaleFactor = (recipe?.servings && adjustedServings)
    ? adjustedServings / recipe.servings
    : 1;

  // ─── Unit conversion ─────────────────────────────────────────────────────

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

  // ─── Transformations ─────────────────────────────────────────────────────

  async function handleTransform(type: string) {
    if (!recipe) return;
    if (activeTransform === type) {
      showOriginal();
      return;
    }
    setTransforming(true);
    setActiveTransform(type);
    try {
      let transformType = type;
      let reqs = [...dietaryReqs];

      // "Personalise" uses the user's saved preferences
      if (type === "personalise" && user?.preferences) {
        const prefs = user.preferences;
        transformType = prefs.diet || prefs.budget || "seasonal";
        if (prefs.dietary_requirements) reqs = [...reqs, ...prefs.dietary_requirements];
        if (prefs.seasonal) transformType = "seasonal";
        if (prefs.eco) transformType = "eco";
        if (prefs.diet === "veggie") transformType = "veggie";
        if (prefs.diet === "vegan") transformType = "vegan";
        if (prefs.budget === "cheap") transformType = "cheaper";
        if (prefs.budget === "luxurious") transformType = "luxurious";
      }

      const data = await transformRecipe(recipe.id, transformType, reqs);
      setTransformData(data);
      setDisplayIngredients(data.ingredients);
    } catch (e: any) {
      setActiveTransform(null);
      alert("Transformation failed: " + e.message);
    } finally {
      setTransforming(false);
    }
  }

  function showOriginal() {
    if (!recipe) return;
    setActiveTransform(null);
    setTransformData(null);
    setDisplayIngredients(recipe.ingredients);
    setSubstitutions({});
  }

  // ─── Substitution ────────────────────────────────────────────────────────

  async function handleSubstitute(item: string) {
    if (!recipe) return;
    setSubstitutingItem(item);
    try {
      const data = await substituteIngredient(recipe.id, item, recipe.title, dietaryReqs);
      setSubstitutions(prev => ({ ...prev, [item]: data }));
    } catch (e: any) {
      alert("Substitution failed: " + e.message);
    } finally {
      setSubstitutingItem(null);
    }
  }

  // ─── Notes auto-save ─────────────────────────────────────────────────────

  const saveNotes = useCallback(async (value: string) => {
    if (!recipe) return;
    try {
      await updateNotes(recipe.id, value);
      setNotesSaved(true);
    } catch {
      // Silent fail — user can retry
    }
  }, [recipe]);

  function handleNotesChange(value: string) {
    setNotes(value);
    setNotesSaved(false);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(value), 1500);
  }

  // ─── Nutrition ────────────────────────────────────────────────────────────

  async function handleShowNutrition() {
    if (!recipe) return;
    if (nutrition) {
      setShowNutrition(!showNutrition);
      return;
    }
    setNutritionLoading(true);
    setShowNutrition(true);
    try {
      const data = await getNutrition(recipe.id);
      setNutrition(data);
    } catch (e: any) {
      alert("Could not get nutrition: " + e.message);
      setShowNutrition(false);
    } finally {
      setNutritionLoading(false);
    }
  }

  // ─── Image upload ─────────────────────────────────────────────────────────

  async function handleImageUpload(file: File) {
    if (!recipe) return;
    setUploadingImage(true);
    try {
      const updated = await uploadRecipeImage(recipe.id, file);
      setRecipe(updated);
    } catch (e: any) {
      alert("Image upload failed: " + e.message);
    } finally {
      setUploadingImage(false);
    }
  }

  // ─── Cost ──────────────────────────────────────────────────────────────

  async function handleShowCost() {
    if (!recipe) return;
    if (cost) { setShowCost(!showCost); return; }
    setCostLoading(true);
    setShowCost(true);
    try {
      const data = await estimateCost(recipe.id);
      setCost(data);
    } catch (e: any) {
      alert("Could not estimate cost: " + e.message);
      setShowCost(false);
    } finally {
      setCostLoading(false);
    }
  }

  // ─── Basket ────────────────────────────────────────────────────────────

  async function handleAddToBasket() {
    if (!recipe) return;
    try {
      await addRecipeToBasket(recipe.id, ingredientsToShow);
      setAddedToBasket(true);
      setTimeout(() => setAddedToBasket(false), 3000);
    } catch (e: any) {
      alert("Failed to add to basket: " + e.message);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const date = recipe
    ? new Date(recipe.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  const ingredientsToShow = transformData ? transformData.ingredients : displayIngredients;
  const instructionsToShow = transformData ? transformData.instructions : (recipe?.instructions || []);

  // Scale nutrition per current servings
  const nutritionScale = (nutrition && adjustedServings && nutrition.servings)
    ? adjustedServings / nutrition.servings : 1;

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
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

            {/* Hero image */}
            {recipe.image_url && (
              <img
                src={recipe.image_url}
                alt={recipe.title}
                style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, border: `1px solid ${colors.border}` }}
              />
            )}

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
              <div style={{ display: "flex", gap: 16, color: colors.muted, fontSize: 13, fontFamily: "system-ui, sans-serif", alignItems: "center", flexWrap: "wrap" }}>
                <span>Added {date}</span>
                {!recipe.image_url && (
                  <>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: colors.muted, cursor: "pointer" }}
                    >
                      {uploadingImage ? "Uploading..." : "Add photo"}
                    </button>
                    <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
                  </>
                )}
              </div>
            </div>

            {/* Servings adjuster */}
            <div style={{
              background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`,
              padding: "14px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
              fontFamily: "system-ui, sans-serif",
            }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>Servings</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setAdjustedServings(Math.max(1, (adjustedServings || 1) - 1))}
                  disabled={!recipe.servings}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${colors.border}`, background: colors.white, cursor: "pointer", fontSize: 16, color: colors.text }}
                >−</button>
                <span style={{ fontSize: 18, fontWeight: 600, minWidth: 28, textAlign: "center", color: colors.green }}>
                  {adjustedServings || recipe.servings || "–"}
                </span>
                <button
                  onClick={() => setAdjustedServings((adjustedServings || 1) + 1)}
                  disabled={!recipe.servings}
                  style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${colors.border}`, background: colors.white, cursor: "pointer", fontSize: 16, color: colors.text }}
                >+</button>
              </div>
              {scaleFactor !== 1 && (
                <button
                  onClick={() => setAdjustedServings(recipe.servings)}
                  style={{ fontSize: 12, color: colors.green, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >Reset</button>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                {converting && <span style={{ fontSize: 12, color: colors.muted }}>Converting...</span>}
                <select
                  value={unitSystem}
                  onChange={e => handleUnitChange(e.target.value as "us_customary" | "metric")}
                  disabled={converting}
                  style={{
                    fontSize: 13, fontFamily: "system-ui, sans-serif",
                    border: `1px solid ${colors.border}`, borderRadius: 6,
                    padding: "5px 10px", background: colors.white, color: colors.text,
                    outline: "none", cursor: "pointer",
                  }}
                >
                  <option value="us_customary">US Customary</option>
                  <option value="metric">Metric</option>
                </select>
              </div>
            </div>

            {/* AI Transformation toggles */}
            <div style={{
              display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
            }}>
              {TRANSFORMATIONS.map(t => (
                <button
                  key={t.key}
                  onClick={() => handleTransform(t.key)}
                  disabled={transforming}
                  title={t.tooltip || ""}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13,
                    fontFamily: "system-ui, sans-serif", cursor: "pointer",
                    border: activeTransform === t.key ? "none" : `1px solid ${colors.border}`,
                    background: activeTransform === t.key ? colors.green : colors.white,
                    color: activeTransform === t.key ? colors.white : colors.text,
                    fontWeight: activeTransform === t.key ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {t.label}
                </button>
              ))}

              <button
                onClick={() => setShowDietary(!showDietary)}
                style={{
                  padding: "6px 14px", borderRadius: 20, fontSize: 13,
                  fontFamily: "system-ui, sans-serif", cursor: "pointer",
                  border: `1px solid ${colors.border}`,
                  background: dietaryReqs.length > 0 ? colors.greenLight : colors.white,
                  color: colors.text,
                }}
              >
                Dietary {dietaryReqs.length > 0 && `(${dietaryReqs.length})`}
              </button>

              {activeTransform && (
                <button
                  onClick={showOriginal}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13,
                    fontFamily: "system-ui, sans-serif", cursor: "pointer",
                    border: "none", background: colors.muted, color: colors.white, fontWeight: 600,
                  }}
                >
                  Show Original
                </button>
              )}
            </div>

            {transforming && <LoadingSpinner label="Transforming recipe..." />}

            {/* Dietary checkboxes */}
            {showDietary && (
              <div style={{
                background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`,
                padding: "14px 20px",
                display: "flex", gap: 12, flexWrap: "wrap", fontFamily: "system-ui, sans-serif",
              }}>
                {DIETARY_OPTIONS.map(opt => (
                  <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.text, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={dietaryReqs.includes(opt)}
                      onChange={() => {
                        setDietaryReqs(prev =>
                          prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt]
                        );
                      }}
                      style={{ accentColor: colors.green }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}

            {/* Transformation reasoning */}
            {transformData && Object.keys(transformData.reasoning).length > 0 && (
              <div style={{
                background: colors.greenLight, borderRadius: 10, border: `1px solid ${colors.border}`,
                padding: "14px 20px", fontFamily: "system-ui, sans-serif",
              }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 8 }}>
                  Changes made
                </h4>
                {Object.entries(transformData.reasoning).map(([change, reason]) => (
                  <div key={change} style={{ fontSize: 13, color: colors.text, marginBottom: 6, lineHeight: 1.5 }}>
                    <strong>{change}</strong> — {reason}
                  </div>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, marginBottom: 16 }}>
                Ingredients
              </h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {ingredientsToShow.map((ing, i) => (
                  <IngredientRow
                    key={i}
                    ing={ing}
                    scaleFactor={scaleFactor}
                    substitution={substitutions[ing.item]}
                    onSubstitute={() => handleSubstitute(ing.item)}
                    substituting={substitutingItem === ing.item}
                  />
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, marginBottom: 16 }}>
                Instructions
              </h2>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {instructionsToShow.map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, fontFamily: "system-ui, sans-serif" }}>
                    <span style={{
                      minWidth: 28, height: 28, borderRadius: "50%",
                      background: colors.green, color: colors.white,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 600, flexShrink: 0, marginTop: 2,
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

            {/* Nutrition */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <button
                onClick={handleShowNutrition}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "Georgia, serif", color: colors.text, fontSize: 18,
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0,
                }}
              >
                Nutritional Info
                <span style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>
                  {showNutrition ? "▲" : "▼"}
                </span>
              </button>

              {showNutrition && (
                <div style={{ marginTop: 16 }}>
                  {nutritionLoading ? (
                    <LoadingSpinner label="Estimating nutrition..." />
                  ) : nutrition ? (
                    <>
                      <p style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif", marginBottom: 12 }}>
                        Per serving (estimated)
                      </p>
                      <div style={{
                        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                        gap: 12,
                      }}>
                        {([
                          ["Calories", Math.round(nutrition.per_serving.calories * nutritionScale), "kcal"],
                          ["Protein", +(nutrition.per_serving.protein_g * nutritionScale).toFixed(1), "g"],
                          ["Carbs", +(nutrition.per_serving.carbs_g * nutritionScale).toFixed(1), "g"],
                          ["Fat", +(nutrition.per_serving.fat_g * nutritionScale).toFixed(1), "g"],
                          ["Fiber", +(nutrition.per_serving.fiber_g * nutritionScale).toFixed(1), "g"],
                          ["Sugar", +(nutrition.per_serving.sugar_g * nutritionScale).toFixed(1), "g"],
                          ["Sodium", Math.round(nutrition.per_serving.sodium_mg * nutritionScale), "mg"],
                        ] as [string, number, string][]).map(([label, value, unit]) => (
                          <div key={label} style={{
                            textAlign: "center", padding: "12px 8px",
                            background: colors.cream, borderRadius: 8,
                            fontFamily: "system-ui, sans-serif",
                          }}>
                            <div style={{ fontSize: 18, fontWeight: 600, color: colors.green }}>{value}</div>
                            <div style={{ fontSize: 11, color: colors.muted }}>{label} ({unit})</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}
            </div>

            {/* Add to basket */}
            <button
              onClick={handleAddToBasket}
              style={{
                background: addedToBasket ? colors.greenLight : colors.white,
                border: `1px solid ${addedToBasket ? colors.green : colors.border}`,
                borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 600,
                color: addedToBasket ? colors.green : colors.text, cursor: "pointer",
                fontFamily: "system-ui, sans-serif", width: "100%",
                transition: "all 0.2s",
              }}
            >
              {addedToBasket ? "Added to basket ✓" : "Add ingredients to basket"}
            </button>

            {/* Cost estimate */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <button
                onClick={handleShowCost}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "Georgia, serif", color: colors.text, fontSize: 18,
                  display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0,
                }}
              >
                Cost Estimate
                <span style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>
                  {showCost ? "▲" : "▼"}
                </span>
              </button>
              {showCost && (
                <div style={{ marginTop: 16 }}>
                  {costLoading ? <LoadingSpinner label="Estimating cost..." /> : cost ? (
                    <div style={{ fontFamily: "system-ui, sans-serif" }}>
                      <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
                        <div style={{ textAlign: "center", padding: "12px 20px", background: colors.cream, borderRadius: 8, flex: 1 }}>
                          <div style={{ fontSize: 24, fontWeight: 600, color: colors.green }}>
                            {cost.currency === "GBP" ? "£" : cost.currency === "USD" ? "$" : "€"}{cost.per_serving.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: colors.muted }}>per serving</div>
                        </div>
                        <div style={{ textAlign: "center", padding: "12px 20px", background: colors.cream, borderRadius: 8, flex: 1 }}>
                          <div style={{ fontSize: 24, fontWeight: 600, color: colors.text }}>
                            {cost.currency === "GBP" ? "£" : cost.currency === "USD" ? "$" : "€"}{cost.total.toFixed(2)}
                          </div>
                          <div style={{ fontSize: 12, color: colors.muted }}>total</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.border}`, padding: "20px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, margin: 0 }}>
                  Notes
                </h2>
                <span style={{ fontSize: 11, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>
                  {notesSaved ? "Saved" : "Saving..."}
                </span>
              </div>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add your notes here — tips, tweaks, what you'd change next time..."
                style={{
                  width: "100%", minHeight: 100, padding: 12,
                  border: `1px solid ${colors.border}`, borderRadius: 8,
                  fontSize: 14, fontFamily: "system-ui, sans-serif",
                  lineHeight: 1.6, color: colors.text, outline: "none",
                  resize: "vertical", boxSizing: "border-box",
                  background: colors.cream,
                }}
              />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
