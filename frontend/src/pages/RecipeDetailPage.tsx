import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import SaltShakerLogo from "../components/SaltShakerLogo";
import Tooltip from "../components/Tooltip";
import Popover from "../components/Popover";
import IngredientAutocomplete from "../components/IngredientAutocomplete";
import {
  ServingsIcon, UnitsIcon, NutritionIcon, CostIcon, ImpactIcon, BasketIcon,
  ChevronIcon, CloseIcon, MinusIcon, PlusIcon,
} from "../components/RecipeIcons";
import { colors, fonts } from "../theme";
import {
  getRecipe, convertRecipe, updateNotes, uploadRecipeImage,
  transformRecipe, substituteIngredient, getNutrition, estimateCost, estimateImpact,
  putWorkingState, clearWorkingState,
  Recipe, Ingredient, InstructionStep,
  AppliedSeasoning, SubstitutionResponse,
  NutritionResponse, CostResponse, ImpactResponse,
} from "../api/recipes";
import { addRecipeToBasket } from "../api/basket";
import { getFriendRecipe, copyRecipe } from "../api/friends";
import { useAuth } from "../context/AuthContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatQuantity(q: number | null): string {
  if (q === null || Number.isNaN(q)) return "";
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

interface Transformation { key: string; label: string; tooltip: string; }

const TRANSFORMATIONS: Transformation[] = [
  { key: "personalise", label: "Personalise",    tooltip: "Adapt this recipe to your saved preferences" },
  { key: "veggie",      label: "Make veggie",    tooltip: "Swap meat and fish for vegetarian alternatives" },
  { key: "vegan",       label: "Make vegan",     tooltip: "Replace all animal products" },
  { key: "seasonal",    label: "Make seasonal",  tooltip: "Use ingredients that are in season right now" },
  { key: "eco",         label: "Reduce impact",  tooltip: "Lower the environmental footprint" },
  { key: "cheaper",     label: "Make cheaper",   tooltip: "Substitute with lower-cost ingredients" },
  { key: "luxurious",   label: "Make luxurious", tooltip: "Elevate with higher-end swaps" },
];

const TRANSFORM_GROUPS: { title: string; keys: string[] }[] = [
  { title: "Diet",           keys: ["veggie", "vegan"] },
  { title: "Sustainability", keys: ["seasonal", "eco"] },
  { title: "Price",          keys: ["cheaper", "luxurious"] },
];

function findTransform(key: string | null): Transformation | undefined {
  return key ? TRANSFORMATIONS.find(t => t.key === key) : undefined;
}

const DIETARY_OPTIONS = [
  "Gluten-free", "Dairy-free", "Nut-free", "Egg-free",
  "Soy-free", "Shellfish-free", "Halal", "Kosher",
];

function currencySymbol(code: string) {
  return code === "GBP" ? "£" : code === "USD" ? "$" : code === "EUR" ? "€" : code;
}

