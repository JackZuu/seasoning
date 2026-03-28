import { useEffect, useState } from "react";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import { colors } from "../theme";
import { listBasket, addToBasket, toggleCheck, removeFromBasket, clearCompleted, clearBasket, BasketItem } from "../api/basket";

export default function BasketPage() {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    listBasket().then(setItems).finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const item = await addToBasket(newItem.trim());
    setItems(prev => [...prev, item]);
    setNewItem("");
  }

  async function handleToggle(id: number) {
    const checked = await toggleCheck(id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked } : i));
  }

  async function handleRemove(id: number) {
    await removeFromBasket(id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  async function handleClearCompleted() {
    await clearCompleted();
    setItems(prev => prev.filter(i => !i.checked));
  }

  async function handleClearAll() {
    if (!confirm("Clear your entire basket?")) return;
    await clearBasket();
    setItems([]);
  }

  const grouped = items.reduce<Record<string, BasketItem[]>>((acc, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const checkedCount = items.filter(i => i.checked).length;

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />
      <div style={{ maxWidth: 600, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", flex: 1, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)" }}>Your Basket</h2>
          {items.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {checkedCount > 0 && (
                <button onClick={handleClearCompleted} style={{
                  background: "none", border: `1px solid ${colors.border}`, borderRadius: 6,
                  padding: "5px 12px", fontSize: 12, color: colors.muted, cursor: "pointer",
                }}>Clear done</button>
              )}
              <button onClick={handleClearAll} style={{
                background: "none", border: `1px solid ${colors.errorBorder}`, borderRadius: 6,
                padding: "5px 12px", fontSize: 12, color: colors.error, cursor: "pointer",
              }}>Clear basket</button>
            </div>
          )}
        </div>
        <p style={{ color: colors.muted, fontSize: 14, marginBottom: 24 }}>
          Your shopping list — add items here or from any recipe.
        </p>

        <form onSubmit={handleAdd} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <input
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add an item..."
            style={{
              flex: 1, padding: "10px 14px", border: `1px solid ${colors.border}`,
              borderRadius: 8, fontSize: 14, outline: "none", color: colors.text,
            }}
          />
          <button type="submit" style={{
            background: colors.green, color: colors.white, border: "none",
            borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
          }}>Add</button>
        </form>

        {loading ? <LoadingSpinner label="Loading basket..." /> : (
          items.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: colors.muted, fontSize: 14 }}>
              Your basket is empty. Add items here or from a recipe.
            </div>
          ) : (
            Object.entries(grouped).map(([category, catItems]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: colors.green, marginBottom: 8 }}>{category}</h4>
                {catItems.map(item => (
                  <div key={item.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: colors.white,
                    border: `1px solid ${colors.border}`, borderRadius: 8, marginBottom: 4,
                  }}>
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => handleToggle(item.id)}
                      style={{ accentColor: colors.green, width: 18, height: 18, cursor: "pointer" }}
                    />
                    <span style={{
                      flex: 1, fontSize: 14, color: item.checked ? colors.muted : colors.text,
                      textDecoration: item.checked ? "line-through" : "none",
                    }}>
                      {item.quantity && <strong>{item.quantity} </strong>}
                      {item.item}
                    </span>
                    <button onClick={() => handleRemove(item.id)} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: colors.muted, fontSize: 16, padding: "0 4px",
                    }}>×</button>
                  </div>
                ))}
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}
