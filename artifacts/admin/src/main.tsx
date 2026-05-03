import { createRoot } from "react-dom/client";
import { BRAND } from "@workspace/branding";
import App from "./App";
import "./index.css";

document.title = `${BRAND.name} · Admin`;

createRoot(document.getElementById("root")!).render(<App />);
