import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { installApiConsoleTrace } from "./services/apiConsoleTrace";
import { registerBookMediaServiceWorker } from "./services/videoMediaCache";
import "./styles.css";
import "./styles-hub.css";

registerBookMediaServiceWorker();
installApiConsoleTrace();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
