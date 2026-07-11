import { BookOpen, LogIn, LogOut, UserRound } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { unityBrandAssets, unityMenuAssets } from "../services/unityAppAssets";

export function StageShell() {
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuth();
  const isActivityRoute = location.pathname.startsWith("/activity/");

  return (
    <div className={isActivityRoute ? "viewport activity-viewport" : "viewport"}>
      <div className={isActivityRoute ? "stage-shell activity-stage" : "stage-shell"} aria-label="MetaOn web application">
        <header className="app-topbar">
          <Link className="brand" to="/">
            <span className="brand-mark">
              <img src={unityBrandAssets.appIcon} alt="" />
            </span>
            <span>
              <strong>MetaOn</strong>
              <small>Web Native</small>
            </span>
          </Link>
          <nav>
            <Link to="/">
              <img className="unity-menu-icon" src={unityMenuAssets.home} alt="" />
              Home
            </Link>
            <Link to="/catalog">
              <img className="unity-menu-icon" src={unityMenuAssets.myBooks} alt="" />
              Books
            </Link>
            <a href="/api/health" target="_blank" rel="noreferrer">
              <img className="unity-menu-icon" src={unityMenuAssets.download} alt="" />
              BFF
            </a>
            <button type="button" onClick={() => window.location.reload()}>
              <img className="unity-menu-icon" src={unityMenuAssets.option} alt="" />
              Reload
            </button>
            {isAuthenticated ? (
              <button className="auth-nav-button" type="button" onClick={() => void logout()}>
                <UserRound size={16} />
                <span>{user?.username || `User ${user?.userIdx}`}</span>
                <LogOut size={15} />
              </button>
            ) : (
              <Link to="/login">
                <LogIn size={16} />
                Login
              </Link>
            )}
          </nav>
        </header>
        <main className="app-surface">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>1280 x 720 Unity landscape baseline</span>
          <span>
            <BookOpen size={14} /> React/Vite front end with same-origin API proxy
          </span>
        </footer>
      </div>
    </div>
  );
}
