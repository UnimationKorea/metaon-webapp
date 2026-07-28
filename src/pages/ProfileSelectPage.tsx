import { ArrowLeft, CircleAlert, Plus, RefreshCw, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { MetaOnProfile } from "../api/uniplanetApi";
import { useAuth } from "../hooks/useAuth";

type PendingTakeover = {
  idleSeconds: number;
  profile: MetaOnProfile;
};

export function ProfileSelectPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    account,
    createProfile,
    error: authError,
    isAccountAuthenticated,
    isLoading,
    profiles,
    refreshProfiles,
    selectProfile
  } = useAuth();
  const [message, setMessage] = useState<string>();
  const [pendingTakeover, setPendingTakeover] = useState<PendingTakeover>();
  const [newProfileName, setNewProfileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!isAccountAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (!profiles.length) {
      void refreshProfiles().catch(() => undefined);
    }
  }, [isAccountAuthenticated, isLoading, navigate, profiles.length, refreshProfiles]);

  const destination = typeof location.state === "object" && location.state && "returnTo" in location.state
    ? String(location.state.returnTo || "/")
    : "/";
  const canManageProfiles = account?.canManageProfiles !== false;

  async function chooseProfile(profile: MetaOnProfile, force = false) {
    setMessage(undefined);
    setIsSubmitting(true);
    try {
      const result = await selectProfile(profile.userIdx, force);
      if (result.resultCode === 1) {
        navigate(destination, { replace: true });
        return;
      }
      if (result.resultCode === 353) {
        setPendingTakeover({ profile, idleSeconds: result.holderIdleSec || 0 });
        return;
      }
      if (result.resultCode === 351) {
        setMessage("이 프로필은 현재 학습 진행 중입니다. 다른 프로필을 선택해 주세요.");
        return;
      }
      if (result.resultCode === 345) {
        setMessage("선택할 수 없는 프로필입니다. 목록을 새로고침해 주세요.");
        await refreshProfiles();
        return;
      }
      if (result.resultCode === 352) {
        setMessage("이 프로필이 다른 곳에서 사용을 시작했습니다. 프로필을 다시 선택해 주세요.");
        await refreshProfiles();
        return;
      }
      if (result.resultCode === 346) {
        setMessage("학습할 프로필을 다시 선택해 주세요.");
        return;
      }
      if (result.resultCode === 340) {
        navigate("/login", { replace: true });
        return;
      }
      setMessage(result.resultMessage || "프로필을 선택하지 못했습니다.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = newProfileName.trim();
    if (!username) return;
    setMessage(undefined);
    setIsSubmitting(true);
    try {
      await createProfile(username);
      setNewProfileName("");
      setMessage("프로필을 추가했습니다. 학습할 프로필을 선택해 주세요.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="hub-profile-select-screen">
      <Link className="hub-back-link" to="/login">
        <ArrowLeft size={17} />
        계정 로그인으로
      </Link>

      <div className="hub-profile-select-heading">
        <span className="hub-profile-select-icon"><UsersRound size={28} /></span>
        <div>
          <h1>누가 학습하나요?</h1>
          <p>{account?.username || "MetaOn 계정"} 계정의 학습 프로필을 선택해 주세요.</p>
        </div>
        <button className="hub-icon-button" type="button" onClick={() => void refreshProfiles()} aria-label="프로필 목록 새로고침" disabled={isSubmitting}>
          <RefreshCw size={18} />
        </button>
      </div>

      {canManageProfiles ? (
        <Link className="hub-inline-link" to="/profiles/manage">프로필 관리</Link>
      ) : null}

      <div className="hub-profile-choice-grid" aria-live="polite">
        {profiles.map((profile) => (
          <button
            aria-label={`${profile.username} 학습 프로필 선택`}
            className={`hub-profile-choice${profile.isCurrent ? " is-current" : ""}`}
            disabled={isSubmitting || !profile.isActive}
            key={profile.userIdx}
            onClick={() => void chooseProfile(profile)}
            type="button"
          >
            <span className="hub-profile-choice-avatar">{initials(profile.username)}</span>
            <span className="hub-profile-choice-copy">
              <strong>{profile.username}</strong>
              <small>{profile.isCurrent ? "현재 선택된 프로필" : "학습 프로필"}</small>
            </span>
            <span className="hub-profile-choice-status">{profile.isActive ? "선택" : "비활성"}</span>
          </button>
        ))}
      </div>

      {!isLoading && !profiles.length ? (
        <div className="hub-empty-state">
          <UserRound size={34} />
          <strong>사용 가능한 프로필이 없습니다</strong>
          <span>새 프로필을 추가하거나 계정 관리자에게 문의해 주세요.</span>
        </div>
      ) : null}

      {canManageProfiles ? (
        <form className="hub-profile-create-form" onSubmit={submitCreateProfile}>
          <label className="hub-field">
            <span>새 프로필 이름</span>
            <input
              disabled={isSubmitting}
              maxLength={30}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="예: 첫째"
              value={newProfileName}
            />
          </label>
          <button className="hub-secondary-action" disabled={isSubmitting || !newProfileName.trim()} type="submit">
            <Plus size={17} />
            프로필 추가
          </button>
        </form>
      ) : (
        <p className="hub-warning-copy">학원 소속 계정의 프로필 추가와 편집은 학원 관리자에게 문의해 주세요.</p>
      )}

      {message || authError ? <p className="hub-profile-select-message">{message || authError}</p> : null}

      {pendingTakeover ? (
        <div className="hub-profile-takeover-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-takeover-title">
          <CircleAlert size={28} />
          <div>
            <h2 id="profile-takeover-title">이 프로필을 계속 사용하시겠습니까?</h2>
            <p>
              <strong>{pendingTakeover.profile.username}</strong> 프로필의 이전 접속이 남아 있습니다.
              {pendingTakeover.idleSeconds > 0 ? ` 마지막 사용: ${formatIdleTime(pendingTakeover.idleSeconds)} 전` : ""}
            </p>
            <p className="hub-muted-copy">계속하면 이전 접속은 이 프로필에서 나가게 됩니다.</p>
            <div className="hub-button-row">
              <button className="hub-secondary-action" type="button" onClick={() => setPendingTakeover(undefined)} disabled={isSubmitting}>
                아니오
              </button>
              <button
                className="hub-primary-action"
                type="button"
                onClick={() => {
                  const profile = pendingTakeover.profile;
                  setPendingTakeover(undefined);
                  void chooseProfile(profile, true);
                }}
                disabled={isSubmitting}
              >
                계속 사용
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function initials(name: string): string {
  const value = name.trim();
  return value.slice(0, 2).toUpperCase() || "MO";
}

function formatIdleTime(seconds: number): string {
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
