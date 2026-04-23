import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import SaltShakerLogo from "../components/SaltShakerLogo";
import Tooltip from "../components/Tooltip";
import Popover from "../components/Popover";
import {
  ServingsIcon, UnitsIcon, TailorIcon, NutritionIcon, CostIcon, BasketIcon,
  ChevronIcon, CloseIcon, MinusIcon, PlusIcon,
} from "../components/RecipeIcons";
import { colors, fonts } from "../theme";
import {
  getRecipe, convertRecipe, updateNotes, uploadRecipeImage,
  transformRecipe, substituteIngredient, getNutrition, estimateCost,
  Recipe, Ingredient, TransformResponse, SubstitutionResponse, NutritionResponse, CostResponse,
} from "../api/recipes";
import { addRecipeToBasket } from "../api/basket";
import { getFriendRecipe, copyRecipe } from "../api/friends";
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
  { key: "personalise", label: "Personalise", tooltip: "Adapt this recipe to your saved preferences" },
  { key: "veggie",      label: "Make veggie",  tooltip: "Swap meat and fish for vegetarian alternatives" },
  { key: "vegan",       label: "Make vegan",   tooltip: "Replace all animal products" },
  { key: "seasonal",    label: "Make seasonal", tooltip: "Use ingredients that are in season right now" },
  { key: "eco",         label: "Reduce impact", tooltip: "Lower the environmental footprint" },
  { key: "cheaper",     label: "Make cheaper", tooltip: "Substitute with lower-cost ingredients" },
  { key: "luxurious",   label: "Make luxurious", tooltip: "Elevate with higher-end swaps" },
] as const;

const DIETARY_OPTIONS = [
  "Gluten-free", "Dairy-free", "Nut-free", "Egg-free",
  "Soy-free", "Shellfish-free", "Halal", "Kosher",
];

