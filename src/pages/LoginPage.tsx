import { useState, type FormEvent } from "react";
import { ArrowLeft, Eye, EyeOff, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const navigate = useNavigate();
  const { account, error: authError, isAccountAuthenticated, isAuthenticated, isLoading, login, logout, user } = useAuth();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);
    try {
      await login(userId, password);
      navigate("/profiles", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMessage = isAuthenticated
    ? `${user?.username || user?.userIdx} 프로필로 학습 중입니다.`
    : "계정 로그인 후 학습할 프로필을 선택합니다.";

  return (
    <section className="figma-login-screen">
      <header className="figma-login-topbar">
        <div className="figma-login-topbar-left">
          <Link aria-label="홈으로" className="figma-login-round-button" to="/">
            <ArrowLeft size={18} />
          </Link>
          <strong>METAON</strong>
        </div>
        <div className="figma-login-topbar-right" aria-hidden="true">
          <span className="figma-login-round-button"><Search size={18} /></span>
          <span className="figma-login-round-button figma-login-notification-dot" />
          <span className="figma-login-topbar-login">로그인</span>
        </div>
      </header>

      <main className="figma-login-content">
        <section className="figma-login-marketing" aria-label="MetaOn 소개">
          <div className="figma-login-brand-copy">
            <span>영어 학습 놀이터</span>
            <strong>METAON</strong>
          </div>
          <div className="figma-login-intro">
            <h1>Book 학습에서 AI와 메타버스까지<br />이어지는 영어 모험 허브</h1>
            <p>실제 MetaOn 계정으로 로그인하면 Book catalog, ZIP 다운로드,<br />Activity 실행 흐름을 사용할 수 있습니다.</p>
            <div className="figma-login-path" aria-label="Book Activity AI Speaking World">
              <span>Book</span><i>›</i><span>Activity</span><i>›</i><span>AI Speaking</span><i>›</i><span>World</span>
            </div>
          </div>
          <img className="figma-login-mascot" src="/metaon-assets/auth/login-mascot.png" alt="MetaOn 캐릭터" />
        </section>

        <section className="figma-login-form-side">
          <form className="figma-login-card" onSubmit={submitLogin}>
            <div className="figma-login-card-heading">
              <h1>MetaOn Login</h1>
              <p>{activeMessage}</p>
            </div>

            {isAccountAuthenticated ? (
              <div className="figma-login-active-session">
                <strong>{isAuthenticated ? user?.username || `Profile ${user?.userIdx}` : account?.username || "MetaOn Account"}</strong>
                <span>{isAuthenticated ? "현재 프로필로 학습 중입니다." : "프로필을 선택해 학습을 시작하세요."}</span>
                <div>
                  <Link to={isAuthenticated ? "/" : "/profiles"}>{isAuthenticated ? "홈으로" : "프로필 선택"}</Link>
                  <button type="button" onClick={() => void logout()}>로그아웃</button>
                </div>
              </div>
            ) : null}

            <div className="figma-login-fields">
              <label>
                <span>아이디 (ID)</span>
                <input autoComplete="username" disabled={isSubmitting} onChange={(event) => setUserId(event.target.value)} placeholder="MetaOn 계정 ID를 입력해주세요" value={userId} />
              </label>
              <label>
                <span>비밀번호 (Password)</span>
                <span className="figma-login-password-field">
                  <input autoComplete="current-password" disabled={isSubmitting} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력해주세요" type={isPasswordVisible ? "text" : "password"} value={password} />
                  <button aria-label={isPasswordVisible ? "비밀번호 숨기기" : "비밀번호 보기"} type="button" onClick={() => setIsPasswordVisible((visible) => !visible)}>
                    {isPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </span>
              </label>
              {error || authError ? <p className="figma-login-error">{error || authError}</p> : null}
            </div>

            <button className="figma-login-submit" disabled={isSubmitting || !userId.trim() || !password || isLoading} type="submit">
              {isSubmitting ? "로그인 중..." : "로그인하기"}
            </button>
          </form>
        </section>
      </main>
    </section>
  );
}
