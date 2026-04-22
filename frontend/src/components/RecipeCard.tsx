import { useNavigate } from "react-router-dom";
import { colors } from "../theme";
import type { RecipeListItem } from "../api/recipes";

interface Props {
  recipe: RecipeListItem;
  onDelete?: (id: number) => void;
  onSave?: (id: number) => void;
  ownerName?: string;
  onClick?: (id: number) => void;
}

export default function RecipeCard({ recipe, onDelete, onSave, ownerName, onClick }: Props) {
  const navigate = useNavigate();

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (onDelete && confirm(`Delete "${recipe.title}"?`)) onDelete(recipe.id);
  }

  function handleSave(e: React.MouseEvent) {
    e.stopPropagation();
    if (onSave) onSave(recipe.id);
  }

  const date = new Date(recipe.created_at).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div
      onClick={() => (onClick ? onClick(recipe.id) : navigate(`/recipes/${recipe.id}`))}
      style={{
        background: colors.white,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        cursor: "pointer",
        transition: "box-shadow 0.15s, transform 0.1s",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(101,128,134,0.18)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {recipe.image_url && (
        <img
          src={recipe.image_url}
          alt={recipe.title}
          style={{ width: "100%", height: 140, objectFit: "cover" }}
        />
      )}

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{
          margin: 0,
          fontSize: 16,
          fontFamily: "Georgia, serif",
          color: colors.text,
          lineHeight: 1.3,
          paddingRight: 36,
        }}>
          {recipe.title}
        </h3>

        {ownerName && (
          <div style={{ fontSize: 12, color: colors.green, fontWeight: 600 }}>
            {ownerName}
          </div>
        )}

        <div style={{ fontSize: 13, color: colors.muted, fontFamily: "system-ui, sans-serif", display: "flex", gap: 12 }}>
          {recipe.servings && <span>Serves {recipe.servings}</span>}
          <span>{recipe.ingredient_count} ingredients</span>
        </div>

        <div style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif", marginTop: 4 }}>
          {date}
        </div>
      </div>

      {onDelete && (
        <button
          onClick={handleDelete}
          title="Delete recipe"
          style={{
            position: "absolute",
            top: recipe.image_url ? 148 : 14,
            right: 14,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: colors.muted,
            fontSize: 16,
            padding: 4,
            lineHeight: 1,
            borderRadius: 4,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = colors.error)}
          onMouseLeave={e => (e.currentTarget.style.color = colors.muted)}
        >
          ×
        </button>
      )}

      {onSave && (
        <button
          onClick={handleSave}
          title="Save to my recipes"
          style={{
            position: "absolute",
            top: recipe.image_url ? 148 : 10,
            right: 10,
            background: colors.green,
            color: colors.white,
            border: "none",
            cursor: "pointer",
            width: 28,
            height: 28,
            borderRadius: "50%",
            fontSize: 18,
            fontWeight: 600,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = colors.greenMid)}
          onMouseLeave={e => (e.currentTarget.style.background = colors.green)}
        >
          +
        </button>
      )}
    </div>
  );
}
