import { colors } from "../theme";

export default function LoadingSpinner({ label = "Loading..." }: { label?: string }) {
  return (
    <>
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 24 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: colors.greenMid,
                animation: "bounce 1.2s infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </div>
        <span style={{ fontSize: 13, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>
          {label}
        </span>
      </div>
    </>
  );
}
