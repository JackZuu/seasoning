import { colors } from "../theme";

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Tilted line-art salt shaker matching the Seasoning brand guide.
 * Cap top-right, body bottom-left, a sprinkle of grains at the top.
 */
export default function SaltShakerLogo({
  size = 48,
  color = colors.white,
  strokeWidth = 2,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <g
        transform="rotate(32 40 40)"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* Body (rounded rectangle with neck) */}
        <path d="M26 30 L26 62 Q26 66 30 66 L50 66 Q54 66 54 62 L54 30" />
        {/* Neck / shoulder into cap */}
        <path d="M26 30 Q26 26 30 26 L50 26 Q54 26 54 30" />
        {/* Cap band */}
        <path d="M28 22 L52 22" />
        {/* Cap top */}
        <path d="M30 14 Q30 10 34 10 L46 10 Q50 10 50 14 L50 22 L30 22 Z" />
        {/* Perforations */}
        <circle cx="36" cy="16" r="0.9" fill={color} stroke="none" />
        <circle cx="40" cy="14.5" r="0.9" fill={color} stroke="none" />
        <circle cx="44" cy="16" r="0.9" fill={color} stroke="none" />
        <circle cx="38" cy="18.5" r="0.9" fill={color} stroke="none" />
        <circle cx="42" cy="18.5" r="0.9" fill={color} stroke="none" />
      </g>
      {/* Sprinkled grains (in unrotated frame so they fall "up") */}
      <circle cx="62" cy="18" r="1.4" fill={color} />
      <circle cx="68" cy="10" r="1.1" fill={color} />
      <circle cx="58" cy="8"  r="1.0" fill={color} />
      <circle cx="72" cy="22" r="0.9" fill={color} />
      <circle cx="54" cy="14" r="0.8" fill={color} />
    </svg>
  );
}
