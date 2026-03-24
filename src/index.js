import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "./components/ui/toaster";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {
  GlobalErrorBoundary,
  GlobalNetworkGuard,
} from "./components/ui/resilience";

const root = ReactDOM.createRoot(document.getElementById("root"));
const queryClient = new QueryClient();
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <GlobalErrorBoundary>
            <GlobalNetworkGuard>
              <App />
              <Toaster />
            </GlobalNetworkGuard>
          </GlobalErrorBoundary>
        </AuthProvider>
        <ReactQueryDevtools />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
