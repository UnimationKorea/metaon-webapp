import { useState, type FormEvent } from "react";
import { ArrowLeft, KeyRound, LogIn, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const savedLoginStorageKey = "metaon.savedLogin.v1";

type SavedLogin = {
  password: string;
  userId: string;
};

function readSavedLogin(): SavedLogin | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(savedLoginStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLogin>;
    return {
      password: typeof parsed.password === "string" ? parsed.password : "",
      userId: typeof parsed.userId === "string" ? parsed.userId : ""
    };
  } catch {
    window.localStorage.removeItem(savedLoginStorageKey);
    return null;
  }
}

function saveLogin(userId: string, password: string) {
  window.localStorage.setItem(savedLoginStorageKey, JSON.stringify({ userId, password }));
}

function clearSavedLogin() {
  window.localStorage.removeItem(savedLoginStorageKey);
}

export function LoginPage() {
  const navigate = useNavigate();
  const { error: authError, isAuthenticated, isLoading, login, logout, setManualSession, user } = useAuth();
  const [savedLogin] = useState(() => readSavedLogin());
  const [userId, setUserId] = useState(() => savedLogin?.userId || "");
  const [password, setPassword] = useState(() => savedLogin?.password || "");
  const [shouldSaveLogin, setShouldSaveLogin] = useState(() => Boolean(savedLogin?.userId || savedLogin?.password));
  const [manualUserIdx, setManualUserIdx] = useState("");
  const [manualSessionId, setManualSessionId] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await login(userId, password);
      if (shouldSaveLogin) {
        saveLogin(userId.trim(), password);
      } else {
        clearSavedLogin();
      }
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitManualSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await setManualSession(Number(manualUserIdx), manualSessionId);
      navigate("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="hub-login-layout">
      <div className="hub-auth-visual">
        <div className="hub-brand-mark">
          <span className="hub-brand-symbol">M</span>
          <span>
            <strong>MetaOn</strong>
            <small>영어 학습 놀이터</small>
          </span>
        </div>
        <h1>Book 학습에서 AI와 메타버스까지 이어지는 영어 모험 허브</h1>
        <p>실제 MetaOn 계정으로 로그인하면 Book catalog, ZIP 다운로드, Activity 실행 흐름을 사용할 수 있습니다.</p>
        <div className="hub-auth-path" aria-hidden="true">
          <span>Book</span>
          <i></i>
          <span>Activity</span>
          <i></i>
          <span>AI</span>
          <i></i>
          <span>World</span>
        </div>
      </div>

      <section className="hub-auth-panel">
        <Link className="hub-back-link" to="/">
          <ArrowLeft size={17} />
          홈으로
        </Link>
        <div className="hub-login-heading">
          <ShieldCheck size={34} />
          <div>
            <h1>MetaOn Login</h1>
            <p>{isAuthenticated ? `${user?.username || user?.userIdx} session is active.` : "Connect a MetaOn session."}</p>
          </div>
        </div>

        {isAuthenticated ? (
          <div className="hub-active-session">
            <strong>{user?.username || `User ${user?.userIdx}`}</strong>
            <span>User IDX {user?.userIdx}</span>
            <div className="hub-button-row">
              <Link className="hub-primary-action" to="/">
                홈
              </Link>
              <button className="hub-secondary-action" type="button" onClick={() => void logout()}>
                Logout
              </button>
            </div>
          </div>
        ) : null}

        <div className="hub-login-columns">
          <form className="hub-login-form" onSubmit={submitLogin}>
            <h2>
              <LogIn size={20} />
              Account
            </h2>
            <label className="hub-field">
              ID
              <input
                autoComplete="username"
                disabled={isSubmitting}
                onChange={(event) => setUserId(event.target.value)}
                value={userId}
              />
            </label>
            <label className="hub-field">
              Password
              <input
                autoComplete="current-password"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <label className="hub-check-field">
              <input
                checked={shouldSaveLogin}
                disabled={isSubmitting}
                onChange={(event) => {
                  setShouldSaveLogin(event.target.checked);
                  if (!event.target.checked) {
                    clearSavedLogin();
                  }
                }}
                type="checkbox"
              />
              <span>Account ID / Password 저장</span>
            </label>
            <button className="hub-primary-action" disabled={isSubmitting || !userId.trim() || !password || isLoading} type="submit">
              Login
            </button>
          </form>

          <form className="hub-login-form" onSubmit={submitManualSession}>
            <h2>
              <KeyRound size={20} />
              Session
            </h2>
            <label className="hub-field">
              User IDX
              <input
                disabled={isSubmitting}
                inputMode="numeric"
                onChange={(event) => setManualUserIdx(event.target.value)}
                value={manualUserIdx}
              />
            </label>
            <label className="hub-field">
              Session-Id / JSESSIONID
              <input
                autoComplete="off"
                disabled={isSubmitting}
                onChange={(event) => setManualSessionId(event.target.value)}
                type="password"
                value={manualSessionId}
              />
            </label>
            <button
              className="hub-secondary-action"
              disabled={isSubmitting || !Number(manualUserIdx) || !manualSessionId.trim() || isLoading}
              type="submit"
            >
              Verify
            </button>
          </form>
        </div>

        {error || authError ? <p className="hub-error-copy">{error || authError}</p> : null}
      </section>
    </section>
  );
}
