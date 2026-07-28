import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./useAuth";
import type { RazResult } from "../placementTest/src/types";

export type HubEntitlementStatus = "granted" | "expired" | "none";
export type HubNotificationTone = "success" | "warning" | "info" | "danger";
export type InstitutionApplicationStatus = "pending" | "approved" | "rejected";

export type HubUser = {
  id: string;
  name: string;
  avatar: string;
  role: "student" | "institution";
  entitlementStatus: HubEntitlementStatus;
};

export type HubNotification = {
  id: string;
  title: string;
  body: string;
  tone: HubNotificationTone;
  createdAt: string;
  read: boolean;
};

export type HubProgress = {
  bookKey: string;
  completedActivityIds: string[];
  updatedAt: string;
};

export type HubRecentBook = {
  bookKey: string;
  openedAt: string;
};

export type PlacementStatus = "not-started" | "in-progress" | "completed";

export type HubPlacementAnswer = {
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  skillTag: string;
  timeMs: number;
};

export type HubPlacementState = {
  status: PlacementStatus;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  currentQuestionIndex: number;
  answers: HubPlacementAnswer[];
  score?: number;
  level?: string;
  razResult?: RazResult;
  recommendedBand?: string;
  recommendedSkills?: string[];
};

export type InstitutionApplication = {
  id: string;
  institutionId: string;
  institutionName: string;
  userName: string;
  email: string;
  status: InstitutionApplicationStatus;
  reason?: string;
  submittedAt: string;
};

type HubProfile = Pick<HubUser, "avatar" | "entitlementStatus" | "name" | "role">;

type HubStateValue = {
  application: InstitutionApplication | null;
  completeActivity: (bookKey: string, activityId: string) => void;
  completePlacement: (result: Pick<HubPlacementState, "level" | "razResult" | "recommendedBand" | "recommendedSkills" | "score">) => void;
  createNotification: (input: Pick<HubNotification, "body" | "title" | "tone">) => void;
  getBookProgress: (bookKey: string) => HubProgress;
  markNotificationRead: (id: string) => void;
  notifications: HubNotification[];
  placement: HubPlacementState;
  progress: HubProgress[];
  recentBooks: HubRecentBook[];
  recordRecentBook: (bookKey: string) => void;
  resetPlacement: () => void;
  savePlacementAnswer: (answer: HubPlacementAnswer, nextQuestionIndex: number) => void;
  setApplication: (application: InstitutionApplication | null) => void;
  setApplicationStatus: (status: InstitutionApplicationStatus) => void;
  startPlacement: () => void;
  unreadCount: number;
  updateUser: (next: Partial<HubProfile>) => void;
  user: HubUser;
};

const PROFILE_KEY = "metaon.hub.profile";
const NOTIFICATIONS_KEY = "metaon.hub.notifications";
const PROGRESS_KEY = "metaon.hub.progress";
const APPLICATION_KEY = "metaon.hub.institutionApplication";
const PLACEMENT_KEY = "metaon.hub.placement";
const RECENT_BOOKS_KEY = "metaon.hub.recentBooks";
const RECENT_BOOKS_LIMIT = 12;

const seedNotifications: HubNotification[] = [
  {
    id: "noti-welcome",
    title: "MetaOn 웹앱이 준비되었습니다",
    body: "스터디존에서 Book을 다운로드하고 Activity를 실행할 수 있습니다.",
    tone: "success",
    createdAt: new Date().toISOString(),
    read: false
  }
];

const defaultProfile: HubProfile = {
  avatar: "MO",
  entitlementStatus: "granted",
  name: "",
  role: "student"
};

const defaultPlacement: HubPlacementState = {
  status: "not-started",
  currentQuestionIndex: 0,
  answers: []
};

const HubStateContext = createContext<HubStateValue | null>(null);

