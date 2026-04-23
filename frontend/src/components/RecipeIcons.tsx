/**
 * Line-art icons matching the Seasoning salt-shaker style.
 * All use currentColor so they inherit from parent text colour.
 */

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function Svg({ size = 18, children, strokeWidth = 1.8 }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: "block", flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

/** Plate with a fork — servings */
export function ServingsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="10" cy="14" r="6" />
      <circle cx="10" cy="14" r="3" />
      <path d="M18 4 L18 13" />
      <path d="M16 4 L16 8 Q16 10 18 10 Q20 10 20 8 L20 4" />
    </Svg>
  );
}

/** Balance / scale — units */
export function UnitsIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 L12 20" />
      <path d="M6 20 L18 20" />
      <path d="M5 10 L12 6 L19 10" />
      <path d="M3 14 Q5 10 7 14 Q5 16 3 14 Z" />
      <path d="M17 14 Q19 10 21 14 Q19 16 17 14 Z" />
    </Svg>
  );
}

/** Needle and thread — tailor */
export function TailorIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="5" cy="6" r="2.5" />
      <path d="M5 3.5 L5 5" />
      <path d="M7 7 L20 20" />
      <path d="M18 20 L21 20 L21 17" />
      <path d="M3.5 7.5 Q2 10 4 12 Q6 14 4 17" />
    </Svg>
  );
}

/** Leaf — nutrition */
export function NutritionIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 19 Q5 8 16 5 Q20 4 20 4 Q20 4 19 9 Q16 20 5 19 Z" />
      <path d="M5 19 Q10 14 17 7" />
    </Svg>
  );
}

/** Coin — cost */
export function CostIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14 8.5 Q11.5 7.5 10 9 Q9 10 10 11.5 L10 16.5" />
      <path d="M8.5 13 L12.5 13" />
      <path d="M8.5 16.5 L14.5 16.5" />
    </Svg>
  );
}

/** Basket — add to basket */
export function BasketIcon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8 L21 8 L19 20 Q19 21 18 21 L6 21 Q5 21 5 20 Z" />
      <path d="M8 8 L10 3" />
      <path d="M16 8 L14 3" />
      <path d="M9 12 L9 17" />
      <path d="M15 12 L15 17" />
    </Svg>
  );
}

/** Chevron down */
export function ChevronIcon({ size = 14, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M6 9 L12 15 L18 9" />
    </Svg>
  );
}

/** Close / X */
export function CloseIcon({ size = 14, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M6 6 L18 18" />
      <path d="M18 6 L6 18" />
    </Svg>
  );
}

/** Minus (servings stepper) */
export function MinusIcon({ size = 14, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M5 12 L19 12" />
    </Svg>
  );
}

/** Plus (servings stepper, add recipe) */
export function PlusIcon({ size = 14, strokeWidth = 2 }: IconProps) {
  return (
    <Svg size={size} strokeWidth={strokeWidth}>
      <path d="M12 5 L12 19" />
      <path d="M5 12 L19 12" />
    </Svg>
  );
}
