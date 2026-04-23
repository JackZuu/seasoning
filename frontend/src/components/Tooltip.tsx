import { useState, useRef, ReactNode } from "react";
import { colors, fonts } from "../theme";

interface Props {
  label: string;
  children: ReactNode;
  placement?: "top" | "bottom";
  delay?: number;
  disabled?: boolean;
}

export default function Tooltip({
  label,
  children,
  placement = "bottom",
  delay = 250,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  function show() {
    if (disabled) return;
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  const isTop = placement === "top";

  return (
    <span
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      style={{ position: "relative", display: "inline-flex" }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: "absolute",
            [isTop ? "bottom" : "top"]: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: colors.text,
            color: colors.white,
            fontFamily: fonts.sans,
            fontSize: 12,
            fontWeight: 500,
            lineHeight: 1.3,
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 100,
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
            maxWidth: 240,
          }}
        >
          {label}
          <span
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: 8,
              height: 8,
              background: colors.text,
              [isTop ? "bottom" : "top"]: -3,
            }}
          />
        </span>
      )}
    </span>
  );
}
