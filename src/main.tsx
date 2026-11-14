import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./ui";
import "./app.css";
import App from "./App";
import { Overlay } from "./Overlay";

// Hızlı seçim penceresi aynı sayfayı `?view=overlay` ile yükler.
const isOverlay = new URLSearchParams(window.location.search).get("view") === "overlay";
if (isOverlay) document.documentElement.classList.add("is-overlay");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{isOverlay ? <Overlay /> : <App />}</StrictMode>,
);
