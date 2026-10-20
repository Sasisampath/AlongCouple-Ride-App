import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AlongApp from "../app/page";
import { PwaRuntime } from "../app/components/pwa-runtime";
import "../app/globals.css";
import "../app/design-system.css";

const root = document.getElementById("root");

if (!root) throw new Error("Along could not find its application root.");

createRoot(root).render(
  <StrictMode>
    <PwaRuntime />
    <AlongApp />
  </StrictMode>,
);
