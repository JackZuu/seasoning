import { useState } from "react";
import Header from "../components/Header";
import { colors } from "../theme";
import { useAuth } from "../context/AuthContext";
import { updateProfile } from "../api/profile";

const DIETS = [
  { key: "none", label: "No preference" },
  { key: "veggie", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
];

const BUDGETS = [
  { key: "cheap", label: "I like to spend little" },
  { key: "moderate", label: "Somewhere in the middle" },
  { key: "luxurious", label: "Treat me" },
];

const CURRENCIES = ["GBP", "USD", "EUR", "AUD", "CAD"];

const DIETARY_OPTIONS = [
  "Gluten-free", "Dairy-free", "Nut-free", "Egg-free",
  "Soy-free", "Shellfish-free", "Halal", "Kosher",
];

export default function PreferencesPage() {
  const { user, updateUser } = useAuth();
  const prefs = user?.preferences || {};

  const [diet, setDiet] = useState<string>(prefs.diet || "none");
  const [seasonal, setSeasonal] = useState<boolean>(prefs.seasonal || false);
  const [eco, setEco] = useState<boolean>(prefs.eco || false);
  const [budget, setBudget] = useState<string>(prefs.budget || "moderate");
  const [dietaryReqs, setDietaryReqs] = useState<string[]>(prefs.dietary_requirements || []);
  const [currency, setCurrency] = useState(user?.currency || "GBP");
  const [saved, setSaved] = useState(true);

  function toggleDietary(opt: string) {
    setDietaryReqs(prev => prev.includes(opt) ? prev.filter(d => d !== opt) : [...prev, opt]);
    setSaved(false);
  }

  async function handleSave() {
    const preferences = { diet: diet === "none" ? null : diet, seasonal, eco, budget, dietary_requirements: dietaryReqs };
    try {
      const updated = await updateProfile({ preferences, currency });
      updateUser(updated);
      setSaved(true);
    } catch (e: any) {
      alert("Failed to save: " + e.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ maxWidth: 600, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1, fontFamily: "system-ui, sans-serif" }}>
        <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 8 }}>
          Your Preferences
        </h2>
        <p style={{ color: colors.muted, fontSize: 14, marginBottom: 28 }}>
          Set your defaults here. When you hit "Personalise" on any recipe, we'll adjust it to match.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Diet */}
          <section style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Diet</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DIETS.map(d => (
                <button key={d.key} onClick={() => { setDiet(d.key); setSaved(false); }} style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: diet === d.key ? "none" : `1px solid ${colors.border}`,
                  background: diet === d.key ? colors.green : colors.white,
                  color: diet === d.key ? colors.white : colors.text,
                  fontWeight: diet === d.key ? 600 : 400,
                }}>{d.label}</button>
              ))}
            </div>
          </section>

          {/* Seasonal / Eco */}
          <section style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Sustainability</h3>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: colors.text, cursor: "pointer", marginBottom: 10 }}>
              <input type="checkbox" checked={seasonal} onChange={() => { setSeasonal(!seasonal); setSaved(false); }} style={{ accentColor: colors.green, width: 18, height: 18 }} />
              Prefer seasonal ingredients
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: colors.text, cursor: "pointer" }}>
              <input type="checkbox" checked={eco} onChange={() => { setEco(!eco); setSaved(false); }} style={{ accentColor: colors.green, width: 18, height: 18 }} />
              Reduce environmental impact
            </label>
          </section>

          {/* Budget */}
          <section style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Budget</h3>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {BUDGETS.map(b => (
                <button key={b.key} onClick={() => { setBudget(b.key); setSaved(false); }} style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                  border: budget === b.key ? "none" : `1px solid ${colors.border}`,
                  background: budget === b.key ? colors.green : colors.white,
                  color: budget === b.key ? colors.white : colors.text,
                  fontWeight: budget === b.key ? 600 : 400,
                }}>{b.label}</button>
              ))}
            </div>
          </section>

          {/* Currency */}
          <section style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Currency</h3>
            <select value={currency} onChange={e => { setCurrency(e.target.value); setSaved(false); }} style={{
              padding: "8px 14px", border: `1px solid ${colors.border}`, borderRadius: 8,
              fontSize: 14, color: colors.text, background: colors.white,
            }}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </section>

          {/* Dietary */}
          <section style={{ background: colors.white, borderRadius: 10, border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: colors.text, marginBottom: 12 }}>Dietary requirements</h3>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {DIETARY_OPTIONS.map(opt => (
                <label key={opt} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: colors.text, cursor: "pointer" }}>
                  <input type="checkbox" checked={dietaryReqs.includes(opt)} onChange={() => toggleDietary(opt)} style={{ accentColor: colors.green }} />
                  {opt}
                </label>
              ))}
            </div>
          </section>

          <button onClick={handleSave} style={{
            background: saved ? colors.muted : colors.green, color: colors.white,
            border: "none", borderRadius: 10, padding: "14px", fontSize: 15,
            fontWeight: 600, cursor: saved ? "default" : "pointer", width: "100%",
          }}>
            {saved ? "Preferences saved" : "Save preferences"}
          </button>
        </div>
      </div>
    </div>
  );
}
