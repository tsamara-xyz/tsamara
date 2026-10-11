import { Buffer } from "buffer";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// @solana/web3.js and spl-token use Node's Buffer.
globalThis.Buffer = Buffer;

const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