function currencySymbol(code: string) {
  return code === "GBP" ? "£" : code === "USD" ? "$" : code === "EUR" ? "€" : code;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function IngredientRow({ ing, scaleFactor, substitution, onSubstitute, substituting, readOnly }: {
  ing: Ingredient;
  scaleFactor: number;
  substitution?: SubstitutionResponse;
  onSubstitute: () => void;
  substituting: boolean;
  readOnly?: boolean;
}) {
  const scaledQty = ing.quantity !== null ? ing.quantity * scaleFactor : null;

  if (substitution) {
    return (
      <li style={{ padding: "10px 0", borderBottom: `1px solid ${colors.borderSoft}`, fontFamily: fonts.sans, fontSize: 14 }}>
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
      borderBottom: `1px solid ${colors.borderSoft}`,
      fontFamily: fonts.sans, fontSize: 14,
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
      {!readOnly && (
        <button
          onClick={onSubstitute}
          disabled={substituting}
          title="Don't have this? Swap it."
          style={{
            background: "none", border: `1px solid ${colors.border}`, borderRadius: 6,
            padding: "3px 8px", fontSize: 11, color: colors.muted, cursor: "pointer",
            whiteSpace: "nowrap", flexShrink: 0, fontFamily: fonts.sans,
          }}
        >
          {substituting ? "..." : "Swap?"}
        </button>
      )}
    </li>
  );
}

// ─── Toolbar bits ────────────────────────────────────────────────────────────

const TOOLBAR_BTN: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "8px 12px", borderRadius: 10, border: `1px solid ${colors.border}`,
  background: colors.white, color: colors.text, fontFamily: fonts.sans,
  fontSize: 13, fontWeight: 500, cursor: "pointer",
  whiteSpace: "nowrap", transition: "background 0.15s, border-color 0.15s",
};

const TOOLBAR_BTN_PRIMARY: React.CSSProperties = {
  ...TOOLBAR_BTN,
  background: colors.green, color: colors.white, border: "none", fontWeight: 600,
};

const TOOLBAR_BTN_ACTIVE: React.CSSProperties = {
  ...TOOLBAR_BTN, background: colors.greenLight, borderColor: colors.green, color: colors.green,
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function RecipeDetailPage() {
  const { id, friendId, recipeId } = useParams<{ id: string; friendId: string; recipeId: string }>();
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isFriendView = Boolean(friendId && recipeId);
  const effectiveId = isFriendView ? recipeId : id;
  const [savingCopy, setSavingCopy] = useState(false);

  // Core
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Servings
  const [adjustedServings, setAdjustedServings] = useState<number | null>(null);

  // Ingredients / units
  const [displayIngredients, setDisplayIngredients] = useState<Ingredient[]>([]);
  const [unitSystem, setUnitSystem] = useState<"us_customary" | "metric">("us_customary");
  const [converting, setConverting] = useState(false);

  // Transformations
  const [activeTransform, setActiveTransform] = useState<string | null>(null);
  const [transformData, setTransformData] = useState<TransformResponse | null>(null);
  const [transforming, setTransforming] = useState(false);
  const [dietaryReqs, setDietaryReqs] = useState<string[]>([]);

  // Substitutions
  const [substitutions, setSubstitutions] = useState<Record<string, SubstitutionResponse>>({});
  const [substitutingItem, setSubstitutingItem] = useState<string | null>(null);

  // Notes
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);

  // Nutrition / Cost
  const [nutrition, setNutrition] = useState<NutritionResponse | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [cost, setCost] = useState<CostResponse | null>(null);
  const [costLoading, setCostLoading] = useState(false);

  // Image
  const [uploadingImage, setUploadingImage] = useState(false);

  // Basket
  const [addedToBasket, setAddedToBasket] = useState(false);

  // Popover state
  const [openPopover, setOpenPopover] = useState<"tailor" | "nutrition" | "cost" | null>(null);
  const tailorBtnRef = useRef<HTMLButtonElement>(null);
  const nutritionBtnRef = useRef<HTMLButtonElement>(null);
  const costBtnRef = useRef<HTMLButtonElement>(null);

  // ─── Load recipe ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!effectiveId) return;
    const loader = isFriendView && friendId
      ? getFriendRecipe(parseInt(friendId), parseInt(effectiveId))
      : getRecipe(parseInt(effectiveId));
    loader
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
  }, [effectiveId, isFriendView, friendId]);

  async function handleCopyToMine() {
    if (!recipe) return;
    setSavingCopy(true);
    try {
      const copy = await copyRecipe(recipe.id);
      navigate(`/recipes/${copy.id}`);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSavingCopy(false);
    }
  }

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
    setOpenPopover(null);
    try {
      const data = await transformRecipe(recipe.id, type, dietaryReqs);
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
      // Silent fail; user can retry
    }
  }, [recipe]);

  function handleNotesChange(value: string) {
    setNotes(value);
    setNotesSaved(false);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(value), 1500);
  }

  // ─── Nutrition ────────────────────────────────────────────────────────────

  async function ensureNutrition() {
    if (!recipe || nutrition || nutritionLoading) return;
    setNutritionLoading(true);
    try {
      const data = await getNutrition(recipe.id);
      setNutrition(data);
    } catch (e: any) {
      alert("Could not get nutrition: " + e.message);
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

  async function ensureCost() {
    if (!recipe || cost || costLoading) return;
    setCostLoading(true);
    try {
      const data = await estimateCost(recipe.id);
      setCost(data);
    } catch (e: any) {
      alert("Could not estimate cost: " + e.message);
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

  // ─── Popover helpers ─────────────────────────────────────────────────────

  function togglePopover(which: "tailor" | "nutrition" | "cost") {
    if (openPopover === which) {
      setOpenPopover(null);
      return;
    }
    setOpenPopover(which);
    if (which === "nutrition") ensureNutrition();
    if (which === "cost") ensureCost();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const date = recipe
    ? new Date(recipe.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  const ingredientsToShow = transformData ? transformData.ingredients : displayIngredients;
  const instructionsToShow = transformData ? transformData.instructions : (recipe?.instructions || []);

  const nutritionScale = (nutrition && adjustedServings && nutrition.servings)
    ? adjustedServings / nutrition.servings : 1;

  const activeTransformLabel = TRANSFORMATIONS.find(t => t.key === activeTransform)?.label;

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 40px)", flex: 1 }}>
        {loading && <LoadingSpinner label="Loading recipe..." />}
        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "12px 16px", color: colors.error, fontSize: 13, fontFamily: fonts.sans }}>
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
                style={{ width: "100%", maxHeight: 360, objectFit: "cover", borderRadius: 12, border: `1px solid ${colors.borderSoft}` }}
              />
            )}

            {/* Title & meta */}
            <div>
              <button
                onClick={() => navigate(isFriendView ? "/friends" : "/dashboard")}
                style={{ background: "none", border: "none", color: colors.muted, fontSize: 13, fontFamily: fonts.sans, cursor: "pointer", padding: "0 0 12px 0", display: "flex", alignItems: "center", gap: 4 }}
              >
                ← {isFriendView ? "Back to friends" : "All recipes"}
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <SaltShakerLogo size={28} color={colors.green} />
                <h1 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: "clamp(22px, 5vw, 34px)", margin: 0, lineHeight: 1.15, flex: 1, letterSpacing: "-0.01em" }}>
                  {recipe.title}
                </h1>
                {isFriendView && (
                  <button
                    onClick={handleCopyToMine}
                    disabled={savingCopy}
                    title="Save to my recipes"
                    style={{
                      background: colors.green, color: colors.white, border: "none",
                      borderRadius: 20, padding: "8px 16px", fontSize: 14, fontWeight: 600,
                      cursor: savingCopy ? "default" : "pointer",
                      display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                      fontFamily: fonts.sans, opacity: savingCopy ? 0.7 : 1,
                    }}
                  >
                    <PlusIcon size={16} />
                    {savingCopy ? "Saving..." : "Save to mine"}
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: 16, color: colors.muted, fontSize: 13, fontFamily: fonts.sans, alignItems: "center", flexWrap: "wrap" }}>
                <span>Added {date}</span>
                {!isFriendView && !recipe.image_url && (
                  <>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: colors.muted, cursor: "pointer", fontFamily: fonts.sans }}
                    >
                      {uploadingImage ? "Uploading..." : "Add photo"}
                    </button>
                    <input ref={imageInputRef} type="file" accept="image/*" style={{ display: "none" }}
                      onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]); }} />
                  </>
                )}
              </div>
            </div>

            {/* ─── Sticky Toolbar ───────────────────────────────────────── */}
            <div
              style={{
                position: "sticky", top: 0, zIndex: 20,
                background: colors.cream,
                margin: "0 -4px",
                padding: "8px 4px",
                borderBottom: `1px solid transparent`,
                backdropFilter: "blur(6px)",
              }}
            >
              <div
                style={{
                  background: colors.white,
                  border: `1px solid ${colors.borderSoft}`,
                  borderRadius: 14,
                  padding: "10px 12px",
                  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                {/* Servings stepper */}
                <Tooltip label="Portions — we scale ingredients for you">
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", border: `1px solid ${colors.border}`, borderRadius: 10 }}>
                    <span style={{ color: colors.green, display: "flex" }}><ServingsIcon size={16} /></span>
                    <button
                      onClick={() => setAdjustedServings(Math.max(1, (adjustedServings || 1) - 1))}
                      disabled={!recipe.servings}
                      aria-label="Fewer servings"
                      style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${colors.border}`, background: colors.white, cursor: "pointer", color: colors.text, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    ><MinusIcon /></button>
                    <span style={{ fontSize: 14, fontWeight: 600, minWidth: 20, textAlign: "center", color: colors.green, fontFamily: fonts.sans }}>
                      {adjustedServings || recipe.servings || "–"}
                    </span>
                    <button
                      onClick={() => setAdjustedServings((adjustedServings || 1) + 1)}
                      disabled={!recipe.servings}
                      aria-label="More servings"
                      style={{ width: 24, height: 24, borderRadius: "50%", border: `1px solid ${colors.border}`, background: colors.white, cursor: "pointer", color: colors.text, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                    ><PlusIcon /></button>
                    {scaleFactor !== 1 && (
                      <button
                        onClick={() => setAdjustedServings(recipe.servings)}
                        style={{ fontSize: 11, color: colors.green, background: "none", border: "none", cursor: "pointer", padding: "0 4px", fontFamily: fonts.sans }}
                      >Reset</button>
                    )}
                  </div>
                </Tooltip>

                {/* Units segmented toggle */}
                {!isFriendView && (
                  <Tooltip label="Switch between metric and US customary">
                    <div style={{ display: "inline-flex", alignItems: "center", border: `1px solid ${colors.border}`, borderRadius: 10, overflow: "hidden" }}>
                      <span style={{ color: colors.green, display: "flex", padding: "0 8px" }}><UnitsIcon size={16} /></span>
                      {(["metric", "us_customary"] as const).map(u => (
                        <button
                          key={u}
                          onClick={() => handleUnitChange(u)}
                          disabled={converting}
                          style={{
                            padding: "6px 10px", fontSize: 12, fontWeight: 600,
                            background: unitSystem === u ? colors.green : "transparent",
                            color: unitSystem === u ? colors.white : colors.textSoft,
                            border: "none", cursor: "pointer", fontFamily: fonts.sans,
                          }}
                        >
                          {u === "metric" ? "Metric" : "US"}
                        </button>
                      ))}
                    </div>
                  </Tooltip>
                )}

                {/* Tailor */}
                {!isFriendView && (
                  <div style={{ position: "relative", display: "inline-flex" }}>
                    <Tooltip label="Adjust this recipe: veggie, vegan, cheaper, seasonal, and more" disabled={openPopover === "tailor"}>
                      <button
                        ref={tailorBtnRef}
                        onClick={() => togglePopover("tailor")}
                        style={activeTransform ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
                      >
                        <TailorIcon size={16} />
                        <span>Tailor</span>
                        {activeTransformLabel && (
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: colors.green, color: colors.white,
                              fontSize: 11, fontWeight: 600, padding: "2px 8px",
                              borderRadius: 999,
                            }}
                            onClick={e => { e.stopPropagation(); showOriginal(); }}
                          >
                            {activeTransformLabel}
                            <CloseIcon size={11} />
                          </span>
                        )}
                        <ChevronIcon />
                      </button>
                    </Tooltip>
                    <Popover
                      open={openPopover === "tailor"}
                      onClose={() => setOpenPopover(null)}
                      anchorRef={tailorBtnRef}
                      align="start"
                      width={320}
                    >
                      <div style={{ fontFamily: fonts.sans }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: "4px 6px 8px" }}>Change the recipe</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          {TRANSFORMATIONS.map(t => {
                            const active = activeTransform === t.key;
                            return (
                              <Tooltip key={t.key} label={t.tooltip} placement="top">
                                <button
                                  onClick={() => handleTransform(t.key)}
                                  disabled={transforming}
                                  style={{
                                    width: "100%",
                                    padding: "8px 10px", borderRadius: 8,
                                    border: active ? "none" : `1px solid ${colors.borderSoft}`,
                                    background: active ? colors.green : colors.white,
                                    color: active ? colors.white : colors.text,
                                    fontSize: 13, fontWeight: active ? 600 : 500,
                                    fontFamily: fonts.sans, cursor: "pointer", textAlign: "left",
                                  }}
                                >
                                  {t.label}
                                </button>
                              </Tooltip>
                            );
                          })}
                        </div>

                        <div style={{ height: 1, background: colors.borderSoft, margin: "12px 0" }} />

                        <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 6px 8px" }}>Dietary needs</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 4px" }}>
                          {DIETARY_OPTIONS.map(opt => {
                            const on = dietaryReqs.includes(opt);
                            return (
                              <button
                                key={opt}
                                onClick={() => setDietaryReqs(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt])}
                                style={{
                                  padding: "4px 10px", borderRadius: 999, fontSize: 12,
                                  border: `1px solid ${on ? colors.green : colors.borderSoft}`,
                                  background: on ? colors.greenLight : colors.white,
                                  color: on ? colors.green : colors.textSoft,
                                  fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: fonts.sans,
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>

                        {activeTransform && (
                          <>
                            <div style={{ height: 1, background: colors.borderSoft, margin: "12px 0" }} />
                            <button
                              onClick={() => { showOriginal(); setOpenPopover(null); }}
                              style={{
                                width: "100%", padding: "8px 10px", borderRadius: 8,
                                border: "none", background: colors.cream, color: colors.text,
                                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: fonts.sans,
                              }}
                            >
                              Show original
                            </button>
                          </>
                        )}
                      </div>
                    </Popover>
                  </div>
                )}

                {/* Nutrition */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Tooltip label="Nutritional info per serving" disabled={openPopover === "nutrition"}>
                    <button
                      ref={nutritionBtnRef}
                      onClick={() => togglePopover("nutrition")}
                      aria-label="Nutritional info"
                      style={{ ...TOOLBAR_BTN, padding: "8px 10px" }}
                    >
                      <NutritionIcon size={16} />
                    </button>
                  </Tooltip>
                  <Popover
                    open={openPopover === "nutrition"}
                    onClose={() => setOpenPopover(null)}
                    anchorRef={nutritionBtnRef}
                    align="end"
                    width={320}
                  >
                    <div style={{ fontFamily: fonts.sans }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                        Nutrition, per serving
                      </div>
                      {nutritionLoading ? (
                        <LoadingSpinner label="Estimating..." />
                      ) : nutrition ? (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                          {([
                            ["Calories", Math.round(nutrition.per_serving.calories * nutritionScale), "kcal"],
                            ["Protein", +(nutrition.per_serving.protein_g * nutritionScale).toFixed(1), "g"],
                            ["Carbs", +(nutrition.per_serving.carbs_g * nutritionScale).toFixed(1), "g"],
                            ["Fat", +(nutrition.per_serving.fat_g * nutritionScale).toFixed(1), "g"],
                            ["Fibre", +(nutrition.per_serving.fiber_g * nutritionScale).toFixed(1), "g"],
                            ["Sugar", +(nutrition.per_serving.sugar_g * nutritionScale).toFixed(1), "g"],
                          ] as [string, number, string][]).map(([label, value, unit]) => (
                            <div key={label} style={{ textAlign: "center", padding: "10px 6px", background: colors.cream, borderRadius: 8 }}>
                              <div style={{ fontSize: 16, fontWeight: 600, color: colors.green }}>{value}</div>
                              <div style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>{label} ({unit})</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: colors.muted }}>No data yet.</div>
                      )}
                    </div>
                  </Popover>
                </div>

                {/* Cost */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Tooltip label="Estimated cost per serving and total" disabled={openPopover === "cost"}>
                    <button
                      ref={costBtnRef}
                      onClick={() => togglePopover("cost")}
                      aria-label="Cost estimate"
                      style={{ ...TOOLBAR_BTN, padding: "8px 10px" }}
                    >
                      <CostIcon size={16} />
                    </button>
                  </Tooltip>
                  <Popover
                    open={openPopover === "cost"}
                    onClose={() => setOpenPopover(null)}
                    anchorRef={costBtnRef}
                    align="end"
                    width={280}
                  >
                    <div style={{ fontFamily: fonts.sans }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                        Cost estimate
                      </div>
                      {costLoading ? (
                        <LoadingSpinner label="Estimating..." />
                      ) : cost ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div style={{ textAlign: "center", padding: "12px 6px", background: colors.cream, borderRadius: 8 }}>
                            <div style={{ fontSize: 20, fontWeight: 600, color: colors.green }}>
                              {currencySymbol(cost.currency)}{cost.per_serving.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>per serving</div>
                          </div>
                          <div style={{ textAlign: "center", padding: "12px 6px", background: colors.cream, borderRadius: 8 }}>
                            <div style={{ fontSize: 20, fontWeight: 600, color: colors.text }}>
                              {currencySymbol(cost.currency)}{cost.total.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>total</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: colors.muted }}>No estimate yet.</div>
                      )}
                    </div>
                  </Popover>
                </div>

                {/* Spacer pushes basket right */}
                <div style={{ flex: 1 }} />

                {/* Add to basket */}
                {!isFriendView && (
                  <Tooltip label="Add these ingredients to your shopping basket" placement="top">
                    <button
                      onClick={handleAddToBasket}
                      style={addedToBasket
                        ? { ...TOOLBAR_BTN_ACTIVE, background: colors.greenLight, color: colors.green }
                        : TOOLBAR_BTN_PRIMARY}
                    >
                      <BasketIcon size={16} />
                      <span>{addedToBasket ? "Added" : "Add to basket"}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {transforming && <LoadingSpinner label="Tailoring the recipe..." />}

            {/* Transformation reasoning */}
            {transformData && Object.keys(transformData.reasoning).length > 0 && (
              <div style={{
                background: colors.greenLight, borderRadius: 12, border: `1px solid ${colors.border}`,
                padding: "14px 20px", fontFamily: fonts.sans,
              }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 8 }}>
                  Changes made
                </h4>
                {Object.entries(transformData.reasoning).map(([change, reason]) => (
                  <div key={change} style={{ fontSize: 13, color: colors.text, marginBottom: 6, lineHeight: 1.5 }}>
                    <strong>{change}</strong>, {reason}
                  </div>
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.borderSoft}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: 20, marginBottom: 16 }}>
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
                    readOnly={isFriendView}
                  />
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.borderSoft}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: 20, marginBottom: 16 }}>
                Instructions
              </h2>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {instructionsToShow.map((step, i) => (
                  <li key={i} style={{ display: "flex", gap: 14, fontFamily: fonts.sans }}>
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

            {/* Chef's Notes */}
            {!isFriendView && (
              <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.borderSoft}`, padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h2 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: 20, margin: 0 }}>
                    Chef's Notes
                  </h2>
                  <span style={{ fontSize: 11, color: colors.muted, fontFamily: fonts.sans }}>
                    {notesSaved ? "Saved" : "Saving..."}
                  </span>
                </div>
                <textarea
                  value={notes}
                  onChange={e => handleNotesChange(e.target.value)}
                  placeholder="Tips, tweaks, what you'd change next time..."
                  style={{
                    width: "100%", minHeight: 100, padding: 12,
                    border: `1px solid ${colors.border}`, borderRadius: 8,
                    fontSize: 14, fontFamily: fonts.sans,
                    lineHeight: 1.6, color: colors.text, outline: "none",
                    resize: "vertical", boxSizing: "border-box",
                    background: colors.cream,
                  }}
                />
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
