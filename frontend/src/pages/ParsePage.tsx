import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import LoadingSpinner from "../components/LoadingSpinner";
import NotRecipePopup from "../components/NotRecipePopup";
import { colors } from "../theme";
import { parseRecipe, parseRecipeFromImage, parseRecipeFromURL } from "../api/recipes";

type Tab = "text" | "image" | "url";

const TABS: { key: Tab; label: string }[] = [
  { key: "text", label: "Paste Text" },
  { key: "image", label: "Upload Image" },
  { key: "url", label: "Website URL" },
];

export default function ParsePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<Tab>("text");
  const [rawText, setRawText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [error, setError] = useState("");
  const [showNotRecipe, setShowNotRecipe] = useState(false);
  const [showUrlFallback, setShowUrlFallback] = useState(false);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const added = Array.from(newFiles).filter(f => f.type.startsWith("image/"));
    setFiles(prev => [...prev, ...added].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    (activeTab === "text" && rawText.trim().length > 0) ||
    (activeTab === "image" && files.length > 0) ||
    (activeTab === "url" && url.trim().length > 0);

  async function handleParse() {
    if (!canSubmit) return;
    setError("");
    setLoading(true);

    try {
      let recipe;

      if (activeTab === "text") {
        setLoadingLabel("Parsing recipe with AI...");
        recipe = await parseRecipe(rawText);
      } else if (activeTab === "image") {
        setLoadingLabel("Extracting recipe from image...");
        recipe = await parseRecipeFromImage(files);
      } else {
        setLoadingLabel("Fetching recipe from website...");
        recipe = await parseRecipeFromURL(url);
      }

      navigate(`/recipes/${recipe.id}`);
    } catch (e: any) {
      if (e.message === "not_a_recipe") {
        setShowNotRecipe(true);
      } else if (e.message === "url_timeout" || e.message === "url_unreachable") {
        setShowUrlFallback(true);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  return (
    <div style={{ minHeight: "100vh", background: colors.cream, display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{ maxWidth: 720, width: "100%", margin: "0 auto", padding: "clamp(16px, 4vw, 40px)", flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: "clamp(18px, 3.5vw, 24px)", marginBottom: 6 }}>
            Add a Recipe
          </h2>
          <p style={{ color: colors.muted, fontSize: 14, fontFamily: "system-ui, sans-serif" }}>
            Paste text, upload a photo, or grab one from a website.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.border}` }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setError(""); }}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${colors.green}` : "2px solid transparent",
                padding: "10px 20px",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? colors.green : colors.muted,
                cursor: "pointer",
                marginBottom: -2,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{
          background: colors.white,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 4,
          flex: 1,
          minHeight: 300,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* TEXT TAB */}
          {activeTab === "text" && (
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={loading}
              placeholder={`Paste your recipe here...\n\nExample:\nChocolate Chip Cookies\nMakes 24 cookies\n\nIngredients:\n2 cups all-purpose flour\n1 tsp baking soda\n...`}
              style={{
                width: "100%",
                flex: 1,
                minHeight: 300,
                padding: 16,
                border: "none",
                outline: "none",
                resize: "vertical",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                lineHeight: 1.7,
                color: colors.text,
                background: "transparent",
                boxSizing: "border-box",
              }}
            />
          )}

          {/* IMAGE TAB */}
          {activeTab === "image" && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                style={{
                  border: `2px dashed ${colors.border}`,
                  borderRadius: 10,
                  padding: "40px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                  flex: files.length === 0 ? 1 : undefined,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = colors.green)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = colors.border)}
              >
                <div style={{ fontSize: 32 }}>📷</div>
                <p style={{ fontSize: 14, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
                  Drag photos here or click to browse
                </p>
                <p style={{ fontSize: 12, color: colors.muted, fontFamily: "system-ui, sans-serif" }}>
                  Up to 5 images (JPEG, PNG, WebP)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={e => addFiles(e.target.files)}
              />

              {files.length > 0 && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ position: "relative", width: 80, height: 80 }}>
                      <img
                        src={URL.createObjectURL(f)}
                        alt={f.name}
                        style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: `1px solid ${colors.border}` }}
                      />
                      <button
                        onClick={() => removeFile(i)}
                        style={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: colors.error,
                          color: colors.white,
                          border: "none",
                          fontSize: 12,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* URL TAB */}
          {activeTab === "url" && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
              <label style={{ fontSize: 13, color: colors.text, fontFamily: "system-ui, sans-serif", fontWeight: 500 }}>
                Recipe URL
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                disabled={loading}
                placeholder="https://www.bbcgoodfood.com/recipes/chilli-con-carne-recipe"
                style={{
                  padding: "12px 14px",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 15,
                  fontFamily: "system-ui, sans-serif",
                  outline: "none",
                  color: colors.text,
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 13, color: colors.muted, fontFamily: "system-ui, sans-serif", lineHeight: 1.5 }}>
                Paste a link to any recipe page. We'll extract the ingredients and method automatically.
              </p>
            </div>
          )}
        </div>

        {error && (
          <div style={{ background: colors.errorBg, border: `1px solid ${colors.errorBorder}`, borderRadius: 8, padding: "12px 16px", color: colors.error, fontSize: 13, fontFamily: "system-ui, sans-serif" }}>
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSpinner label={loadingLabel} />
        ) : (
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "none",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "10px 20px",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                color: colors.muted,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleParse}
              disabled={!canSubmit}
              style={{
                background: canSubmit ? colors.green : colors.muted,
                color: colors.white,
                border: "none",
                borderRadius: 8,
                padding: "10px 28px",
                fontSize: 14,
                fontFamily: "system-ui, sans-serif",
                fontWeight: 600,
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              {activeTab === "url" ? "Fetch Recipe" : "Parse Recipe"}
            </button>
          </div>
        )}
      </div>

      {showNotRecipe && (
        <NotRecipePopup
          onClose={() => setShowNotRecipe(false)}
          onSwitchToText={() => { setShowNotRecipe(false); setActiveTab("text"); }}
        />
      )}

      {showUrlFallback && (
        <div
          onClick={() => setShowUrlFallback(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: colors.white, borderRadius: 12, padding: "32px 28px",
              maxWidth: 420, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              textAlign: "center", fontFamily: "system-ui, sans-serif",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 16 }}>🌐</div>
            <h3 style={{ fontFamily: "Georgia, serif", color: colors.text, fontSize: 18, marginBottom: 12 }}>
              Couldn't reach that website
            </h3>
            <p style={{ color: colors.muted, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              The site may block scrapers or be temporarily unavailable. Try one of these instead:
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                onClick={() => { setShowUrlFallback(false); setActiveTab("text"); }}
                style={{
                  background: colors.green, color: colors.white, border: "none",
                  borderRadius: 8, padding: "10px 18px", fontSize: 14,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Paste text instead
              </button>
              <button
                onClick={() => { setShowUrlFallback(false); setActiveTab("image"); }}
                style={{
                  background: "none", border: `1px solid ${colors.border}`,
                  borderRadius: 8, padding: "10px 18px", fontSize: 14,
                  color: colors.text, cursor: "pointer",
                }}
              >
                Upload screenshot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
