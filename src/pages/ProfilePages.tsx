import { AlertTriangle, ArrowLeft, BookOpen, Building2, CheckCircle2, Edit3, LockKeyhole, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState, type HubEntitlementStatus, type HubNotification } from "../hooks/useHubState";
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
  return (
    <section className="hub-profile-screen">
      <div className="hub-profile-header">
        <span className="hub-avatar-large">{user.avatar}</span>
        <div>
          <h1>{user.name}</h1>
          <p>{user.role === "institution" ? "기관회원" : "일반회원"} · {entitlementLabel(user.entitlementStatus)}</p>
        </div>
        <button className="hub-secondary-action" type="button" onClick={() => navigate("/profile/edit")}>
          <Edit3 size={17} strokeWidth={2.2} />
          편집
        </button>
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
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar);

  return (
    <section className="hub-form-screen">
      <Link className="hub-back-link" to="/profile">
        <ArrowLeft size={17} />
        프로필로
      </Link>
      <div className="hub-section-heading">
        <div>
          <h1>프로필 편집</h1>
          <p>학생 이름과 아바타 이니셜을 저장합니다.</p>
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
        onClick={() => {
          updateUser({ avatar, name });
          navigate("/profile");
        }}
      >
        저장
      </button>
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

function notificationIcon(item: HubNotification) {
  if (item.tone === "success") return <CheckCircle2 size={20} strokeWidth={2.35} />;
  if (item.tone === "warning") return <AlertTriangle size={20} strokeWidth={2.35} />;
  if (item.tone === "danger") return <AlertTriangle size={20} strokeWidth={2.35} />;
  return <UserRound size={20} strokeWidth={2.35} />;
}
