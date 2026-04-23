import { Link } from "react-router-dom";
import { colors, fonts } from "../theme";
import Wordmark from "../components/Wordmark";
import SaltShakerLogo from "../components/SaltShakerLogo";

const FAQS = [
  {
    q: "What is Seasoning?",
    a: "Seasoning is a simple recipe book. You save recipes you cook, and it helps you adjust them, scale them, and cook what's in season.",
  },
  {
    q: "Is it free?",
    a: "Yes. The core features are free while we're in early access.",
  },
  {
    q: "How do I add a recipe?",
    a: "Paste the text, upload a photo of a cookbook or handwritten card, or drop in a URL from any recipe website. Seasoning parses it into a clean ingredients list and method.",
  },
  {
    q: "Can it make a recipe cheaper or vegetarian?",
    a: "Yes. One tap swaps a recipe to a cheaper version or a vegetarian version, without you having to rewrite anything.",
  },
  {
    q: "Can I share recipes with friends?",
    a: "Yes. Add a friend by email and you'll each see what the other has in their recipe book.",
  },
  {
    q: "Does it work on my phone?",
    a: "Yes. Seasoning is a web app and works in any modern browser on desktop, tablet, and phone.",
  },
];

export default function LandingPage() {
  return (
    <>
      {/* FAQ structured data for search engines and chatbots */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map(({ q, a }) => ({
              "@type": "Question",
              name: q,
              acceptedAnswer: { "@type": "Answer", text: a },
            })),
          }),
        }}
      />

      <div style={{ background: colors.warm, color: colors.text, fontFamily: fonts.sans }}>
        <LandingHeader />
        <Hero />
        <WhatIs />
        <Features />
        <HowItWorks />
        <FAQ />
        <FinalCTA />
        <Footer />
      </div>
    </>
  );
}

/* ─── Header ──────────────────────────────────────────────────────────────── */

