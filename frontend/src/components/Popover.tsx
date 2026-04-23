import { useEffect, useRef, ReactNode } from "react";
import { colors } from "../theme";

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  children: ReactNode;
  align?: "start" | "end" | "center";
  width?: number | string;
}

/**
 * Lightweight popover anchored below a button.
 * Closes on outside click or Escape. No portal, no positioning engine.
 */
export default function Popover({
  open,
  onClose,
  anchorRef,
  children,
  align = "end",
  width,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const alignStyle: React.CSSProperties =
    align === "start" ? { left: 0 } :
    align === "center" ? { left: "50%", transform: "translateX(-50%)" } :
    { right: 0 };

  return (
    <div
      ref={ref}
      role="dialog"
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        zIndex: 50,
        background: colors.white,
        border: `1px solid ${colors.borderSoft}`,
        borderRadius: 12,
        boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
        padding: 12,
        minWidth: 220,
        width,
        ...alignStyle,
      }}
    >
      {children}
    </div>
  );
}
