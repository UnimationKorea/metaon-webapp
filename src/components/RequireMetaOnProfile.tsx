import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function RequireMetaOnProfile({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isAccountAuthenticated, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="hub-route-loading" role="status">세션을 확인하고 있습니다.</div>;
  }

  if (isAuthenticated) return <>{children}</>;

  const returnTo = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate replace state={{ returnTo }} to={isAccountAuthenticated ? "/profiles" : "/login"} />;
}