function LandingHeader() {
  return (
    <header
      style={{
        background: colors.green,
        color: colors.white,
        padding: "14px clamp(16px, 5vw, 40px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <Link to="/" style={{ textDecoration: "none" }}>
        <Wordmark layout="inline" iconSize={32} wordSize={24} variant="light" />
      </Link>
      <nav style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Link
          to="/login"
          style={{
            color: colors.white,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 500,
            padding: "8px 14px",
            borderRadius: 8,
          }}
        >
          Log in
        </Link>
        <Link
          to="/signup"
          style={{
            background: colors.white,
            color: colors.green,
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 8,
          }}
        >
          Sign up
        </Link>
      </nav>
    </header>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section
      style={{
        background: colors.green,
        color: colors.white,
        padding: "clamp(48px, 9vw, 96px) clamp(20px, 6vw, 48px) clamp(64px, 10vw, 120px)",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr", gap: 48, alignItems: "center" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 32 }} className="hero-grid">
          <div>
            <p style={{ fontFamily: fonts.script, fontSize: "clamp(24px, 3.5vw, 34px)", color: colors.greenLight, margin: 0 }}>
              A pinch of you
            </p>
            <h1
              style={{
                fontFamily: fonts.display,
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: "clamp(44px, 7vw, 84px)",
                lineHeight: 1.05,
                margin: "8px 0 20px",
                letterSpacing: "-0.01em",
                fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 144',
              }}
            >
              Your recipes,<br />seasoned just right.
            </h1>
            <p style={{ fontSize: "clamp(16px, 1.5vw, 19px)", lineHeight: 1.5, maxWidth: 540, margin: 0, opacity: 0.95 }}>
              A simple recipe book for everything you cook. Save from text, a photo,
              or a URL. Adjust portions, make it cheaper, swap to veggie, and cook
              what's in season.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 28 }}>
              <Link
                to="/signup"
                style={{
                  background: colors.white,
                  color: colors.green,
                  textDecoration: "none",
                  padding: "14px 22px",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                Get started, free
              </Link>
              <Link
                to="/login"
                style={{
                  background: "transparent",
                  color: colors.white,
                  textDecoration: "none",
                  padding: "14px 22px",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                  border: `1.5px solid rgba(255,255,255,0.6)`,
                }}
              >
                Log in
              </Link>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "min(360px, 80vw)",
                aspectRatio: "1 / 1",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SaltShakerLogo size={220} color={colors.white} strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 880px) {
          .hero-grid { grid-template-columns: 1.1fr 0.9fr !important; gap: 48px !important; }
        }
      `}</style>
    </section>
  );
}

/* ─── What is ─────────────────────────────────────────────────────────────── */

function WhatIs() {
  return (
    <section style={{ padding: "clamp(56px, 8vw, 96px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
        <SectionEyebrow>About</SectionEyebrow>
        <h2 style={sectionTitleStyle}>What is Seasoning?</h2>
        <p style={{ fontSize: "clamp(16px, 1.6vw, 19px)", lineHeight: 1.6, color: colors.textSoft, marginTop: 16 }}>
          Seasoning is a recipe book that keeps up with how you actually cook.
          Save anything, from a photo of a scribbled card to a URL from a blog.
          Then make the recipe yours: resize the portions, swap to vegetarian,
          or lean on cheaper ingredients. Cook what's in season, share with
          friends, and keep the recipes you love in one place.
        </p>
      </div>
    </section>
  );
}

/* ─── Features ────────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    title: "Save any recipe",
    body: "Paste text, upload a photo, or drop in a URL. Seasoning parses it into a clean ingredients list and method.",
  },
  {
    title: "Adjust to suit you",
    body: "Scale portions, switch to a vegetarian version, or rework the recipe with cheaper ingredients in one tap.",
  },
  {
    title: "Cook in season",
    body: "See what's at its best right now and get recipe ideas that use it, so you eat better without thinking about it.",
  },
  {
    title: "Share with friends",
    body: "Add a friend and both see each other's recipe books. Cook what they cook, and share what you love back.",
  },
];

function Features() {
  return (
    <section style={{ background: colors.cream, padding: "clamp(64px, 9vw, 112px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <SectionEyebrow>Features</SectionEyebrow>
          <h2 style={sectionTitleStyle}>Everything you need, nothing you don't.</h2>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map(f => (
            <article
              key={f.title}
              style={{
                background: colors.white,
                borderRadius: 14,
                padding: "24px 22px",
                border: `1px solid ${colors.borderSoft}`,
              }}
            >
              <h3 style={{ fontFamily: fonts.serif, fontSize: 22, margin: 0, color: colors.text, fontStyle: "italic", fontWeight: 600 }}>
                {f.title}
              </h3>
              <p style={{ margin: "10px 0 0", color: colors.textSoft, lineHeight: 1.55, fontSize: 15 }}>
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────────────────── */

const STEPS = [
  { n: "01", title: "Create a free account", body: "An email and password is all you need to get started." },
  { n: "02", title: "Add your recipes",       body: "Paste text, snap a photo, or drop in a link. They're parsed into a clean format." },
  { n: "03", title: "Cook it your way",       body: "Scale servings, swap ingredients, or build a shopping basket before you go." },
];

function HowItWorks() {
  return (
    <section style={{ padding: "clamp(64px, 9vw, 112px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <SectionEyebrow>How it works</SectionEyebrow>
          <h2 style={sectionTitleStyle}>From recipe to plate in three steps.</h2>
        </div>
        <ol style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {STEPS.map(s => (
            <li key={s.n} style={{ background: colors.warm, border: `1px solid ${colors.borderSoft}`, borderRadius: 14, padding: "26px 22px" }}>
              <div style={{ fontFamily: fonts.display, fontStyle: "italic", color: colors.green, fontSize: 28, fontWeight: 600 }}>{s.n}</div>
              <h3 style={{ fontFamily: fonts.serif, fontSize: 20, margin: "6px 0 8px", fontStyle: "italic", fontWeight: 600 }}>{s.title}</h3>
              <p style={{ margin: 0, color: colors.textSoft, lineHeight: 1.55, fontSize: 15 }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ─── FAQ ─────────────────────────────────────────────────────────────────── */

function FAQ() {
  return (
    <section style={{ background: colors.cream, padding: "clamp(64px, 9vw, 112px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <SectionEyebrow>Questions</SectionEyebrow>
          <h2 style={sectionTitleStyle}>Frequently asked.</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQS.map(({ q, a }) => (
            <details
              key={q}
              style={{
                background: colors.white,
                border: `1px solid ${colors.borderSoft}`,
                borderRadius: 12,
                padding: "14px 18px",
              }}
            >
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 16, color: colors.text, listStyle: "none" }}>
                {q}
              </summary>
              <p style={{ margin: "10px 0 0", color: colors.textSoft, lineHeight: 1.6, fontSize: 15 }}>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Final CTA ───────────────────────────────────────────────────────────── */

function FinalCTA() {
  return (
    <section style={{ background: colors.green, color: colors.white, padding: "clamp(56px, 8vw, 96px) clamp(20px, 6vw, 48px)" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h2
          style={{
            fontFamily: fonts.display,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "clamp(32px, 5vw, 54px)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          Start your recipe book.
        </h2>
        <p style={{ marginTop: 12, fontSize: "clamp(15px, 1.4vw, 18px)", opacity: 0.95 }}>
          Free to sign up. No credit card. No faff.
        </p>
        <div style={{ marginTop: 24 }}>
          <Link
            to="/signup"
            style={{
              display: "inline-block",
              background: colors.white,
              color: colors.green,
              textDecoration: "none",
              padding: "14px 28px",
              borderRadius: 10,
              fontSize: 16,
              fontWeight: 600,
            }}
          >
            Get started
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */

function Footer() {
  return (
    <footer
      style={{
        background: colors.text,
        color: colors.greenLight,
        padding: "28px clamp(20px, 6vw, 48px)",
        fontSize: 14,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <Wordmark layout="inline" iconSize={24} wordSize={18} variant="light" />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link to="/login" style={{ color: colors.greenLight, textDecoration: "none" }}>Log in</Link>
          <Link to="/signup" style={{ color: colors.greenLight, textDecoration: "none" }}>Sign up</Link>
        </div>
        <div style={{ opacity: 0.7 }}>© {new Date().getFullYear()} Seasoning</div>
      </div>
    </footer>
  );
}

/* ─── Shared bits ─────────────────────────────────────────────────────────── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: fonts.script, color: colors.green, fontSize: 22, marginBottom: 4 }}>
      {children}
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: fonts.display,
  fontStyle: "italic",
  fontWeight: 600,
  fontSize: "clamp(28px, 4vw, 44px)",
  color: colors.text,
  letterSpacing: "-0.01em",
  margin: 0,
};
