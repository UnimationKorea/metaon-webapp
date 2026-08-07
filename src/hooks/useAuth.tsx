import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  METAON_PROFILE_SESSION_EVENT,
  changeMetaOnPassword,
  createMetaOnProfile,
  deleteMetaOnProfile,
  getMetaOnManagedProfiles,
  getMetaOnProfiles,
  loginMetaOn,
  logoutMetaOn,
  renameMetaOnProfile,
  releaseMetaOnProfile,
  releaseStoredMetaOnProfileOnStartup,
  selectMetaOnProfile,
  setMetaOnProfileActive,
  type MetaOnAccount,
  type MetaOnAuthState,
  type MetaOnProfile,
  type MetaOnProfileSelectionResult,
  type MetaOnUser
} from "../api/uniplanetApi";

interface AuthContextValue {
  account: MetaOnAccount | null;
  authVersion: number;
  createProfile: (username: string) => Promise<MetaOnAuthState>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  deleteProfile: (userIdx: number) => Promise<void>;
  error?: string;
  isAccountAuthenticated: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (userId: string, password: string) => Promise<MetaOnAuthState>;
  logout: () => Promise<void>;
  managedProfiles: MetaOnProfile[];
  profile: MetaOnProfile | null;
  profiles: MetaOnProfile[];
  refreshProfiles: () => Promise<MetaOnAuthState>;
  refreshManagedProfiles: () => Promise<MetaOnProfile[]>;
  releaseProfile: () => Promise<void>;
  renameProfile: (userIdx: number, username: string) => Promise<MetaOnAuthState>;
  setProfileActive: (userIdx: number, active: boolean) => Promise<void>;
  selectProfile: (userIdx: number, force?: boolean) => Promise<MetaOnProfileSelectionResult>;
  user: MetaOnUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const LEGACY_SAVED_LOGIN_KEY = "metaon.savedLogin.v1";
const LEGACY_USER_IDX_KEY = "metaon-user-idx";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<MetaOnAccount | null>(null);
  const [profile, setProfile] = useState<MetaOnProfile | null>(null);
  const [profiles, setProfiles] = useState<MetaOnProfile[]>([]);
  const [managedProfiles, setManagedProfiles] = useState<MetaOnProfile[]>([]);
  const [authVersion, setAuthVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();

  const applyAuthState = useCallback((state: MetaOnAuthState, options: { preserveProfiles?: boolean } = {}) => {
    setAccount(state.account);
    setProfile(state.profile);
    setProfiles((current) => state.profiles.length || !options.preserveProfiles ? state.profiles : current);
  }, []);

  const clearAccountState = useCallback(() => {
    setAccount(null);
    setProfile(null);
    setProfiles([]);
    setManagedProfiles([]);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Versions before the credential-storage change kept the raw password in
    // localStorage. Remove it as soon as the application starts.
    window.localStorage.removeItem(LEGACY_SAVED_LOGIN_KEY);
    window.localStorage.removeItem(LEGACY_USER_IDX_KEY);

    const handleProfileSessionState = (event: Event) => {
      const resultCode = Number((event as CustomEvent<{ resultCode?: unknown }>).detail?.resultCode || 0);
      if (resultCode === 340) {
        clearAccountState();
        setError("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
      } else if (resultCode === 346 || resultCode === 352) {
        setProfile(null);
        setProfiles((current) => current.map((item) => ({ ...item, isCurrent: false })));
        setError(resultCode === 352 ? "선택한 프로필이 다른 접속에서 사용 중입니다. 프로필을 다시 선택해 주세요." : "학습할 프로필을 선택해 주세요.");
      } else {
        return;
      }
      setAuthVersion((version) => version + 1);
    };

    window.addEventListener(METAON_PROFILE_SESSION_EVENT, handleProfileSessionState);
    // The server contract requires release on every fresh app start. A saved token is only
    // retained long enough to release its old profile lease; it is never used for auto-login.
    releaseStoredMetaOnProfileOnStartup()
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener(METAON_PROFILE_SESSION_EVENT, handleProfileSessionState);
    };
  }, [clearAccountState]);

  useEffect(() => {
    if (!profile?.userIdx) return;
    const releaseOnPageHide = () => {
      if (typeof navigator.sendBeacon !== "function") return;
      navigator.sendBeacon(
        "/api/auth/profile/release",
        new Blob(["{}"], { type: "application/json" })
      );
    };

    window.addEventListener("pagehide", releaseOnPageHide);
    return () => window.removeEventListener("pagehide", releaseOnPageHide);
  }, [profile?.userIdx]);

  const login = useCallback(async (userId: string, password: string) => {
    setError(undefined);
    try {
      const auth = await loginMetaOn(userId, password);
      applyAuthState(auth);
      setAuthVersion((version) => version + 1);
      return auth;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const refreshProfiles = useCallback(async () => {
    setError(undefined);
    try {
      const auth = await getMetaOnProfiles();
      applyAuthState(auth);
      return auth;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const refreshManagedProfiles = useCallback(async () => {
    setError(undefined);
    try {
      const managed = await getMetaOnManagedProfiles();
      applyAuthState(managed);
      setManagedProfiles(managed.managedProfiles);
      return managed.managedProfiles;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const createProfile = useCallback(async (username: string) => {
    setError(undefined);
    try {
      const auth = await createMetaOnProfile(username);
      applyAuthState(auth, { preserveProfiles: true });
      setAuthVersion((version) => version + 1);
      return auth;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const selectProfile = useCallback(async (userIdx: number, force = false) => {
    setError(undefined);
    try {
      const result = await selectMetaOnProfile(userIdx, force);
      if (result.resultCode === 1) {
        applyAuthState(result, { preserveProfiles: true });
        setAuthVersion((version) => version + 1);
      } else if (result.resultCode === 340) {
        clearAccountState();
      }
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState, clearAccountState]);

  const releaseProfile = useCallback(async () => {
    setError(undefined);
    try {
      const auth = await releaseMetaOnProfile();
      applyAuthState(auth, { preserveProfiles: true });
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const renameProfile = useCallback(async (userIdx: number, username: string) => {
    setError(undefined);
    try {
      const auth = await renameMetaOnProfile(userIdx, username);
      applyAuthState(auth, { preserveProfiles: true });
      setAuthVersion((version) => version + 1);
      return auth;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const setProfileActive = useCallback(async (userIdx: number, active: boolean) => {
    setError(undefined);
    try {
      const managed = await setMetaOnProfileActive(userIdx, active);
      applyAuthState(managed);
      setManagedProfiles(managed.managedProfiles);
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const deleteProfile = useCallback(async (userIdx: number) => {
    setError(undefined);
    try {
      const managed = await deleteMetaOnProfile(userIdx);
      applyAuthState(managed);
      setManagedProfiles(managed.managedProfiles);
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    setError(undefined);
    try {
      const auth = await changeMetaOnPassword(currentPassword, newPassword);
      applyAuthState(auth, { preserveProfiles: true });
      setAuthVersion((version) => version + 1);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      throw caught;
    }
  }, [applyAuthState]);

  const logout = useCallback(async () => {
    setError(undefined);
    await logoutMetaOn();
    clearAccountState();
    setAuthVersion((version) => version + 1);
  }, [clearAccountState]);

  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      authVersion,
      changePassword,
      createProfile,
      deleteProfile,
      error,
      isAccountAuthenticated: Boolean(account),
      isAuthenticated: Boolean(profile),
      isLoading,
      login,
      logout,
      managedProfiles,
      profile,
      profiles,
      refreshProfiles,
      refreshManagedProfiles,
      releaseProfile,
      renameProfile,
      setProfileActive,
      selectProfile,
      user: profile
    }),
    [account, authVersion, changePassword, createProfile, deleteProfile, error, isLoading, login, logout, managedProfiles, profile, profiles, refreshManagedProfiles, refreshProfiles, releaseProfile, renameProfile, selectProfile, setProfileActive]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}