export function HubStateProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, profile: selectedProfile } = useAuth();
  const storageScope = isAuthenticated && selectedProfile?.userIdx ? `profile.${selectedProfile.userIdx}` : "guest";
  const [profile, setProfile] = useLocalStorageState<HubProfile>(scopedKey(PROFILE_KEY, storageScope), defaultProfile);
  const [notifications, setNotifications] = useLocalStorageState<HubNotification[]>(scopedKey(NOTIFICATIONS_KEY, storageScope), seedNotifications);
  const [progress, setProgress] = useLocalStorageState<HubProgress[]>(scopedKey(PROGRESS_KEY, storageScope), []);
  const [application, setStoredApplication] = useLocalStorageState<InstitutionApplication | null>(scopedKey(APPLICATION_KEY, storageScope), null);
  const [placement, setPlacement] = useLocalStorageState<HubPlacementState>(scopedKey(PLACEMENT_KEY, storageScope), defaultPlacement);
  const [recentBooks, setRecentBooks] = useLocalStorageState<HubRecentBook[]>(scopedKey(RECENT_BOOKS_KEY, storageScope), []);

  const user = useMemo<HubUser>(() => {
    const userId = selectedProfile?.userIdx ? `profile-${selectedProfile.userIdx}` : "guest";
    const name = isAuthenticated ? selectedProfile?.username || "MetaOn Learner" : profile.name || "Guest";
    return {
      id: userId,
      name,
      avatar: profile.avatar || initialsFor(name),
      role: profile.role,
      entitlementStatus: isAuthenticated ? profile.entitlementStatus : "none"
    };
  }, [isAuthenticated, profile, selectedProfile]);

  const updateUser = useCallback(
    (next: Partial<HubProfile>) => {
      setProfile((current) => ({ ...current, ...next }));
    },
    [setProfile]
  );

  const getBookProgress = useCallback(
    (bookKey: string): HubProgress =>
      progress.find((item) => item.bookKey === bookKey) || {
        bookKey,
        completedActivityIds: [],
        updatedAt: new Date().toISOString()
      },
    [progress]
  );

  const completeActivity = useCallback(
    (bookKey: string, activityId: string) => {
      setProgress((items) => {
        const current = items.find((item) => item.bookKey === bookKey);
        const completedActivityIds = Array.from(new Set([...(current?.completedActivityIds || []), activityId]));
        const next: HubProgress = {
          bookKey,
          completedActivityIds,
          updatedAt: new Date().toISOString()
        };
        return [...items.filter((item) => item.bookKey !== bookKey), next];
      });
    },
    [setProgress]
  );

  const recordRecentBook = useCallback(
    (bookKey: string) => {
      if (!bookKey) return;
      setRecentBooks((items) => {
        const openedAt = new Date().toISOString();
        const withoutCurrent = items.filter((item) => item.bookKey !== bookKey);
        return [{ bookKey, openedAt }, ...withoutCurrent].slice(0, RECENT_BOOKS_LIMIT);
      });
    },
    [setRecentBooks]
  );

  const createNotification = useCallback(
    (input: Pick<HubNotification, "body" | "title" | "tone">) => {
      const next: HubNotification = {
        id: `noti-${Date.now()}`,
        createdAt: new Date().toISOString(),
        read: false,
        ...input
      };
      setNotifications((items) => [next, ...items]);
    },
    [setNotifications]
  );

  const startPlacement = useCallback(() => {
    setPlacement((current) => {
      if (current.status === "in-progress") {
        return {
          ...current,
          updatedAt: new Date().toISOString()
        };
      }
      const now = new Date().toISOString();
      return {
        status: "in-progress",
        startedAt: now,
        updatedAt: now,
        currentQuestionIndex: 0,
        answers: []
      };
    });
  }, [setPlacement]);

  const savePlacementAnswer = useCallback(
    (answer: HubPlacementAnswer, nextQuestionIndex: number) => {
      setPlacement((current) => {
        const answers = [...current.answers.filter((item) => item.questionId !== answer.questionId), answer];
        return {
          ...current,
          status: "in-progress",
          answers,
          currentQuestionIndex: nextQuestionIndex,
          updatedAt: new Date().toISOString()
        };
      });
    },
    [setPlacement]
  );

  const completePlacement = useCallback(
    (result: Pick<HubPlacementState, "level" | "recommendedBand" | "recommendedSkills" | "score">) => {
      setPlacement((current) => ({
        ...current,
        ...result,
        status: "completed",
        currentQuestionIndex: current.answers.length,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
    },
    [setPlacement]
  );

  const resetPlacement = useCallback(() => {
    setPlacement(defaultPlacement);
  }, [setPlacement]);

  const markNotificationRead = useCallback(
    (id: string) => {
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    },
    [setNotifications]
  );

  const setApplication = useCallback(
    (next: InstitutionApplication | null) => {
      setStoredApplication(next);
    },
    [setStoredApplication]
  );

  const setApplicationStatus = useCallback(
    (status: InstitutionApplicationStatus) => {
      setStoredApplication((current) =>
        current
          ? {
              ...current,
              status,
              reason: status === "rejected" ? "기관 정보 확인이 필요합니다." : undefined
            }
          : current
      );
    },
    [setStoredApplication]
  );

  const value = useMemo<HubStateValue>(
    () => ({
      application,
      completeActivity,
      completePlacement,
      createNotification,
      getBookProgress,
      markNotificationRead,
      notifications,
      placement,
      progress,
      recentBooks,
      recordRecentBook,
      resetPlacement,
      savePlacementAnswer,
      setApplication,
      setApplicationStatus,
      startPlacement,
      unreadCount: notifications.filter((item) => !item.read).length,
      updateUser,
      user
    }),
    [
      application,
      completeActivity,
      completePlacement,
      createNotification,
      getBookProgress,
      markNotificationRead,
      notifications,
      placement,
      progress,
      recentBooks,
      recordRecentBook,
      resetPlacement,
      savePlacementAnswer,
      setApplication,
      setApplicationStatus,
      startPlacement,
      updateUser,
      user
    ]
  );

  return <HubStateContext.Provider value={value}>{children}</HubStateContext.Provider>;
}

export function useHubState() {
  const value = useContext(HubStateContext);
  if (!value) {
    throw new Error("useHubState must be used within HubStateProvider.");
  }
  return value;
}

function useLocalStorageState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));

  useEffect(() => {
    setValue(readStoredValue(key, fallback));
    // The fallback values for scoped stores may be inline arrays. The key is the
    // intentional state boundary when the selected profile changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setAndStore = useCallback(
    (nextValue: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof nextValue === "function" ? (nextValue as (current: T) => T)(current) : nextValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Local persistence is a convenience layer; keep UI state in memory if storage is unavailable.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, setAndStore] as const;
}

function scopedKey(key: string, scope: string): string {
  return `${key}.${scope}`;
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function initialsFor(name: string): string {
  const cleaned = name.trim();
  if (!cleaned) return "MO";
  const latin = cleaned
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return latin || cleaned.slice(0, 2).toUpperCase();
}
