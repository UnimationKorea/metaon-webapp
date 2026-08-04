import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bell, LogIn, LogOut, Search, UserRound, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useHubState } from "../hooks/useHubState";

export function MetaOnHubShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { account, isAccountAuthenticated, isAuthenticated, logout, releaseProfile, user: authUser } = useAuth();
  const { unreadCount, user: hubUser } = useHubState();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [topSearch, setTopSearch] = useState("");
  const [isHomeTopBarVisible, setIsHomeTopBarVisible] = useState(false);
  const homeTopBarTimerRef = useRef<number | null>(null);
  const isActivityRoute = location.pathname.startsWith("/activity/") || location.pathname.startsWith("/activity-preview/");
  const isExternalFrameRoute = location.pathname === "/ai-session" || location.pathname === "/metaverse-world";
  const isHomeRoute = location.pathname === "/";
  const isLoginRoute = location.pathname === "/login";
  const isProfileManageRoute = location.pathname === "/profiles/manage";
  const displayName = authUser?.username || account?.username || hubUser.name;
  const displayAvatar = getInitials(displayName || hubUser.avatar);

  useEffect(() => {
    if (homeTopBarTimerRef.current !== null) {
      window.clearTimeout(homeTopBarTimerRef.current);
      homeTopBarTimerRef.current = null;
    }

    if (!isHomeRoute) {
      setIsHomeTopBarVisible(false);
      return undefined;
    }

    const showTopBarTemporarily = () => {
      setIsHomeTopBarVisible(true);
      if (homeTopBarTimerRef.current !== null) {
        window.clearTimeout(homeTopBarTimerRef.current);
      }
      homeTopBarTimerRef.current = window.setTimeout(() => {
        setIsHomeTopBarVisible(false);
        homeTopBarTimerRef.current = null;
      }, 1600);
    };

    window.addEventListener("scroll", showTopBarTemporarily, { passive: true });
    window.addEventListener("wheel", showTopBarTemporarily, { passive: true });
    window.addEventListener("touchmove", showTopBarTemporarily, { passive: true });

    return () => {
      window.removeEventListener("scroll", showTopBarTemporarily);
      window.removeEventListener("wheel", showTopBarTemporarily);
      window.removeEventListener("touchmove", showTopBarTemporarily);
      if (homeTopBarTimerRef.current !== null) {
        window.clearTimeout(homeTopBarTimerRef.current);
        homeTopBarTimerRef.current = null;
      }
    };
  }, [isHomeRoute]);

  // The top bar is global, so its search hands off to the Study Zone, which owns the book index
  // and the search overlay UI.
  function submitTopSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = topSearch.trim();
    if (!trimmed) return;
    navigate(`/study?q=${encodeURIComponent(trimmed)}`);
    setTopSearch("");
  }

  async function logoutAndGo(path = "/login") {
    setIsAccountMenuOpen(false);
    await logout();
    navigate(path);
  }

  async function changeProfile() {
    setIsAccountMenuOpen(false);
    try {
      await releaseProfile();
    } finally {
      navigate("/profiles");
    }
  }

  if (isActivityRoute) {
    return (
      <div className="viewport activity-viewport">
        <div className="stage-shell activity-stage" aria-label="MetaOn activity runtime">
          <main className="app-surface">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  if (isExternalFrameRoute) {
    return (
      <div className="viewport external-viewport">
        <main className="external-stage" aria-label="MetaOn external experience runtime">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className={`metaon-hub-shell${isHomeRoute ? " is-home-route" : ""}${isLoginRoute ? " is-login-route" : ""}${isProfileManageRoute ? " is-profile-manage-route" : ""}`}>
      <div className="hub-main-column">
        <header
          className={`hub-top-bar${isHomeRoute ? " hub-home-top-bar" : ""}${
            isHomeRoute && (isHomeTopBarVisible || isAccountMenuOpen) ? " is-visible" : ""
          }`}
        >
          <form className="hub-search-box" role="search" onSubmit={submitTopSearch}>
            <Search size={18} strokeWidth={2.2} />
            <input
              aria-label="Book 검색"
              placeholder="Book 검색 후 Enter"
              type="search"
              value={topSearch}
              onChange={(event) => setTopSearch(event.target.value)}
            />
          </form>

          <button className="hub-icon-button hub-notification-button" type="button" onClick={() => navigate("/notifications")}>
            <Bell size={19} strokeWidth={2.2} />
            {unreadCount > 0 ? <span className="hub-notification-dot">{unreadCount}</span> : null}
          </button>

          {isAuthenticated ? (
            <div className="hub-account-menu">
              <button
                className="hub-profile-chip"
                type="button"
                onClick={() => setIsAccountMenuOpen((open) => !open)}
                aria-expanded={isAccountMenuOpen}
                aria-haspopup="menu"
              >
                <span className="hub-avatar-mini">{displayAvatar}</span>
                <span>
                  <strong>{displayName}</strong>
                  <small>{hubUser.entitlementStatus === "granted" ? "학습권 활성" : "권한 확인 필요"}</small>
                </span>
              </button>

              {isAccountMenuOpen ? (
                <div className="hub-account-dropdown" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      navigate("/profile");
                    }}
                  >
                    <UserRound size={17} />
                    <span>프로필 보기</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void changeProfile()}>
                    <UsersRound size={17} />
                    <span>프로필 전환</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void logoutAndGo("/")}>
                    <LogOut size={17} />
                    <span>로그아웃</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void logoutAndGo("/login")}>
                    <LogIn size={17} />
                    <span>다시 로그인</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : isAccountAuthenticated ? (
            <NavLink className="hub-profile-chip" to="/profiles">
              <UsersRound size={18} />
              <span>
                <strong>프로필 선택</strong>
                <small>{account?.username || "학습자 선택"}</small>
              </span>
            </NavLink>
          ) : (
            <NavLink className="hub-profile-chip" to="/login">
              <LogIn size={18} />
              <span>
                <strong>로그인</strong>
                <small>MetaOn 계정 연결</small>
              </span>
            </NavLink>
          )}
        </header>

        <main className="hub-app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getInitials(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "MO";
  const initials = normalized
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return initials || normalized.slice(0, 2).toUpperCase();
}
