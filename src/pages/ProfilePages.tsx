import { AlertTriangle, ArrowLeft, Bell, BookOpen, Building2, CheckCircle2, Edit3, KeyRound, LockKeyhole, Plus, Save, Search, Trash2, UserCheck, UserRound, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { useAuth } from "../hooks/useAuth";
import { useHubState, type HubEntitlementStatus, type HubNotification } from "../hooks/useHubState";
import { MetaOnApiError } from "../api/uniplanetApi";
import { fallbackCoverFor, getHubBooks, percent } from "../services/hubCatalog";
import { packageKeyFor } from "../services/packageKeys";

const institutions = [
  { id: "ins-hanbit", name: "한빛초등학교", region: "Seoul" },
  { id: "ins-river", name: "리버사이드 영어도서관", region: "Busan" },
  { id: "ins-green", name: "그린브릿지 어학원", region: "Incheon" }
];

export function ProfilePage() {
  const navigate = useNavigate();
  const { updateUser, user } = useHubState();
  const { account, profile, releaseProfile } = useAuth();
  const canManageProfiles = account?.canManageProfiles !== false;
  const canChangePassword = account?.canChangePassword !== false;
  return (
    <section className="hub-profile-screen">
      <div className="hub-profile-header">
        <span className="hub-avatar-large">{user.avatar}</span>
        <div>
          <h1>{user.name}</h1>
          <p>{user.role === "institution" ? "기관회원" : "일반회원"} · {entitlementLabel(user.entitlementStatus)}</p>
        </div>
        <div className="hub-button-row">
          {canManageProfiles ? (
            <button className="hub-secondary-action" type="button" onClick={() => navigate("/profile/edit")}>
              <Edit3 size={17} strokeWidth={2.2} />
              편집
            </button>
          ) : null}
          <button
            className="hub-secondary-action"
            type="button"
            onClick={() => {
              void releaseProfile().finally(() => navigate("/profiles"));
            }}
          >
            프로필 전환
          </button>
          {canManageProfiles ? <Link className="hub-secondary-action" to="/profiles/manage">프로필 관리</Link> : null}
          {canChangePassword ? <Link className="hub-secondary-action" to="/account/password">비밀번호 변경</Link> : null}
        </div>
      </div>

      <div className="hub-profile-grid">
        <Link className="hub-profile-action" to="/progress">
          <BookOpen size={22} strokeWidth={2.25} />
          <span>
            <strong>학습 진도 현황</strong>
            <small>Book별 완료율과 목표 확인</small>
          </span>
        </Link>
        <Link className="hub-profile-action" to="/institution/apply">
          <Building2 size={22} strokeWidth={2.25} />
          <span>
            <strong>기관회원 가입 신청</strong>
            <small>승인 상태 확인 흐름</small>
          </span>
        </Link>
      </div>

      <div className="hub-entitlement-panel">
        <h2>권한 상태값</h2>
        <p>실제 결제/기관 API가 연결되기 전까지 local state로 메뉴 접근 상태를 검증합니다.</p>
        <div className="hub-demo-row">
          {(["granted", "expired", "none"] as HubEntitlementStatus[]).map((status) => (
            <button
              className={`hub-secondary-action${user.entitlementStatus === status ? " is-selected" : ""}`}
              key={status}
              type="button"
              onClick={() => updateUser({ entitlementStatus: status })}
            >
              {entitlementLabel(status)}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProfileEditPage() {
  const navigate = useNavigate();
  const { updateUser, user } = useHubState();
  const { account, profile, renameProfile } = useAuth();
  const canManageProfiles = account?.canManageProfiles !== false;
  const [name, setName] = useState(profile?.username || user.name);
  const [avatar, setAvatar] = useState(user.avatar);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  return (
    <section className="hub-form-screen">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        프로필로
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>프로필 편집</h1>
          <p>프로필 이름은 MetaOn 계정에 저장하고, 아바타 이니셜은 이 기기에 저장합니다.</p>
        </div>
      </div>
      <label className="hub-field">
        <span>이름</span>
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="hub-field">
        <span>아바타</span>
        <input value={avatar} maxLength={2} onChange={(event) => setAvatar(event.target.value.toUpperCase())} />
      </label>
      <button
        className="hub-primary-action"
        type="button"
        disabled={isSaving || !name.trim() || !profile || !canManageProfiles}
        onClick={() => {
          if (!profile) return;
          setError(undefined);
          setIsSaving(true);
          void renameProfile(profile.userIdx, name)
            .then(() => {
              updateUser({ avatar });
              navigate("/profile");
            })
            .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)))
            .finally(() => setIsSaving(false));
        }}
      >
        {isSaving ? "저장 중" : "저장"}
      </button>
      {!canManageProfiles ? <p className="hub-warning-copy">학원 소속 계정의 프로필 편집은 학원 관리자만 할 수 있습니다.</p> : null}
      {error ? <p className="hub-error-copy">{error}</p> : null}
    </section>
  );
}

export function ProfileManagePage() {
  const navigate = useNavigate();
  const {
    account,
    createProfile,
    deleteProfile,
    error: authError,
    isAccountAuthenticated,
    isLoading,
    managedProfiles,
    refreshManagedProfiles,
    renameProfile,
    setProfileActive
  } = useAuth();
  const [newProfileName, setNewProfileName] = useState("");
  const [draftNames, setDraftNames] = useState<Record<number, string>>({});
  const [message, setMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canManageProfiles = account?.canManageProfiles !== false;
  const activeCount = managedProfiles.filter((profile) => profile.isActive).length;

  useEffect(() => {
    if (isLoading) return;
    if (!isAccountAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    if (!canManageProfiles) return;
    void refreshManagedProfiles().catch(() => undefined);
  }, [canManageProfiles, isAccountAuthenticated, isLoading, navigate, refreshManagedProfiles]);

  async function run(action: () => Promise<void>) {
    setMessage(undefined);
    setIsSubmitting(true);
    try {
      await action();
    } catch (caught) {
      setMessage(profileManagementErrorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !isAccountAuthenticated) return null;

  return (
    <section className="figma-profile-manage-screen">
      <header className="figma-profile-manage-topbar">
        <div className="figma-profile-manage-topbar-left">
          <Link aria-label="프로필로 돌아가기" className="figma-profile-manage-icon-button" to="/profile"><ArrowLeft size={18} /></Link>
          <strong>METAON</strong>
        </div>
        <div className="figma-profile-manage-topbar-right" aria-hidden="true">
          <span className="figma-profile-manage-icon-button"><Search size={18} /></span>
          <span className="figma-profile-manage-icon-button"><Bell size={18} /></span>
          <span className="figma-profile-manage-topbar-avatar" />
        </div>
      </header>
      <main className="hub-form-screen hub-profile-manager">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        프로필로
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>프로필 관리</h1>
          <p>비활성 프로필은 학습 선택 화면에 보이지 않으며, 삭제된 프로필은 관리자만 복구할 수 있습니다.</p>
        </div>
      </div>

      {!canManageProfiles ? (
        <div className="hub-empty-state">
          <LockKeyhole size={34} />
          <strong>학원 관리자 관리 계정</strong>
          <span>이 계정의 프로필 생성, 이름 변경, 비활성화와 삭제는 학원 관리자 화면에서 처리합니다.</span>
        </div>
      ) : (
        <>
          <form
            className="hub-profile-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              const username = newProfileName.trim();
              if (!username) return;
              void run(async () => {
                await createProfile(username);
                await refreshManagedProfiles();
                setNewProfileName("");
                setMessage("프로필을 추가했습니다.");
              });
            }}
          >
            <label className="hub-field">
              <span>새 프로필 이름</span>
              <input value={newProfileName} maxLength={30} onChange={(event) => setNewProfileName(event.target.value)} placeholder="예: 둘째" disabled={isSubmitting} />
            </label>
            <button className="hub-primary-action" type="submit" disabled={isSubmitting || !newProfileName.trim()}>
              <Plus size={17} />
              프로필 추가
            </button>
          </form>

          <div className="hub-profile-manage-list" aria-live="polite">
            {managedProfiles.map((managedProfile) => {
              const draftName = draftNames[managedProfile.userIdx] ?? managedProfile.username;
              const isLastActive = managedProfile.isActive && activeCount <= 1;
              const isCurrent = managedProfile.isCurrent;
              return (
                <article className={`hub-profile-manage-row${managedProfile.isActive ? "" : " is-inactive"}`} key={managedProfile.userIdx}>
                  <span className="hub-profile-choice-avatar">{managedProfile.username.slice(0, 2).toUpperCase()}</span>
                  <div className="hub-profile-manage-main">
                    <label className="hub-field compact">
                      <span className="sr-only">{managedProfile.username} 프로필 이름</span>
                      <input
                        value={draftName}
                        maxLength={30}
                        disabled={isSubmitting}
                        onChange={(event) => setDraftNames((current) => ({ ...current, [managedProfile.userIdx]: event.target.value }))}
                      />
                    </label>
                    <small>{managedProfile.isActive ? "활성 프로필" : "비활성 프로필"}{isCurrent ? " · 현재 선택됨" : ""}</small>
                  </div>
                  <div className="hub-button-row compact">
                    <button
                      className="hub-secondary-action"
                      type="button"
                      disabled={isSubmitting || !draftName.trim() || draftName.trim() === managedProfile.username}
                      onClick={() => void run(async () => {
                        await renameProfile(managedProfile.userIdx, draftName.trim());
                        await refreshManagedProfiles();
                        setMessage("프로필 이름을 변경했습니다.");
                      })}
                    >
                      <Save size={15} />
                      저장
                    </button>
                    <button
                      className="hub-secondary-action"
                      type="button"
                      disabled={isSubmitting || isCurrent || isLastActive}
                      title={isCurrent ? "현재 선택된 프로필은 다른 프로필로 전환한 뒤 변경할 수 있습니다." : isLastActive ? "마지막 활성 프로필은 비활성화할 수 없습니다." : undefined}
                      onClick={() => void run(async () => {
                        await setProfileActive(managedProfile.userIdx, !managedProfile.isActive);
                        setMessage(managedProfile.isActive ? "프로필을 비활성화했습니다." : "프로필을 다시 활성화했습니다.");
                      })}
                    >
                      {managedProfile.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                      {managedProfile.isActive ? "비활성화" : "활성화"}
                    </button>
                    <button
                      className="hub-danger-action"
                      type="button"
                      disabled={isSubmitting || isCurrent || isLastActive}
                      title={isCurrent ? "현재 선택된 프로필은 다른 프로필로 전환한 뒤 삭제할 수 있습니다." : isLastActive ? "마지막 활성 프로필은 삭제할 수 없습니다." : undefined}
                      onClick={() => {
                        if (!window.confirm(`${managedProfile.username} 프로필을 삭제하시겠습니까? 학습 데이터는 보존되지만 사용자가 직접 복구할 수 없습니다.`)) return;
                        void run(async () => {
                          await deleteProfile(managedProfile.userIdx);
                          setMessage("프로필을 삭제했습니다.");
                        });
                      }}
                    >
                      <Trash2 size={15} />
                      삭제
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
      {message || authError ? <p className="hub-profile-select-message">{message || authError}</p> : null}
      </main>
    </section>
  );
}

export function PasswordChangePage() {
  const navigate = useNavigate();
  const { account, changePassword, error: authError, isAccountAuthenticated, isLoading } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const canChangePassword = account?.canChangePassword !== false;

  useEffect(() => {
    if (isLoading) return;
    if (!isAccountAuthenticated) navigate("/login", { replace: true });
  }, [isAccountAuthenticated, isLoading, navigate]);

  if (isLoading || !isAccountAuthenticated) return null;

  return (
    <section className="hub-form-screen hub-password-change-screen">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        프로필로
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>비밀번호 변경</h1>
          <p>계정 비밀번호를 변경합니다. 현재 학습 프로필 선택 상태와는 별개로 처리됩니다.</p>
        </div>
      </div>
      {!canChangePassword ? (
        <p className="hub-warning-copy">학원 소속 계정의 비밀번호는 학원 관리자에게 변경을 요청해 주세요.</p>
      ) : (
        <form
          className="hub-password-change-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (newPassword !== confirmPassword) {
              setMessage("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
              return;
            }
            setMessage(undefined);
            setIsSaving(true);
            void changePassword(currentPassword, newPassword)
              .then(() => {
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setMessage("비밀번호를 변경했습니다.");
              })
              .catch((caught) => setMessage(profileManagementErrorMessage(caught)))
              .finally(() => setIsSaving(false));
          }}
        >
          <label className="hub-field"><span>현재 비밀번호</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} disabled={isSaving} /></label>
          <label className="hub-field"><span>새 비밀번호</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={isSaving} /></label>
          <label className="hub-field"><span>새 비밀번호 확인</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={isSaving} /></label>
          <button className="hub-primary-action" type="submit" disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}>
            <KeyRound size={17} />
            {isSaving ? "변경 중" : "비밀번호 변경"}
          </button>
        </form>
      )}
      {message || authError ? <p className="hub-profile-select-message">{message || authError}</p> : null}
    </section>
  );
}

export function ProgressPage() {
  const { catalog } = useCatalog();
  const { getBookProgress } = useHubState();
  const rows = useMemo(() => getHubBooks(catalog).slice(0, 30), [catalog]);

  return (
    <section className="hub-list-screen">
      <div className="hub-section-heading">
        <div>
          <h1>학습 진도 현황</h1>
          <p>사용자 기준으로 저장된 Book/Activity 완료 상태를 복원합니다.</p>
        </div>
      </div>
      {rows.map(({ book, key }, index) => {
        const progress = getBookProgress(key);
        const value = percent(progress.completedActivityIds.length, 4);
        return (
          <div className="hub-progress-row" key={key}>
            <span className="hub-book-cover tiny">
              <ProgressCover fallbackIndex={index} src={book.thumbnailUrl} />
            </span>
            <span>
              <strong>{book.bookName}</strong>
              <small>{progress.completedActivityIds.length} Activity 완료</small>
            </span>
            <div className="hub-mini-progress wide">
              <span style={{ width: `${value}%` }}></span>
            </div>
            <b>{value}%</b>
          </div>
        );
      })}
    </section>
  );
}

function ProgressCover({ fallbackIndex, src }: { fallbackIndex: number; src?: string }) {
  const fallback = fallbackCoverFor(fallbackIndex);
  const [imageUrl, setImageUrl] = useState(src || fallback);

  useEffect(() => {
    setImageUrl(src || fallback);
  }, [fallback, src]);

  return (
    <img
      src={imageUrl}
      alt=""
      onError={() => {
        if (imageUrl !== fallback) setImageUrl(fallback);
      }}
    />
  );
}

export function NotificationsPage() {
  const { markNotificationRead, notifications } = useHubState();
  return (
    <section className="hub-list-screen">
      <div className="hub-section-heading">
        <div>
          <h1>알림 목록</h1>
          <p>권한, 콘텐츠 로딩, 외부 iframe 이벤트를 확인합니다.</p>
        </div>
      </div>
      {notifications.map((item) => (
        <button
          className={`hub-notification-row ${item.tone}${item.read ? " is-read" : ""}`}
          key={item.id}
          type="button"
          onClick={() => markNotificationRead(item.id)}
        >
          <span className="hub-notification-icon">{notificationIcon(item)}</span>
          <span>
            <strong>{item.title}</strong>
            <small>{item.body} · {new Date(item.createdAt).toLocaleString()}</small>
          </span>
        </button>
      ))}
    </section>
  );
}

export function InstitutionApplyPage() {
  const navigate = useNavigate();
  const { setApplication } = useHubState();
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || "");
  const [userName, setUserName] = useState("기관 담당자");
  const [email, setEmail] = useState("school@example.com");

  return (
    <section className="hub-form-screen">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        돌아가기
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>기관회원 가입 신청</h1>
          <p>기등록 기관명을 선택해 신청하면 승인 상태를 확인할 수 있습니다.</p>
        </div>
      </div>
      <label className="hub-field">
        <span>기관명</span>
        <select value={institutionId} onChange={(event) => setInstitutionId(event.target.value)}>
          {institutions.map((institution) => (
            <option key={institution.id} value={institution.id}>
              {institution.name} · {institution.region}
            </option>
          ))}
        </select>
      </label>
      <label className="hub-field">
        <span>담당자명</span>
        <input value={userName} onChange={(event) => setUserName(event.target.value)} />
      </label>
      <label className="hub-field">
        <span>이메일</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <button
        className="hub-primary-action"
        type="button"
        onClick={() => {
          const institution = institutions.find((item) => item.id === institutionId) || institutions[0];
          setApplication({
            id: `app-${Date.now()}`,
            institutionId,
            institutionName: institution?.name || "기관",
            userName,
            email,
            status: "pending",
            submittedAt: new Date().toISOString()
          });
          navigate("/institution/status");
        }}
      >
        신청 제출
      </button>
    </section>
  );
}

export function InstitutionStatusPage() {
  const { application, setApplicationStatus } = useHubState();
  return (
    <section className="hub-form-screen">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        돌아가기
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>가입 신청 상태 확인</h1>
          <p>기관회원은 대기, 승인, 반려 상태와 사유를 확인합니다.</p>
        </div>
      </div>
      {!application ? (
        <div className="hub-empty-state">
          <Building2 size={34} strokeWidth={2.2} />
          <strong>신청 내역이 없습니다</strong>
          <span>기관회원 가입 신청을 먼저 제출해 주세요.</span>
        </div>
      ) : (
        <div className="hub-status-panel large">
          <span className={`hub-status-badge ${application.status}`}>{statusLabel(application.status)}</span>
          <h2>{application.institutionName}</h2>
          <p>{application.userName} · {application.email}</p>
          <small>제출일 {new Date(application.submittedAt).toLocaleString()}</small>
          {application.reason ? <p className="hub-warning-copy">{application.reason}</p> : null}
          <div className="hub-demo-row">
            <button className="hub-secondary-action" type="button" onClick={() => setApplicationStatus("pending")}>대기</button>
            <button className="hub-secondary-action" type="button" onClick={() => setApplicationStatus("approved")}>승인</button>
            <button className="hub-secondary-action" type="button" onClick={() => setApplicationStatus("rejected")}>반려</button>
          </div>
        </div>
      )}
    </section>
  );
}

export function AccessDeniedPage() {
  const { user } = useHubState();
  return (
    <section className="hub-access-screen">
      <LockKeyhole size={42} strokeWidth={2.15} />
      <h1>접근 제한 안내</h1>
      <p>
        이 메뉴는 로그인 및 활성 권한이 필요합니다. 현재 상태는 <strong>{entitlementLabel(user.entitlementStatus)}</strong>입니다.
      </p>
      <div className="hub-hero-actions">
        <Link className="hub-primary-action" to="/profile">권한 상태 확인</Link>
        <Link className="hub-secondary-action" to="/">홈으로 이동</Link>
      </div>
    </section>
  );
}

function entitlementLabel(status: HubEntitlementStatus): string {
  return {
    granted: "권한 부여",
    expired: "권한 만료",
    none: "미부여"
  }[status];
}

function statusLabel(status: "pending" | "approved" | "rejected"): string {
  return {
    pending: "대기",
    approved: "승인",
    rejected: "반려"
  }[status];
}

function profileManagementErrorMessage(caught: unknown): string {
  const resultCode = caught instanceof MetaOnApiError ? caught.resultCode : 0;
  const fallback = caught instanceof Error ? caught.message : String(caught);
  return {
    310: "필수 입력값을 확인해 주세요.",
    316: "현재 비밀번호가 일치하지 않습니다.",
    340: "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.",
    341: "학원 소속 계정의 비밀번호는 학원 관리자만 변경할 수 있습니다.",
    345: "선택한 프로필을 다시 확인해 주세요. 목록을 새로고침합니다.",
    347: "이 계정의 프로필 관리는 학원 관리자 화면에서 처리합니다.",
    348: "마지막 활성 프로필은 비활성화하거나 삭제할 수 없습니다. 새 프로필을 먼저 추가해 주세요.",
    349: "같은 이름의 활성 프로필이 이미 있습니다. 다른 이름을 입력해 주세요."
  }[resultCode] || fallback;
}

function notificationIcon(item: HubNotification) {
  if (item.tone === "success") return <CheckCircle2 size={20} strokeWidth={2.35} />;
  if (item.tone === "warning") return <AlertTriangle size={20} strokeWidth={2.35} />;
  if (item.tone === "danger") return <AlertTriangle size={20} strokeWidth={2.35} />;
  return <UserRound size={20} strokeWidth={2.35} />;
}
