import { colors } from "../theme";

interface Props {
  size?: number;
  color?: string;
}

export default function SaltShakerLogo({ size = 48, color = colors.text }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", transform: "rotate(180deg)" }}
    >
      {/* Cap */}
      <rect x="18" y="46" width="28" height="10" rx="3" fill={color} />
      {/* Holes in cap */}
      <circle cx="27" cy="51" r="1.5" fill={colors.cream} />
      <circle cx="32" cy="51" r="1.5" fill={colors.cream} />
      <circle cx="37" cy="51" r="1.5" fill={colors.cream} />
      {/* Body */}
      <path
        d="M20 46 L22 16 C22 14 24 12 26 12 L38 12 C40 12 42 14 42 16 L44 46 Z"
        fill={color}
        opacity="0.85"
      />
      {/* Label band */}
      <rect x="23" y="24" width="18" height="8" rx="2" fill={colors.cream} opacity="0.5" />
      {/* Salt grains coming out */}
      <circle cx="28" cy="8" r="1.2" fill={color} opacity="0.5" />
      <circle cx="32" cy="6" r="1" fill={color} opacity="0.4" />
      <circle cx="35" cy="9" r="1.1" fill={color} opacity="0.45" />
      <circle cx="30" cy="4" r="0.8" fill={color} opacity="0.3" />
    </svg>
  );
}
