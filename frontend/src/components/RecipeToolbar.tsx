import { colors } from "../theme";
import type { RecipeListItem } from "../api/recipes";

export type SortKey = "newest" | "oldest" | "az" | "za";

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortKey;
  onSortChange: (s: SortKey) => void;
  placeholder?: string;
}

export default function RecipeToolbar({ query, onQueryChange, sort, onSortChange, placeholder }: Props) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <input
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        placeholder={placeholder ?? "Search recipes..."}
        style={{
          flex: 1,
          minWidth: 200,
          padding: "10px 14px",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          fontSize: 14,
          outline: "none",
          color: colors.text,
          background: colors.white,
          boxSizing: "border-box",
          fontFamily: "system-ui, sans-serif",
        }}
      />
      <select
        value={sort}
        onChange={e => onSortChange(e.target.value as SortKey)}
        style={{
          padding: "10px 14px",
          border: `1px solid ${colors.border}`,
          borderRadius: 10,
          fontSize: 14,
          color: colors.text,
          background: colors.white,
          outline: "none",
          cursor: "pointer",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="az">Title A–Z</option>
        <option value="za">Title Z–A</option>
      </select>
    </div>
  );
}

export function applyRecipeFilters<T extends RecipeListItem>(
  recipes: T[],
  query: string,
  sort: SortKey,
): T[] {
  const q = query.trim().toLowerCase();
  const filtered = q ? recipes.filter(r => r.title.toLowerCase().includes(q)) : recipes.slice();

  filtered.sort((a, b) => {
    switch (sort) {
      case "az":     return a.title.localeCompare(b.title);
      case "za":     return b.title.localeCompare(a.title);
      case "oldest": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "newest":
      default:       return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return filtered;
}
