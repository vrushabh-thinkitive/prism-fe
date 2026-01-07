import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";
import App from "./App.tsx";

// Get Auth0 configuration from environment variables
const domain = import.meta.env.VITE_AUTH0_DOMAIN;
const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
const audience = import.meta.env.VITE_AUTH0_AUDIENCE;
const scope = import.meta.env.VITE_AUTH0_SCOPE || "openid profile email";
console.log("domain", domain);
console.log("clientId", clientId);
console.log("audience", audience);
console.log("scope", scope);
// Validate required environment variables
if (!domain || !clientId) {
  console.error(
    "Missing Auth0 configuration. Please set VITE_AUTH0_DOMAIN and VITE_AUTH0_CLIENT_ID in your .env file"
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={domain || ""}
      clientId={clientId || ""}
      authorizationParams={{
        redirect_uri: window.location.origin + "/auth/callback",
        audience: audience,
        scope: scope,
      }}
      // Cache tokens in memory (more secure than localStorage)
      cacheLocation="memory"
      // Use refresh tokens for better UX
      useRefreshTokens={true}
    >
      <App />
    </Auth0Provider>
  </StrictMode>
);
