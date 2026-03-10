import { useState, useRef, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ApiResponse {
  content?: string;
  error?: string;
  model?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const colors = {
  green:      "#1a5f3f",
  greenMid:   "#2d8659",
  greenLight: "#e8f5ee",
  cream:      "#f5f1e8",
  text:       "#1a1a1a",
  muted:      "#6b7280",
  border:     "#d1e8da",
  white:      "#ffffff",
  error:      "#dc2626",
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: colors.cream,
    fontFamily: "Georgia, 'Times New Roman', serif",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    background: colors.green,
    color: colors.white,
    padding: "clamp(12px, 3vw, 20px) clamp(16px, 5vw, 40px)",
    display: "flex",
    alignItems: "center",
    gap: 12,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  },
  headerTitle: {
    margin: 0,
    fontSize: "clamp(18px, 4vw, 26px)",
    fontWeight: "bold",
    letterSpacing: 1,
  },
  headerSub: {
    margin: 0,
    fontSize: "clamp(11px, 2vw, 14px)",
    opacity: 0.8,
    fontFamily: "system-ui, sans-serif",
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    maxWidth: 800,
    width: "100%",
    margin: "0 auto",
    padding: "clamp(12px, 3vw, 24px)",
    gap: 16,
    boxSizing: "border-box",
  },
  systemPromptBox: {
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "12px 16px",
  },
  systemPromptLabel: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "system-ui, sans-serif",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    display: "block",
  },
  systemPromptInput: {
    width: "100%",
    border: "none",
    outline: "none",
    resize: "none",
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
    color: colors.text,
    background: "transparent",
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  chatWindow: {
    flex: 1,
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: 16,
    minHeight: 320,
    maxHeight: 480,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  emptyState: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: colors.muted,
    fontFamily: "system-ui, sans-serif",
    fontSize: 14,
    textAlign: "center",
    padding: 24,
  },
  bubble: (role: "user" | "assistant"): React.CSSProperties => ({
    display: "flex",
    justifyContent: role === "user" ? "flex-end" : "flex-start",
  }),
  bubbleInner: (role: "user" | "assistant"): React.CSSProperties => ({
    maxWidth: "80%",
    padding: "10px 14px",
    borderRadius: role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
    background: role === "user" ? colors.green : colors.greenLight,
    color: role === "user" ? colors.white : colors.text,
    fontFamily: "system-ui, sans-serif",
    fontSize: 14,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  }),
  usageBadge: {
    marginTop: 4,
    fontSize: 11,
    color: colors.muted,
    fontFamily: "system-ui, sans-serif",
    textAlign: "right" as const,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "flex-end",
    background: colors.white,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: "10px 14px",
  },
  textarea: {
    flex: 1,
    border: "none",
    outline: "none",
    resize: "none",
    fontSize: 15,
    fontFamily: "system-ui, sans-serif",
    color: colors.text,
    background: "transparent",
    lineHeight: 1.5,
    minHeight: 24,
    maxHeight: 120,
    overflowY: "auto",
    boxSizing: "border-box",
  },
  sendButton: {
    background: colors.green,
    color: colors.white,
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 14,
    fontFamily: "system-ui, sans-serif",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  },
  sendButtonDisabled: {
    background: colors.muted,
    cursor: "not-allowed",
  },
  modelRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
  modelLabel: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: "system-ui, sans-serif",
  },
  modelSelect: {
    fontSize: 13,
    fontFamily: "system-ui, sans-serif",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "3px 8px",
    background: colors.white,
    color: colors.text,
    outline: "none",
  },
  clearButton: {
    marginLeft: "auto",
    background: "none",
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: "3px 10px",
    fontSize: 12,
    fontFamily: "system-ui, sans-serif",
    color: colors.muted,
    cursor: "pointer",
  },
  errorBox: {
    background: "#fee2e2",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    padding: "10px 14px",
    color: colors.error,
    fontFamily: "system-ui, sans-serif",
    fontSize: 13,
  },
  typingIndicator: {
    display: "flex",
    gap: 4,
    padding: "10px 14px",
    background: colors.greenLight,
    borderRadius: "16px 16px 16px 4px",
    width: "fit-content",
    alignItems: "center",
  },
  dot: (delay: number): React.CSSProperties => ({
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: colors.greenMid,
    animation: "bounce 1.2s infinite",
    animationDelay: `${delay}s`,
  }),
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [lastUsage, setLastUsage] = useState<ApiResponse["usage"] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setError("");
    setLoading(true);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const apiMessages = systemPrompt.trim()
        ? [{ role: "system", content: systemPrompt }, ...newMessages]
        : [...newMessages];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, model }),
      });

      const data: ApiResponse = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.content) {
        setMessages([...newMessages, { role: "assistant", content: data.content }]);
        setLastUsage(data.usage ?? null);
      }
    } catch (e) {
      setError("Failed to reach the server. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; }
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>

      <div style={styles.page}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h1 style={styles.headerTitle}>Seasoning</h1>
            <p style={styles.headerSub}>OpenAI API Interface</p>
          </div>
        </div>

        {/* Main */}
        <div style={styles.main}>
          {/* System prompt */}
          <div style={styles.systemPromptBox}>
            <span style={styles.systemPromptLabel}>System Prompt</span>
            <textarea
              style={styles.systemPromptInput}
              rows={2}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Set the assistant's behaviour..."
            />
          </div>

          {/* Chat window */}
          <div style={styles.chatWindow}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                Start a conversation. Press Enter to send, Shift+Enter for a new line.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} style={styles.bubble(msg.role)}>
                  <div style={styles.bubbleInner(msg.role)}>{msg.content}</div>
                </div>
              ))
            )}

            {loading && (
              <div style={{ display: "flex" }}>
                <div style={styles.typingIndicator}>
                  <div style={styles.dot(0)} />
                  <div style={styles.dot(0.2)} />
                  <div style={styles.dot(0.4)} />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Error */}
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* Token usage */}
          {lastUsage && !error && (
            <div style={styles.usageBadge}>
              {lastUsage.total_tokens} tokens used ({lastUsage.prompt_tokens} prompt + {lastUsage.completion_tokens} completion)
            </div>
          )}

          {/* Model + clear row */}
          <div style={styles.modelRow}>
            <span style={styles.modelLabel}>Model:</span>
            <select
              style={styles.modelSelect}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
              <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            </select>

            <button
              style={styles.clearButton}
              onClick={() => { setMessages([]); setError(""); setLastUsage(null); }}
            >
              Clear chat
            </button>
          </div>

          {/* Input */}
          <div style={styles.inputRow}>
            <textarea
              ref={textareaRef}
              style={styles.textarea}
              rows={1}
              value={input}
              placeholder="Type a message..."
              onChange={(e) => { setInput(e.target.value); autoResize(e.target); }}
              onKeyDown={handleKeyDown}
            />
            <button
              style={{
                ...styles.sendButton,
                ...(loading || !input.trim() ? styles.sendButtonDisabled : {}),
              }}
              onClick={sendMessage}
              disabled={loading || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
