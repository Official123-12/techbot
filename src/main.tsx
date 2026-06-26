import { StrictMode, Component } from "react";
  import type { ReactNode, ErrorInfo } from "react";
  import { createRoot } from "react-dom/client";
  import "./index.css";
  import App from "./App";

  const ACCENT_HSL: Record<string, string> = {
    violet: "262 83% 58%",
    red:    "0 72% 51%",
    blue:   "217 91% 60%",
    green:  "142 71% 45%",
    orange: "25 95% 53%",
  };

  (function initThemeAndAccent() {
    const theme = localStorage.getItem("theme") || "dark";
    document.documentElement.classList.add(theme);

    const accent = localStorage.getItem("accent") || "violet";
    const hsl = ACCENT_HSL[accent] || ACCENT_HSL["violet"];
    const style = document.createElement("style");
    style.id = "__accent_override__";
    style.textContent = `:root, .dark { --primary: ${hsl}; --ring: ${hsl}; }`;
    document.head.appendChild(style);
  })();

  class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
    constructor(props: { children: ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
      return { hasError: true };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    render() {
      if (this.state.hasError) {
        return (
          <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
            <div style={{ textAlign: "center", maxWidth: "20rem" }}>
              <div style={{ width: "3.5rem", height: "3.5rem", borderRadius: "50%", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(239,68,68)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.5rem" }}>Something went wrong</h2>
              <p style={{ fontSize: "0.875rem", opacity: 0.6, marginBottom: "1.25rem" }}>An unexpected error occurred. Try reloading the page.</p>
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center" }}>
                <button onClick={() => window.location.reload()} style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "0.875rem" }}>
                  Reload
                </button>
                <button onClick={() => { window.location.href = "/dashboard"; }} style={{ padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600 }}>
                  Go to Dashboard
                </button>
              </div>
            </div>
          </div>
        );
      }
      return this.props.children;
    }
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
  