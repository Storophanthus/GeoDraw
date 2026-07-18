import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installDesktopShellGuards } from "./ui/desktopShellGuards";
import "./App.css";
import "katex/dist/katex.min.css";

installDesktopShellGuards();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
