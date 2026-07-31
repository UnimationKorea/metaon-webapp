import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { registerVideoMediaServiceWorker } from "./services/videoMediaCache";
import "./styles.css";
import "./styles-hub.css";

registerVideoMediaServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
