import { useState, type FormEvent } from "react";
import { ArrowLeft, LogIn, ShieldCheck } from "lucide-react";
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
  const { account, error: authError, isAccountAuthenticated, isAuthenticated, isLoading, login, logout, user } = useAuth();
  const [savedLogin] = useState(() => readSavedLogin());
  const [userId, setUserId] = useState(() => savedLogin?.userId || "");
  const [password, setPassword] = useState(() => savedLogin?.password || "");
  const [shouldSaveLogin, setShouldSaveLogin] = useState(() => Boolean(savedLogin?.userId || savedLogin?.password));
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
      navigate("/profiles", { replace: true });
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
            <p>{isAuthenticated ? `${user?.username || user?.userIdx} 프로필로 학습 중입니다.` : "계정 로그인 후 학습할 프로필을 선택합니다."}</p>
          </div>
        </div>

        {isAccountAuthenticated ? (
          <div className="hub-active-session">
            <strong>{isAuthenticated ? user?.username || `Profile ${user?.userIdx}` : account?.username || "MetaOn Account"}</strong>
            <span>{isAuthenticated ? `프로필 IDX ${user?.userIdx}` : "프로필을 선택해 학습을 시작하세요."}</span>
            <div className="hub-button-row">
              <Link className="hub-primary-action" to={isAuthenticated ? "/" : "/profiles"}>
                {isAuthenticated ? "홈" : "프로필 선택"}
              </Link>
              <button className="hub-secondary-action" type="button" onClick={() => void logout()}>
                Logout
              </button>
            </div>
          </div>
        ) : null}

        <div className="hub-login-columns hub-login-columns-single">
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

        </div>

        {error || authError ? <p className="hub-error-copy">{error || authError}</p> : null}
      </section>
    </section>
  );
}
