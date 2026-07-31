import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { AppLoadingScreen } from "./AppLoadingScreen";
import { useAuth } from "../hooks/useAuth";

export function RequireMetaOnProfile({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAccountAuthenticated, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AppLoadingScreen />;
  }

  if (isAuthenticated) return <>{children}</>;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate replace state={{ returnTo }} to={isAccountAuthenticated ? "/profiles" : "/login"} />;
}
