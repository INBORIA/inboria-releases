import { createRoot } from "react-dom/client";
import "@/i18n";
import App from "./App";
import "./index.css";
import { isPaymentsEnabled } from "@/lib/feature-flags";
import { ErrorBoundary } from "@/components/error-boundary";

if (isPaymentsEnabled() && typeof document !== "undefined") {
  const script = document.createElement("script");
  script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
  script.async = true;
  document.head.appendChild(script);
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
