import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Optional descriptive label shown in the fallback (e.g. "Admin", "App"). */
  scope?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Architecture audit (May 2026) — top-level safety net.
 *
 * React unmounts the entire tree on an uncaught render error, which on the
 * marketplace looks like a blank white screen with no recovery. ErrorBoundary
 * catches the error, logs it (so it shows up in the browser console + the
 * Replit dev banner) and renders a small recovery UI with a Reload button.
 *
 * Wrap once at the app shell to catch every page, and again around the
 * heavier admin tree so an admin-only crash doesn't tank the public site.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", this.props.scope ?? "root", error, info);
  }

  private handleReload = () => {
    this.setState({ error: null });
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
            padding: "2rem",
            textAlign: "center",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ maxWidth: 480, color: "#475569" }}>
            {this.props.scope
              ? `An error occurred in ${this.props.scope}. The rest of Khidma is still available.`
              : "An unexpected error occurred. Reload the page to try again."}
          </p>
          {process.env.NODE_ENV !== "production" && (
            <pre
              style={{
                maxWidth: 720,
                overflow: "auto",
                fontSize: "0.75rem",
                background: "#f1f5f9",
                padding: "0.75rem",
                borderRadius: 6,
                textAlign: "left",
              }}
            >
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 6,
              background: "#0f172a",
              color: "white",
              border: "none",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