interface SwapEntry {
  before: Ingredient;
  reason?: string;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface IngredientRowProps {
  ing: Ingredient;
  index: number;
  scaleFactor: number;
  swap?: SwapEntry;
  onOpenSwap: () => void;
  onRevertSwap: () => void;
  onStartEdit: () => void;
  isEditing: boolean;
  editText: string;
  onEditTextChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  swapOpenForThis: boolean;
  swapBtnRef: React.RefObject<HTMLButtonElement>;
  readOnly?: boolean;
}

function IngredientRow({
  ing, index, scaleFactor, swap, onOpenSwap, onRevertSwap,
  onStartEdit, isEditing, editText, onEditTextChange, onSaveEdit, onCancelEdit,
  swapOpenForThis, swapBtnRef, readOnly,
}: IngredientRowProps) {
  const scaledQty = ing.quantity !== null && ing.quantity !== undefined && !Number.isNaN(ing.quantity)
    ? ing.quantity * scaleFactor : null;

  const itemHasLeadingNumber = /^\s*[\d½⅓⅔¼¾⅛⅜⅝⅞⅙⅚⅕⅖⅗⅘]/.test(ing.item || "");
  const showQtyCol = scaledQty !== null || (ing.unit && !itemHasLeadingNumber);

  return (
    <div
      data-ingredient-index={index}
      style={{
        display: "flex", gap: 8, padding: "10px 0",
        borderBottom: `1px solid ${colors.borderSoft}`,
        fontFamily: fonts.sans, fontSize: 14,
        color: colors.text, alignItems: "baseline",
        position: "relative",
      }}
    >
      <span style={{ minWidth: 60, fontWeight: 500, color: colors.green }}>
        {scaledQty !== null ? formatQuantity(scaledQty) : ""}
        {showQtyCol && ing.unit ? ` ${ing.unit}` : ""}
      </span>

      <span style={{ flex: 1 }}>
        {isEditing ? (
          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <IngredientAutocomplete
              autoFocus
              value={editText}
              onChange={onEditTextChange}
              onSubmit={onSaveEdit}
              placeholder="e.g. 200g chicken thighs"
              inputStyle={{
                padding: "6px 10px", border: `1px solid ${colors.green}`,
                borderRadius: 6, fontSize: 14,
              }}
            />
            <button onClick={onSaveEdit}
              style={{ background: colors.green, color: colors.white, border: "none", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: fonts.sans, fontWeight: 600 }}>
              Save
            </button>
            <button onClick={onCancelEdit}
              style={{ background: "none", color: colors.muted, border: `1px solid ${colors.border}`, borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontFamily: fonts.sans }}>
              Cancel
            </button>
          </span>
        ) : (
          <>
            {ing.item}
            {ing.preparation ? <span style={{ color: colors.muted }}>, {ing.preparation}</span> : null}
            {ing.notes ? <span style={{ color: colors.muted }}> ({ing.notes})</span> : null}
            {swap && (
              <button
                onClick={onRevertSwap}
                title={`Revert to ${swap.before.item}`}
                style={{
                  marginLeft: 8, padding: "1px 8px", borderRadius: 999,
                  border: `1px solid ${colors.green}`, background: colors.greenLight,
                  color: colors.green, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: fonts.sans,
                }}
              >
                ↺ Revert
              </button>
            )}
          </>
        )}
      </span>

      {!readOnly && !isEditing && (
        <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
          <button
            onClick={onStartEdit}
            title="Edit this ingredient"
            aria-label="Edit ingredient"
            style={{
              background: "none", border: `1px solid ${colors.borderSoft}`, borderRadius: 6,
              padding: "3px 7px", fontSize: 12, color: colors.muted, cursor: "pointer",
              fontFamily: fonts.sans, lineHeight: 1,
            }}
          >
            ✎
          </button>
          <button
            ref={swapOpenForThis ? swapBtnRef : null}
            onClick={onOpenSwap}
            title="Swap this ingredient"
            style={{
              background: swapOpenForThis ? colors.greenLight : "none",
              border: `1px solid ${swapOpenForThis ? colors.green : colors.border}`,
              borderRadius: 6,
              padding: "3px 8px", fontSize: 11,
              color: swapOpenForThis ? colors.green : colors.muted,
              cursor: "pointer", whiteSpace: "nowrap",
              fontFamily: fonts.sans,
            }}
          >
            Swap
          </button>
        </span>
      )}
    </div>
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

  // Working state — what's currently displayed
  const [displayIngredients, setDisplayIngredients] = useState<Ingredient[]>([]);
  const [displayInstructions, setDisplayInstructions] = useState<InstructionStep[]>([]);
  const [appliedSeasonings, setAppliedSeasonings] = useState<AppliedSeasoning[]>([]);
  const [swaps, setSwaps] = useState<Record<number, SwapEntry>>({});

  // Units
  const [unitSystem, setUnitSystem] = useState<"us_customary" | "metric">("us_customary");
  const [converting, setConverting] = useState(false);

  // Transformation in flight
  const [transformingKey, setTransformingKey] = useState<string | null>(null);
  const [dietaryReqs, setDietaryReqs] = useState<string[]>([]);

  // Substitution
  const [swapOpenIndex, setSwapOpenIndex] = useState<number | null>(null);
  const [swapData, setSwapData] = useState<SubstitutionResponse | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [customSwapText, setCustomSwapText] = useState("");
  const [customSwapMode, setCustomSwapMode] = useState(false);
  const swapBtnRef = useRef<HTMLButtonElement>(null);

  // Inline editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Notes
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);

  // Nutrition / Cost / Impact
  const [nutrition, setNutrition] = useState<NutritionResponse | null>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);
  const [cost, setCost] = useState<CostResponse | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);

  // Image
  const [uploadingImage, setUploadingImage] = useState(false);

  // Basket
  const [basketFeedback, setBasketFeedback] = useState<{ added: number; skipped: string[] } | null>(null);

  // Popover state
  const [openPopover, setOpenPopover] = useState<"season" | "nutrition" | "cost" | "impact" | null>(null);
  const seasonBtnRef = useRef<HTMLButtonElement>(null);
  const nutritionBtnRef = useRef<HTMLButtonElement>(null);
  const costBtnRef = useRef<HTMLButtonElement>(null);
  const impactBtnRef = useRef<HTMLButtonElement>(null);

  // ─── Load recipe ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!effectiveId) return;
    const loader = isFriendView && friendId
      ? getFriendRecipe(parseInt(friendId), parseInt(effectiveId))
      : getRecipe(parseInt(effectiveId));
    loader
      .then(r => {
        setRecipe(r);
        if (!isFriendView && r.working_state) {
          setDisplayIngredients(r.working_state.ingredients);
          setDisplayInstructions(r.working_state.instructions);
          setAppliedSeasonings(r.working_state.applied_seasonings || []);
        } else {
          setDisplayIngredients(r.ingredients);
          setDisplayInstructions(r.instructions);
          setAppliedSeasonings([]);
        }
        setNotes(r.notes || "");
        setAdjustedServings(r.servings);
        const first = (r.working_state?.ingredients || r.ingredients)[0];
        if (first) setUnitSystem(first.unit_system);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [effectiveId, isFriendView, friendId]);

  // ─── Cache invalidation: clear cost/nutrition/impact whenever the
  //     displayed ingredients change. We compare a stable signature so the
  //     effect doesn't fire on every re-render.
  const ingredientsSignature = useMemo(
    () => JSON.stringify(displayIngredients.map(i => [i.quantity, i.unit, i.item])),
    [displayIngredients]
  );
  useEffect(() => {
    setNutrition(null);
    setCost(null);
    setImpact(null);
  }, [ingredientsSignature]);

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

  // ─── Persist working state ───────────────────────────────────────────────

  async function persistWorkingState(
    ings: Ingredient[],
    insts: InstructionStep[],
    seasonings: AppliedSeasoning[],
  ) {
    if (!recipe || isFriendView) return;
    try {
      await putWorkingState(recipe.id, {
        ingredients: ings,
        instructions: insts,
        applied_seasonings: seasonings,
      });
    } catch (e: any) {
      console.error("Failed to persist working state:", e.message);
    }
  }

  async function persistOriginal() {
    if (!recipe || isFriendView) return;
    try {
      await clearWorkingState(recipe.id);
    } catch (e: any) {
      console.error("Failed to clear working state:", e.message);
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
      // Conversion of the *saved original* — clear seasonings since we no
      // longer reflect them. (Unit toggle is a destructive op.)
      if (appliedSeasonings.length || Object.keys(swaps).length) {
        setAppliedSeasonings([]);
        setSwaps({});
        await persistWorkingState(converted, recipe.instructions, []);
      }
    } catch (e: any) {
      alert("Conversion failed: " + e.message);
    } finally {
      setConverting(false);
    }
  }

  // ─── Transformations ─────────────────────────────────────────────────────

  async function handleTransform(type: string) {
    if (!recipe) return;
    // No-op if already applied — show shaded state in menu instead
    if (appliedSeasonings.some(s => s.key === type)) {
      setOpenPopover(null);
      return;
    }
    setTransformingKey(type);
    try {
      const data = await transformRecipe(recipe.id, type, dietaryReqs, {
        ingredients: displayIngredients,
        instructions: displayInstructions,
      });
      const t = TRANSFORMATIONS.find(t => t.key === type);
      const newSeasoning: AppliedSeasoning = {
        key: type,
        label: t?.label || type,
        reasoning: data.reasoning,
      };
      const next = [...appliedSeasonings, newSeasoning];
      setDisplayIngredients(data.ingredients);
      setDisplayInstructions(data.instructions);
      setAppliedSeasonings(next);
      setSwaps({}); // ingredient slots have changed; per-slot swaps no longer apply
      setOpenPopover(null);
      await persistWorkingState(data.ingredients, data.instructions, next);
    } catch (e: any) {
      alert("Transformation failed: " + e.message);
    } finally {
      setTransformingKey(null);
    }
  }

  async function showOriginal() {
    if (!recipe) return;
    setAppliedSeasonings([]);
    setDisplayIngredients(recipe.ingredients);
    setDisplayInstructions(recipe.instructions);
    setSwaps({});
    setOpenPopover(null);
    await persistOriginal();
  }

  // ─── Ingredient swap ─────────────────────────────────────────────────────

  async function fetchSwapOptions(ingredient: Ingredient, customConstraint?: string) {
    if (!recipe) return;
    setSwapLoading(true);
    setSwapData(null);
    try {
      const data = await substituteIngredient(
        recipe.id,
        ingredient.item,
        recipe.title,
        dietaryReqs,
        customConstraint,
        displayIngredients,
      );
      setSwapData(data);
    } catch (e: any) {
      alert("Could not fetch alternatives: " + e.message);
    } finally {
      setSwapLoading(false);
    }
  }

  function openSwapFor(index: number) {
    if (swapOpenIndex === index) {
      // Toggle closed
      setSwapOpenIndex(null);
      setSwapData(null);
      setCustomSwapMode(false);
      setCustomSwapText("");
      return;
    }
    setSwapOpenIndex(index);
    setCustomSwapMode(false);
    setCustomSwapText("");
    fetchSwapOptions(displayIngredients[index]);
  }

  function closeSwap() {
    setSwapOpenIndex(null);
    setSwapData(null);
    setCustomSwapMode(false);
    setCustomSwapText("");
  }

  function applySwap(index: number, option: { substitute: string; quantity?: number | null; unit?: string | null; item?: string | null; preparation?: string | null }) {
    if (!recipe) return;
    const before = displayIngredients[index];
    // Prefer the structured fields from the LLM (quantity/unit/item) so the
    // resolver can clean-match. Fall back to stuffing the display string into
    // item if the LLM didn't return them.
    const after: Ingredient = {
      ...before,
      quantity: option.quantity ?? null,
      unit: option.unit ?? null,
      item: option.item || option.substitute,
      preparation: option.preparation || "",
      notes: "",
      ingredient_id: null,
    };
    const nextIngs = displayIngredients.map((ing, i) => i === index ? after : ing);
    const nextSwaps = { ...swaps };
    // Only record the original "before" the FIRST time this slot is swapped,
    // so revert always returns to the recipe's pre-swap state.
    if (!nextSwaps[index]) nextSwaps[index] = { before };
    setDisplayIngredients(nextIngs);
    setSwaps(nextSwaps);
    closeSwap();
    persistWorkingState(nextIngs, displayInstructions, appliedSeasonings);
  }

  function revertSwap(index: number) {
    const entry = swaps[index];
    if (!entry) return;
    const nextIngs = displayIngredients.map((ing, i) => i === index ? entry.before : ing);
    const { [index]: _removed, ...rest } = swaps;
    setDisplayIngredients(nextIngs);
    setSwaps(rest);
    persistWorkingState(nextIngs, displayInstructions, appliedSeasonings);
  }

  // ─── Inline edit ─────────────────────────────────────────────────────────

  function startEdit(index: number) {
    const ing = displayIngredients[index];
    const qtyStr = ing.quantity !== null && ing.quantity !== undefined
      ? formatQuantity(ing.quantity) : "";
    const parts = [qtyStr, ing.unit || "", ing.item, ing.preparation ? `, ${ing.preparation}` : ""].filter(Boolean);
    setEditText(parts.join(" ").replace(" ,", ",").trim());
    setEditingIndex(index);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setEditText("");
  }

  function saveEdit() {
    if (editingIndex === null) return;
    const text = editText.trim();
    if (!text) {
      cancelEdit();
      return;
    }
    const before = displayIngredients[editingIndex];
    const after: Ingredient = {
      ...before,
      quantity: null,
      unit: null,
      item: text,
      preparation: "",
      notes: "",
    };
    const nextIngs = displayIngredients.map((ing, i) => i === editingIndex ? after : ing);
    const nextSwaps = { ...swaps };
    if (!nextSwaps[editingIndex]) nextSwaps[editingIndex] = { before };
    setDisplayIngredients(nextIngs);
    setSwaps(nextSwaps);
    setEditingIndex(null);
    setEditText("");
    persistWorkingState(nextIngs, displayInstructions, appliedSeasonings);
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

  // ─── Nutrition / Cost / Impact (always against current display) ──────────

  function buildOverride() {
    return {
      ingredients: displayIngredients,
      instructions: displayInstructions,
      servings: adjustedServings ?? recipe?.servings ?? undefined,
    };
  }

  async function ensureNutrition() {
    if (!recipe || nutrition || nutritionLoading) return;
    setNutritionLoading(true);
    try {
      const data = await getNutrition(recipe.id, buildOverride());
      setNutrition(data);
    } catch (e: any) {
      alert("Could not get nutrition: " + e.message);
    } finally {
      setNutritionLoading(false);
    }
  }

  async function ensureCost() {
    if (!recipe || cost || costLoading) return;
    setCostLoading(true);
    try {
      const data = await estimateCost(recipe.id, buildOverride());
      setCost(data);
    } catch (e: any) {
      alert("Could not estimate cost: " + e.message);
    } finally {
      setCostLoading(false);
    }
  }

  async function ensureImpact() {
    if (!recipe || impact || impactLoading) return;
    setImpactLoading(true);
    try {
      const data = await estimateImpact(recipe.id, buildOverride());
      setImpact(data);
    } catch (e: any) {
      alert("Could not estimate impact: " + e.message);
    } finally {
      setImpactLoading(false);
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

  // ─── Basket ────────────────────────────────────────────────────────────

  async function handleAddToBasket() {
    if (!recipe) return;
    try {
      const result = await addRecipeToBasket(recipe.id, displayIngredients);
      setBasketFeedback({ added: result.added, skipped: result.skipped_in_larder });
      setTimeout(() => setBasketFeedback(null), 5000);
    } catch (e: any) {
      alert("Failed to add to basket: " + e.message);
    }
  }

  // ─── Popover helpers ─────────────────────────────────────────────────────

  function togglePopover(which: "season" | "nutrition" | "cost" | "impact") {
    if (openPopover === which) {
      setOpenPopover(null);
      return;
    }
    setOpenPopover(which);
    if (which === "nutrition") ensureNutrition();
    if (which === "cost") ensureCost();
    if (which === "impact") ensureImpact();
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const date = recipe
    ? new Date(recipe.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : "";

  const nutritionScale = (nutrition && adjustedServings && nutrition.servings)
    ? adjustedServings / nutrition.servings : 1;

  const isApplied = (key: string) => appliedSeasonings.some(s => s.key === key);

  const allReasoning: { key: string; label: string; reasoning: Record<string, string> }[] = appliedSeasonings;

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
                {!isFriendView && (
                  <>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                      style={{ background: "none", border: `1px solid ${colors.border}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, color: colors.muted, cursor: "pointer", fontFamily: fonts.sans }}
                    >
                      {uploadingImage
                        ? "Uploading..."
                        : recipe.image_url ? "Replace photo" : "Add photo"}
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
                  <Tooltip label="Switch between metric (g, ml) and imperial (oz, lb)">
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
                          {u === "metric" ? "Metric" : "Imperial"}
                        </button>
                      ))}
                    </div>
                  </Tooltip>
                )}

                {/* Season */}
                {!isFriendView && (
                  <div style={{ position: "relative", display: "inline-flex" }}>
                    <Tooltip label="Season this recipe: stack veggie, cheaper, seasonal, and more" disabled={openPopover === "season"}>
                      <button
                        ref={seasonBtnRef}
                        onClick={() => togglePopover("season")}
                        style={appliedSeasonings.length ? TOOLBAR_BTN_ACTIVE : TOOLBAR_BTN}
                      >
                        <span style={{ color: colors.green, display: "flex" }}>
                          <SaltShakerLogo size={16} color="currentColor" strokeWidth={2} />
                        </span>
                        <span>Season</span>
                        {appliedSeasonings.length > 0 && (
                          <span
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              background: colors.green, color: colors.white,
                              fontSize: 11, fontWeight: 600, padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {appliedSeasonings.length} applied
                          </span>
                        )}
                        <ChevronIcon />
                      </button>
                    </Tooltip>
                    <Popover
                      open={openPopover === "season"}
                      onClose={() => setOpenPopover(null)}
                      anchorRef={seasonBtnRef}
                      align="start"
                      width={320}
                    >
                      <div style={{ fontFamily: fonts.sans }}>
                        {/* Personalise — featured at the top */}
                        {(() => {
                          const t = findTransform("personalise")!;
                          const active = isApplied("personalise");
                          return (
                            <Tooltip label={t.tooltip} placement="top">
                              <button
                                onClick={() => handleTransform(t.key)}
                                disabled={!!transformingKey || active}
                                style={{
                                  width: "100%",
                                  padding: "12px 14px", borderRadius: 10,
                                  border: active ? "none" : `1px solid ${colors.green}`,
                                  background: active ? colors.green : colors.greenLight,
                                  color: active ? colors.white : colors.green,
                                  fontSize: 14, fontWeight: 600,
                                  fontFamily: fonts.sans,
                                  cursor: active ? "default" : "pointer",
                                  display: "flex", alignItems: "center", gap: 8,
                                }}
                              >
                                <SaltShakerLogo size={18} color="currentColor" strokeWidth={2} />
                                Personalise
                                <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
                                  {active ? "Applied" : "Made for you"}
                                </span>
                              </button>
                            </Tooltip>
                          );
                        })()}

                        {/* Grouped sections */}
                        {TRANSFORM_GROUPS.map(group => (
                          <div key={group.title} style={{ marginTop: 14 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 2px 6px" }}>
                              {group.title}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                              {group.keys.map(k => {
                                const t = findTransform(k);
                                if (!t) return null;
                                const active = isApplied(k);
                                const loading = transformingKey === k;
                                return (
                                  <Tooltip key={k} label={active ? "Already applied" : t.tooltip} placement="top">
                                    <button
                                      onClick={() => handleTransform(k)}
                                      disabled={!!transformingKey || active}
                                      style={{
                                        width: "100%",
                                        padding: "8px 10px", borderRadius: 8,
                                        border: active ? `1px solid ${colors.green}` : `1px solid ${colors.borderSoft}`,
                                        background: active ? colors.greenLight : colors.white,
                                        color: active ? colors.green : colors.text,
                                        fontSize: 13, fontWeight: active ? 600 : 500,
                                        fontFamily: fonts.sans,
                                        cursor: active ? "default" : "pointer",
                                        textAlign: "left",
                                      }}
                                    >
                                      {loading ? "..." : t.label}
                                      {active && <span style={{ marginLeft: 6 }}>✓</span>}
                                    </button>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <div style={{ height: 1, background: colors.borderSoft, margin: "14px 0" }} />

                        <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, padding: "0 2px 6px" }}>Dietary needs</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 2px" }}>
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

                        {appliedSeasonings.length > 0 && (
                          <>
                            <div style={{ height: 1, background: colors.borderSoft, margin: "14px 0" }} />
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
                  <Tooltip label="Nutritional info per serving (uses the current recipe state)" disabled={openPopover === "nutrition"}>
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

                {/* Impact */}
                <div style={{ position: "relative", display: "inline-flex" }}>
                  <Tooltip label="Environmental impact, estimated in kg CO2e" disabled={openPopover === "impact"}>
                    <button
                      ref={impactBtnRef}
                      onClick={() => togglePopover("impact")}
                      aria-label="Environmental impact"
                      style={{ ...TOOLBAR_BTN, padding: "8px 10px" }}
                    >
                      <ImpactIcon size={16} />
                    </button>
                  </Tooltip>
                  <Popover
                    open={openPopover === "impact"}
                    onClose={() => setOpenPopover(null)}
                    anchorRef={impactBtnRef}
                    align="end"
                    width={320}
                  >
                    <div style={{ fontFamily: fonts.sans }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                        Environmental impact
                      </div>
                      {impactLoading ? (
                        <LoadingSpinner label="Estimating..." />
                      ) : impact ? (
                        <>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                            <div style={{ textAlign: "center", padding: "12px 6px", background: colors.cream, borderRadius: 8 }}>
                              <div style={{ fontSize: 20, fontWeight: 600, color: colors.green }}>
                                {impact.kg_co2e_per_serving.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>kg CO2e / serving</div>
                            </div>
                            <div style={{ textAlign: "center", padding: "12px 6px", background: colors.cream, borderRadius: 8 }}>
                              <div style={{ fontSize: 20, fontWeight: 600, color: colors.text }}>
                                {impact.kg_co2e_total.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>kg CO2e total</div>
                            </div>
                          </div>
                          <div style={{
                            display: "inline-block", padding: "3px 10px", borderRadius: 999,
                            fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5,
                            background: impact.rating === "low" ? colors.greenLight : impact.rating === "high" ? colors.errorBg : "#fff4d6",
                            color: impact.rating === "low" ? colors.green : impact.rating === "high" ? colors.error : "#8a6d00",
                            marginBottom: 8,
                          }}>
                            {impact.rating} impact
                          </div>
                          {impact.summary && (
                            <p style={{ fontSize: 13, color: colors.textSoft, lineHeight: 1.5, margin: 0 }}>
                              {impact.summary}
                            </p>
                          )}
                        </>
                      ) : (
                        <div style={{ fontSize: 13, color: colors.muted }}>No estimate yet.</div>
                      )}
                    </div>
                  </Popover>
                </div>

                <div style={{ flex: 1 }} />

                {!isFriendView && (
                  <Tooltip label="Add these ingredients to your shopping basket (skips anything in your larder)" placement="top">
                    <button
                      onClick={handleAddToBasket}
                      style={basketFeedback
                        ? { ...TOOLBAR_BTN_ACTIVE, background: colors.greenLight, color: colors.green }
                        : TOOLBAR_BTN_PRIMARY}
                    >
                      <BasketIcon size={16} />
                      <span>{basketFeedback ? "Added" : "Add to basket"}</span>
                    </button>
                  </Tooltip>
                )}
              </div>
            </div>

            {/* Applied seasonings as removable chips */}
            {appliedSeasonings.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: colors.muted, fontFamily: fonts.sans }}>Applied:</span>
                {appliedSeasonings.map(s => (
                  <span
                    key={s.key}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      background: colors.greenLight, color: colors.green,
                      fontSize: 12, fontWeight: 600, padding: "3px 10px",
                      borderRadius: 999, border: `1px solid ${colors.green}`,
                      fontFamily: fonts.sans,
                    }}
                  >
                    {s.label}
                  </span>
                ))}
              </div>
            )}

            {basketFeedback && (
              <div
                role="status"
                style={{
                  background: colors.greenLight, border: `1px solid ${colors.green}`,
                  borderRadius: 10, padding: "10px 14px",
                  fontFamily: fonts.sans, fontSize: 13, color: colors.text,
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <div style={{ color: colors.green, fontWeight: 600 }}>
                  {basketFeedback.added === 0
                    ? "Everything's already in your larder."
                    : `Added ${basketFeedback.added} ${basketFeedback.added === 1 ? "item" : "items"} to your basket.`}
                </div>
                {basketFeedback.skipped.length > 0 && (
                  <div style={{ color: colors.textSoft }}>
                    Skipped {basketFeedback.skipped.length} already in your larder: {basketFeedback.skipped.slice(0, 5).join(", ")}
                    {basketFeedback.skipped.length > 5 ? ` and ${basketFeedback.skipped.length - 5} more` : ""}.
                  </div>
                )}
              </div>
            )}

            {transformingKey && <LoadingSpinner label="Seasoning the recipe..." />}

            {/* Combined reasoning from all applied seasonings */}
            {allReasoning.length > 0 && allReasoning.some(s => Object.keys(s.reasoning || {}).length > 0) && (
              <div style={{
                background: colors.greenLight, borderRadius: 12, border: `1px solid ${colors.border}`,
                padding: "14px 20px", fontFamily: fonts.sans,
              }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 8 }}>
                  Changes made
                </h4>
                {allReasoning.map(s => (
                  Object.entries(s.reasoning || {}).map(([change, reason]) => (
                    <div key={`${s.key}-${change}`} style={{ fontSize: 13, color: colors.text, marginBottom: 6, lineHeight: 1.5 }}>
                      <strong>{change}</strong> ({s.label.toLowerCase()}), {reason}
                    </div>
                  ))
                ))}
              </div>
            )}

            {/* Ingredients */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.borderSoft}`, padding: "20px 24px", position: "relative" }}>
              <h2 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: 20, marginBottom: 16 }}>
                Ingredients
              </h2>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {displayIngredients.map((ing, i) => (
                  <li key={i} style={{ position: "relative", listStyle: "none" }}>
                    <IngredientRow
                      ing={ing}
                      index={i}
                      scaleFactor={scaleFactor}
                      swap={swaps[i]}
                      onOpenSwap={() => openSwapFor(i)}
                      onRevertSwap={() => revertSwap(i)}
                      onStartEdit={() => startEdit(i)}
                      isEditing={editingIndex === i}
                      editText={editText}
                      onEditTextChange={setEditText}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      swapOpenForThis={swapOpenIndex === i}
                      swapBtnRef={swapBtnRef}
                      readOnly={isFriendView}
                    />
                    {swapOpenIndex === i && (
                      <SwapPopover
                        anchorRef={swapBtnRef}
                        onClose={closeSwap}
                        ingredient={ing}
                        loading={swapLoading}
                        data={swapData}
                        customMode={customSwapMode}
                        customText={customSwapText}
                        onCustomToggle={() => setCustomSwapMode(true)}
                        onCustomChange={setCustomSwapText}
                        onCustomSubmit={() => fetchSwapOptions(ing, customSwapText)}
                        onApply={(option) => applySwap(i, option)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Instructions */}
            <div style={{ background: colors.white, borderRadius: 12, border: `1px solid ${colors.borderSoft}`, padding: "20px 24px" }}>
              <h2 style={{ fontFamily: fonts.serif, fontStyle: "italic", fontWeight: 600, color: colors.text, fontSize: 20, marginBottom: 16 }}>
                Instructions
              </h2>
              <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
                {displayInstructions.map((step, i) => (
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

// ─── Swap Popover ────────────────────────────────────────────────────────────

interface SwapPopoverProps {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  ingredient: Ingredient;
  loading: boolean;
  data: SubstitutionResponse | null;
  customMode: boolean;
  customText: string;
  onCustomToggle: () => void;
  onCustomChange: (v: string) => void;
  onCustomSubmit: () => void;
  onApply: (option: { substitute: string; quantity?: number | null; unit?: string | null; item?: string | null; preparation?: string | null }) => void;
}

function SwapPopover({
  anchorRef, onClose, ingredient, loading, data,
  customMode, customText, onCustomToggle, onCustomChange, onCustomSubmit, onApply,
}: SwapPopoverProps) {
  return (
    <Popover
      open={true}
      onClose={onClose}
      anchorRef={anchorRef}
      align="end"
      width={320}
    >
      <div style={{ fontFamily: fonts.sans }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
          Swap "{ingredient.item}"
        </div>

        {loading ? (
          <LoadingSpinner label="Finding alternatives..." />
        ) : data ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.options.map((opt, i) => (
              <Tooltip key={i} label={opt.reasoning || opt.tag} placement="top">
                <button
                  onClick={() => onApply(opt)}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 8,
                    border: `1px solid ${colors.borderSoft}`, background: colors.white,
                    color: colors.text, cursor: "pointer", fontFamily: fonts.sans,
                    textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = colors.green; e.currentTarget.style.background = colors.greenLight; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = colors.borderSoft; e.currentTarget.style.background = colors.white; }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{opt.substitute}</span>
                  {opt.tag && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: colors.cream, color: colors.green, textTransform: "uppercase", letterSpacing: 0.4 }}>
                      {opt.tag}
                    </span>
                  )}
                </button>
              </Tooltip>
            ))}

            {!customMode ? (
              <button
                onClick={onCustomToggle}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 8,
                  border: `1px dashed ${colors.border}`, background: "transparent",
                  color: colors.muted, fontSize: 12, cursor: "pointer", fontFamily: fonts.sans,
                  textAlign: "left",
                }}
              >
                None of these — describe what you want
              </button>
            ) : (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  autoFocus
                  value={customText}
                  onChange={e => onCustomChange(e.target.value)}
                  placeholder="e.g. halal and cheap"
                  onKeyDown={e => { if (e.key === "Enter" && customText.trim()) onCustomSubmit(); }}
                  style={{
                    flex: 1, padding: "6px 10px", border: `1px solid ${colors.green}`,
                    borderRadius: 6, fontSize: 13, fontFamily: fonts.sans, outline: "none",
                  }}
                />
                <button
                  onClick={onCustomSubmit}
                  disabled={!customText.trim()}
                  style={{
                    background: colors.green, color: colors.white, border: "none",
                    borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 600,
                    cursor: customText.trim() ? "pointer" : "default", fontFamily: fonts.sans,
                    opacity: customText.trim() ? 1 : 0.5,
                  }}
                >
                  Find
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: colors.muted }}>No alternatives.</div>
        )}
      </div>
    </Popover>
  );
}
