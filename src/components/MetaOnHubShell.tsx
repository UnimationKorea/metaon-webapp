import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BookOpen, ChevronDown, ChevronRight, Home, LogIn, LogOut, Map, Menu, MessageCircle, Search, Settings, UserRound, X } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { getBrandGroups, getSeriesBooks } from "../services/hubCatalog";
import type { BookCatalog, BrandData, SeriesData, SeriesGroup } from "../types/metaonTypes";

const navItems = [
  { label: "홈", path: "/", match: ["/", "/placement"], icon: Home, tone: "home" },
  { label: "스터디존", path: "/study", match: ["/study", "/catalog", "/books"], icon: BookOpen, tone: "study" },
  { label: "AI Speaking", path: "/ai-session", match: ["/ai-chat", "/ai-session", "/chat-history"], icon: MessageCircle, tone: "ai" },
  { label: "메타버스", path: "/metaverse-world", match: ["/metaverse", "/metaverse-world"], icon: Map, tone: "meta" },
  { label: "프로필", path: "/profile", match: ["/profile", "/progress", "/institution"], icon: UserRound, tone: "profile" }
];

export function MetaOnHubShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, logout, user: authUser } = useAuth();
  const { catalog } = useCatalog();
  const { unreadCount, user: hubUser } = useHubState();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isStudyMenuOpen, setIsStudyMenuOpen] = useState(false);
  const [expandedGradeId, setExpandedGradeId] = useState<number>();
  const [isHomeTopBarVisible, setIsHomeTopBarVisible] = useState(false);
  const homeTopBarTimerRef = useRef<number | null>(null);
  const studyMenuRouteOpenRef = useRef("");
  const isActivityRoute = location.pathname.startsWith("/activity/") || location.pathname.startsWith("/activity-preview/");
  const isExternalFrameRoute = location.pathname === "/ai-session" || location.pathname === "/metaverse-world";
  const isHomeRoute = location.pathname === "/";
  const isStudySideNavRoute = location.pathname === "/study" || location.pathname === "/catalog";
  const displayName = authUser?.username || authUser?.userId || hubUser.name;
  const displayAvatar = getInitials(displayName || hubUser.avatar);
  const studyNavBrand = useMemo(() => selectStudyNavBrand(catalog), [catalog]);
  const studyNavGroups = useMemo(() => getBrandGroups(studyNavBrand), [studyNavBrand]);
  const selectedGroupId = numberParam(searchParams.get("group"));
  const selectedSeriesIdx = numberParam(searchParams.get("series"));
  const visibleExpandedGradeId = expandedGradeId || selectedGroupId || studyNavGroups[0]?.groupId;
  const shouldOpenStudyMenuFromRoute = isStudySideNavRoute && searchParams.get("menu") === "1";

  useEffect(() => {
    setIsStudyMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const routeKey = `${location.pathname}?${location.search}`;
    if (!shouldOpenStudyMenuFromRoute || studyMenuRouteOpenRef.current === routeKey) return;
    studyMenuRouteOpenRef.current = routeKey;
    setIsStudyMenuOpen(true);
  }, [location.pathname, location.search, shouldOpenStudyMenuFromRoute]);

  useEffect(() => {
    if (!isStudyMenuOpen) return undefined;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsStudyMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isStudyMenuOpen]);

  useEffect(() => {
    if (!isStudySideNavRoute) {
      setExpandedGradeId(undefined);
      return;
    }

    if (selectedGroupId && studyNavGroups.some((group) => group.groupId === selectedGroupId)) {
      setExpandedGradeId(selectedGroupId);
      return;
    }

    if (!expandedGradeId && studyNavGroups[0]) {
      setExpandedGradeId(studyNavGroups[0].groupId);
    }
  }, [expandedGradeId, isStudySideNavRoute, selectedGroupId, studyNavGroups]);

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

  async function logoutAndGo(path = "/login") {
    setIsAccountMenuOpen(false);
    await logout();
    navigate(path);
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
    <div className={`metaon-hub-shell${isHomeRoute ? " is-home-route" : ""}${isStudySideNavRoute ? " has-side-nav" : ""}`}>
      {isStudySideNavRoute ? (
      <aside className={`hub-side-nav${isStudyMenuOpen ? " is-study-menu-open" : ""}`} aria-label="주요 메뉴">
        <NavLink className="hub-brand-mark" to="/">
          <span className="hub-brand-symbol">M</span>
          <span>
            <strong>MetaOn</strong>
            <small>영어 학습 놀이터</small>
          </span>
        </NavLink>

        <div className="hub-study-mobile-drawer-head">
          <span>스터디존 메뉴</span>
          <button aria-label="스터디존 메뉴 닫기" type="button" onClick={() => setIsStudyMenuOpen(false)}>
            <X size={19} strokeWidth={2.4} />
          </button>
        </div>

        <nav className="hub-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.match.some((prefix) =>
              prefix === "/" ? location.pathname === "/" : location.pathname.startsWith(prefix)
            );
            const className = `hub-nav-item ${item.tone}${active ? " is-active" : ""}`;
            return (
              <div className={`hub-nav-group${item.path === "/study" ? " is-study-tree-group" : ""}`} key={item.path}>
                <NavLink
                  aria-current={active ? "page" : undefined}
                  className={className}
                  to={item.path}
                  onClick={() => setIsStudyMenuOpen(false)}
                >
                  <Icon size={20} strokeWidth={2.25} />
                  <span>{item.label}</span>
                </NavLink>
                {item.path === "/study" && studyNavBrand ? (
                  <div className="hub-study-nav-tree" aria-label={`${studyNavBrand.brandName} Grade and Level`}>
                    {studyNavGroups.map((group) => {
                      const seriesList = group.seriesList.filter((series) => getSeriesBooks(series).length > 0);
                      const isExpanded = visibleExpandedGradeId === group.groupId;
                      const isSelectedGrade = selectedGroupId === group.groupId;
                      return (
                        <div className={`hub-study-grade${isExpanded ? " is-expanded" : ""}`} key={`${studyNavBrand.brandId}:${group.groupId}`}>
                          <button
                            className={`hub-study-grade-button${isSelectedGrade ? " is-active" : ""}`}
                            type="button"
                            onClick={() => {
                              setExpandedGradeId(group.groupId);
                              if (seriesList[0]) navigate(studyLevelPath(studyNavBrand, group, seriesList[0]));
                            }}
                          >
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            <span>{formatGradeName(group.groupName)}</span>
                            <small>{seriesList.length} Levels</small>
                          </button>
                          {isExpanded ? (
                            <div className="hub-study-level-list">
                              {seriesList.map((series) => {
                                const isSelectedLevel = isSelectedGrade && selectedSeriesIdx === series.seriesIdx;
                                return (
                                  <Link
                                    className={`hub-study-level-link${isSelectedLevel ? " is-active" : ""}`}
                                    key={`${group.groupId}:${series.seriesIdx}`}
                                    to={studyLevelPath(studyNavBrand, group, series)}
                                    onClick={() => setIsStudyMenuOpen(false)}
                                  >
                                    <span>{formatLevelName(series.seriesName)}</span>
                                    <small>{series.books.length}</small>
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="hub-side-footer">
          <button className="hub-nav-item compact" type="button" onClick={() => navigate("/profile/edit")}>
            <Settings size={19} strokeWidth={2.2} />
            <span>설정</span>
          </button>
          {isAuthenticated ? (
            <button className="hub-nav-item compact" type="button" onClick={() => void logout()}>
              <LogOut size={19} strokeWidth={2.2} />
              <span>로그아웃</span>
            </button>
          ) : (
            <NavLink className="hub-nav-item compact" to="/login">
              <LogIn size={19} strokeWidth={2.2} />
              <span>로그인</span>
            </NavLink>
          )}
        </div>
      </aside>
      ) : null}

      {isStudySideNavRoute && studyNavBrand ? (
        <>
          <button
            className="hub-study-mobile-menu-button"
            type="button"
            aria-label={isStudyMenuOpen ? "스터디존 메뉴 닫기" : "스터디존 메뉴 열기"}
            aria-expanded={isStudyMenuOpen}
            onClick={() => setIsStudyMenuOpen((open) => !open)}
          >
            {isStudyMenuOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
            <span>Grade</span>
          </button>
          <button
            className={`hub-study-mobile-menu-backdrop${isStudyMenuOpen ? " is-open" : ""}`}
            type="button"
            aria-label="스터디존 메뉴 닫기"
            onClick={() => setIsStudyMenuOpen(false)}
          />
        </>
      ) : null}

      <div className="hub-main-column">
        <header
          className={`hub-top-bar${isHomeRoute ? " hub-home-top-bar" : ""}${
            isHomeRoute && (isHomeTopBarVisible || isAccountMenuOpen) ? " is-visible" : ""
          }`}
        >
          <label className="hub-search-box">
            <Search size={18} strokeWidth={2.2} />
            <input aria-label="검색" placeholder="Book, Activity 검색" type="search" />
          </label>

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

function selectStudyNavBrand(catalog?: BookCatalog): BrandData | undefined {
  const visibleBrands = (catalog?.brands || []).filter((brand) => getBrandGroups(brand).length > 0);
  return visibleBrands.find((brand) => /raz[-\s]?kids/i.test(brand.brandName)) || visibleBrands[0];
}

function studyLevelPath(brand: BrandData, group: SeriesGroup, series: SeriesData): string {
  const params = new URLSearchParams({
    brand: String(brand.brandId),
    group: String(group.groupId),
    series: String(series.seriesIdx)
  });
  const firstBook = getSeriesBooks(series)[0];
  if (firstBook) params.set("book", String(firstBook.bookIdx || firstBook.bookId));
  return `/study?${params.toString()}`;
}

function formatGradeName(value: string): string {
  return value.replace(/^Raz-Kids\s*/i, "").replace(/\(RHK\)/gi, "").trim() || value;
}

function formatLevelName(value: string): string {
  return value.replace(/^Raz-Kids\s*/i, "").trim() || value;
}

function numberParam(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
