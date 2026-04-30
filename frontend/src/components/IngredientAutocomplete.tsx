import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "../theme";
import { searchIngredients, IngredientHit } from "../api/ingredients";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onPick?: (hit: IngredientHit) => void;
  onSubmit?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputStyle?: React.CSSProperties;
}

/**
 * Text input with a dropdown of matches from the canonical ingredient
 * taxonomy. Triggers a debounced search as the user types. Keyboard:
 * Up/Down to navigate, Enter to pick the highlighted hit (or submit if
 * none), Escape to close.
 */
export default function IngredientAutocomplete({
  value, onChange, onPick, onSubmit, placeholder, autoFocus, inputStyle,
}: Props) {
  const [hits, setHits] = useState<IngredientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setHits([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await searchIngredients(value);
        setHits(result);
        setHighlight(0);
        setOpen(result.length > 0);
      } catch {
        // ignore — autocomplete is best-effort
      }
    }, 180);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(hit: IngredientHit) {
    onChange(hit.display_name || hit.canonical_name);
    onPick?.(hit);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hits.length > 0) {
        setOpen(true);
        setHighlight(h => Math.min(h + 1, hits.length - 1));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && hits[highlight]) {
        e.preventDefault();
        pick(hits[highlight]);
      } else {
        onSubmit?.();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative", flex: 1, minWidth: 0 }}>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { if (hits.length > 0) setOpen(true); }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        style={{
          width: "100%", padding: "10px 14px",
          border: `1px solid ${colors.border}`, borderRadius: 8,
          fontSize: 14, fontFamily: fonts.sans, outline: "none", color: colors.text,
          background: colors.white, boxSizing: "border-box",
          ...(inputStyle || {}),
        }}
      />
      {open && hits.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: colors.white, border: `1px solid ${colors.borderSoft}`,
            borderRadius: 8, boxShadow: "0 6px 22px rgba(0,0,0,0.10)",
            zIndex: 50, maxHeight: 240, overflowY: "auto",
          }}
        >
          {hits.map((h, i) => (
            <button
              key={h.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={e => { e.preventDefault(); pick(h); }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                width: "100%", padding: "8px 12px", textAlign: "left",
                background: i === highlight ? colors.greenLight : "transparent",
                border: "none", cursor: "pointer", fontFamily: fonts.sans, fontSize: 14,
                color: colors.text, display: "flex", justifyContent: "space-between",
                alignItems: "center", gap: 8,
              }}
            >
              <span>{h.display_name || h.canonical_name}</span>
              {h.category && (
                <span style={{ fontSize: 11, color: colors.muted, textTransform: "lowercase" }}>
                  {h.category}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
