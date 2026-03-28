import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import { colors } from "../theme";
import { listLarder, addLarderItem, removeLarderItem, generateRecipesFromLarder, LarderItem, LarderRecipeSuggestion } from "../api/larder";
import { parseRecipe } from "../api/recipes";

const CATEGORIES = ["Fruit & Veg", "Meat & Fish", "Dairy", "Bakery", "Tinned & Dried", "Herbs & Spices", "Sauces & Condiments", "Frozen", "Other"];

export default function LarderPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LarderItem[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("Other");
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<LarderRecipeSuggestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    listLarder().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const item = await addLarderItem(newItem.trim(), newCategory);
    setItems(prev => [...prev, item]);
    setNewItem("");
  }

  async function handleRemove(id: number) {
    await removeLarderItem(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleGenerate() {
    setGenerating(true);
    setSuggestions([]);
    try {
      const result = await generateRecipesFromLarder();
      setSuggestions(result);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveSuggestion(suggestion: LarderRecipeSuggestion) {
    setSaving(suggestion.title);
    try {
      const allIngredients = [...suggestion.key_ingredients, ...suggestion.missing_ingredients];
      const text = [
        `Recipe: ${suggestion.title}`,
        ``,
        suggestion.description,
        ``,
        `Serves: 4`,
        ``,
        `Ingredients:`,
        ...allIngredients.map(i => `- ${i}`),
        ``,
        `Please generate the full recipe with precise quantities for each ingredient and detailed step-by-step cooking instructions.`,
      ].join("\n");
      const recipe = await parseRecipe(text);
      navigate(`/recipes/${recipe.id}`);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    } finally {
      setSaving(null);
    }
  }

  const grouped = CATEGORIES.map(cat => ({
    category: cat,
    items: items.filter(i => i.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ maxWidth: 800, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1 }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 8 }}>
          Your Larder
        </h2>
        <p style={{ color: colors.muted, fontSize: 14, fontFamily: "system-ui, sans-serif", marginBottom: 24 }}>
          What have you got in the house? Add your ingredients and we'll suggest what to cook.
        </p>

        {/* Add item form */}
        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add an ingredient..."
            style={{
              flex: 1, minWidth: 200, padding: "10px 14px",
              border: `1px solid ${colors.border}`, borderRadius: 8,
              fontSize: 14, fontFamily: "system-ui, sans-serif", outline: "none", color: colors.text,
            }}
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            style={{
              padding: "10px 12px", border: `1px solid ${colors.border}`, borderRadius: 8,
              fontSize: 13, fontFamily: "system-ui, sans-serif", color: colors.text, background: colors.white,
            }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="submit" style={{
            background: colors.green, color: colors.white, border: "none",
            borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>
            Add
          </button>
        </form>

        {loading ? <LoadingSpinner label="Loading your larder..." /> : (
          <>
            {items.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: colors.muted, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
                Your larder is empty — start adding what you've got in.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
                {grouped.map(g => (
                  <div key={g.category} style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "14px 20px" }}>
                    <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>{g.category}</h4>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {g.items.map(item => (
                        <span key={item.id} style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          background: colors.greenLight, borderRadius: 20, padding: "5px 12px",
                          fontSize: 13, fontFamily: "system-ui, sans-serif", color: colors.text,
                        }}>
                          {item.item}
                          <button onClick={() => handleRemove(item.id)} style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: colors.muted, fontSize: 14, padding: 0, lineHeight: 1,
                          }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  background: colors.green, color: colors.white, border: "none",
                  borderRadius: 10, padding: "14px 28px", fontSize: 15, fontWeight: 600,
                  cursor: generating ? "not-allowed" : "pointer", width: "100%", marginBottom: 24,
                }}
              >
                {generating ? "Thinking up recipes..." : "What can I cook?"}
              </button>
            )}

            {generating && <LoadingSpinner label="Raiding your larder for inspiration..." />}

            {suggestions.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18 }}>Recipe ideas</h3>
                {suggestions.map((s, i) => (
                  <div key={i} style={{
                    background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`,
                    padding: "16px 20px", fontFamily: "system-ui, sans-serif",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div>
                        <h4 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 16, marginBottom: 6 }}>{s.title}</h4>
                        <p style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5, marginBottom: 8 }}>{s.description}</p>
                        {s.missing_ingredients.length > 0 && (
                          <p style={{ fontSize: 12, color: colors.muted }}>
                            You'd need: {s.missing_ingredients.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSaveSuggestion(s)}
                        disabled={saving === s.title}
                        style={{
                          background: colors.green, color: colors.white, border: "none",
                          borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600,
                          cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        {saving === s.title ? "Saving..." : "+ Save"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
