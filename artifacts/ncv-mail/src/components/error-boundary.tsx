import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleClearStorage = (): void => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e1a",
          color: "#e5e7eb",
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12, color: "#3b82f6" }}>
            Inboria
          </h1>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>
            Une erreur a interrompu le chargement
          </h2>
          <p style={{ fontSize: 14, color: "#9ca3af", marginBottom: 20 }}>
            Cela peut être temporaire (incident d'hébergement, connexion
            instable). Essayez de recharger. Si l'erreur persiste, videz le
            cache local.
          </p>
          {this.state.error?.message && (
            <pre
              style={{
                background: "#111827",
                padding: 12,
                borderRadius: 6,
                fontSize: 11,
                textAlign: "left",
                overflow: "auto",
                maxHeight: 160,
                marginBottom: 20,
                color: "#f87171",
              }}
            >
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button
              onClick={this.handleReload}
              style={{
                background: "#3b82f6",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Recharger
            </button>
            <button
              onClick={this.handleClearStorage}
              style={{
                background: "transparent",
                color: "#e5e7eb",
                border: "1px solid #374151",
                padding: "10px 20px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Vider le cache et recharger
            </button>
          </div>
        </div>
      </div>
    );
  }
}
