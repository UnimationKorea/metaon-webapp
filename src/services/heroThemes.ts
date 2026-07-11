export type HomeHeroTheme = {
  id: string;
  label: string;
  image: string;
  position: string;
};

export const HOME_HERO_THEMES: HomeHeroTheme[] = [
  {
    id: "sky",
    label: "Sky Castle",
    image: "/metaon-assets/mission-banner.png",
    position: "right center"
  },
  {
    id: "space",
    label: "Space",
    image: "/metaon-assets/hero-themes/hero-space.png",
    position: "center center"
  },
  {
    id: "undersea",
    label: "Undersea",
    image: "/metaon-assets/hero-themes/hero-undersea.png",
    position: "center center"
  },
  {
    id: "jungle",
    label: "Jungle",
    image: "/metaon-assets/hero-themes/hero-jungle.png",
    position: "center center"
  },
  {
    id: "concert",
    label: "Concert Hall",
    image: "/metaon-assets/hero-themes/hero-concert.png",
    position: "center center"
  },
  {
    id: "magic",
    label: "Magic Land",
    image: "/metaon-assets/hero-themes/hero-magic.png",
    position: "center center"
  },
  {
    id: "amusement",
    label: "Amusement Park",
    image: "/metaon-assets/hero-themes/hero-amusement.png",
    position: "center center"
  }
];

const ADMIN_THEME_STORAGE_KEY = "metaon.homeHeroTheme";
const SESSION_THEME_STORAGE_KEY = "metaon.homeHeroTheme.session";

export function resolveHomeHeroTheme(): HomeHeroTheme {
  const adminThemeId = readAdminThemeId();
  const adminTheme = findTheme(adminThemeId);
  if (adminTheme) return adminTheme;

  if (typeof window === "undefined") return HOME_HERO_THEMES[0];

  const sessionTheme = findTheme(window.sessionStorage.getItem(SESSION_THEME_STORAGE_KEY));
  if (sessionTheme) return sessionTheme;

  const randomTheme = HOME_HERO_THEMES[Math.floor(Math.random() * HOME_HERO_THEMES.length)] || HOME_HERO_THEMES[0];
  window.sessionStorage.setItem(SESSION_THEME_STORAGE_KEY, randomTheme.id);
  return randomTheme;
}

function readAdminThemeId() {
  const envTheme = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_METAON_HOME_HERO_THEME;

  if (typeof window === "undefined") return envTheme;

  const queryTheme = new URLSearchParams(window.location.search).get("heroTheme");
  const windowTheme = (window as Window & { __METAON_HOME_HERO_THEME__?: string }).__METAON_HOME_HERO_THEME__;
  const localTheme = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);

  return queryTheme || windowTheme || localTheme || envTheme;
}

function findTheme(themeId?: string | null) {
  if (!themeId || themeId === "random" || themeId === "auto") return undefined;
  return HOME_HERO_THEMES.find((theme) => theme.id === themeId);
}
