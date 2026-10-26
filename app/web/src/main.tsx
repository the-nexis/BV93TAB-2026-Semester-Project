import React from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import App from "./App";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";

// Anchor Core's browser bundle still expects Buffer to exist globally.
globalThis.Buffer ??= Buffer;

const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || "http://127.0.0.1:8899";
const wallets = [new PhantomWalletAdapter()];
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ConnectionProvider endpoint={endpoint}><WalletProvider wallets={wallets} autoConnect><WalletModalProvider><App endpoint={endpoint}/></WalletModalProvider></WalletProvider></ConnectionProvider></React.StrictMode>
);
