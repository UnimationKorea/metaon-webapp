import { ArrowRight, BookOpen, CheckCircle2, Clock3, GraduationCap, LogIn, Map, MessageCircle, PlayCircle, Rocket, Target } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { HomeDepthScene, HomeMotionRoot } from "../components/HomeMotion";
import { HomeLoadingScreen } from "../components/HomeLoadingScreen";
import { useAuth } from "../hooks/useAuth";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState, type HubPlacementState } from "../hooks/useHubState";
import { fallbackCoverFor, getHubBooks, percent, routeForBook } from "../services/hubCatalog";
import { resolveHomeHeroTheme } from "../services/heroThemes";

export function HubHomePage() {
  const { catalog, error, isLoading, usingSample } = useCatalog();
  const { isAuthenticated } = useAuth();
  const { getBookProgress, placement, user } = useHubState();
  const books = getHubBooks(catalog);
  const selected = books[0];
  const reviewBook = books[1] || selected;
  const recommendedBook = books[2] || books[1] || selected;
  const selectedBook = selected?.book;
  const reviewBookData = reviewBook?.book;
  const recommendedBookData = recommendedBook?.book;
  const progress = selected ? getBookProgress(selected.key) : undefined;
  const progressValue = selectedBook ? percent(progress?.completedActivityIds.length || 0, 4) : 0;
  const reviewProgress = reviewBook ? getBookProgress(reviewBook.key) : undefined;
  const reviewProgressValue = reviewBookData ? percent(reviewProgress?.completedActivityIds.length || 0, 4) : 0;
  const placementHome = getPlacementHomeContent(placement);
  const [heroTheme] = useState(resolveHomeHeroTheme);
  const heroThemeStyle = {
    "--hub-home-hero-bg": `url("${heroTheme.image}")`,
    "--hub-home-hero-position": heroTheme.position
  } as CSSProperties;

  if (isLoading) {
    return <HomeLoadingScreen backgroundImage={heroTheme.image} backgroundPosition={heroTheme.position} themeId={heroTheme.id} />;
  }

  if (!selectedBook) {
    return <EmptyState title="No books" detail={error || "MetaOn catalog is empty."} />;
  }

  return (
    <HomeMotionRoot themeId={heroTheme.id}>
      <section className="hub-home-feature-stage" aria-label="오늘의 학습 추천" data-hero-theme={heroTheme.id} style={heroThemeStyle}>
        <HomeDepthScene themeId={heroTheme.id} />
        <div className="hub-hero hub-home-hero-adventure">
          <div className="hub-hero-copy">
            <h1>오늘의 Raz-Kids</h1>
            <p>
              {selectedBook.bookName}에서 Activity를 이어서 완료하고, AI Speaking과 메타버스 월드로 이어지는 미션을 열어 보세요.
            </p>
            {usingSample ? <p className="hub-warning-copy">원격 catalog 대신 sample catalog가 표시 중입니다. {error}</p> : null}
            <div className="hub-hero-actions">
              <Link className="hub-primary-action" to="/study">
                <BookOpen size={18} strokeWidth={2.3} />
                스터디존으로 이동
              </Link>
              <Link className="hub-secondary-action" to="/progress">
                내 진도 보기
              </Link>
            </div>
          </div>

          <div className="hub-hero-adventure-board" aria-label="학습 진행 지도">
            <div className="hub-mission-map">
              <span className="hub-mission-traveler" aria-hidden="true">
                <Rocket size={15} strokeWidth={2.5} />
              </span>
              <span className="hub-map-node complete">BOOK</span>
              <span className="hub-map-line"></span>
              <span className="hub-map-node active">Activity</span>
              <span className="hub-map-line"></span>
              <span className="hub-map-node">AI Speaking</span>
              <span className="hub-map-line"></span>
              <span className="hub-map-node">Metaverse</span>
            </div>
          </div>
        </div>

        <section className={`hub-placement-home-card ${placement.status}`} aria-label="Placement Test" data-home-tilt="placement">
          <span className="hub-placement-home-icon">
            <GraduationCap size={26} strokeWidth={2.35} />
          </span>
          <div className="hub-placement-home-copy">
            <span>{placementHome.label}</span>
            <strong>{placementHome.title}</strong>
            <small>{placementHome.detail}</small>
          </div>
          <Link
            className="hub-placement-home-action"
            to={!isAuthenticated ? "/login" : placement.status === "completed" ? "/placement/result" : placement.status === "in-progress" ? "/placement/test" : "/placement/intro"}
          >
            {!isAuthenticated ? <LogIn size={18} strokeWidth={2.3} /> : <PlayCircle size={18} strokeWidth={2.3} />}
            {getPlacementCtaLabel(isAuthenticated, placement.status)}
          </Link>
        </section>

        <section className="hub-personalization-preview" aria-label="개인화 학습 미리보기">
          <div className="hub-personalization-grid">
            {!isAuthenticated ? (
              <>
                <Link className="hub-personal-card continue" data-home-tilt="personal" to="/login">
                  <span className="hub-personal-tab">이어서 학습</span>
                  <span className="hub-personal-icon">
                    <Clock3 size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>로그인 후 표시됩니다</strong>
                    <small>최근 학습하던 Book과 Activity 위치를 바로 이어서 볼 수 있습니다.</small>
                  </span>
                  <span className="hub-personal-meta">
                    <b>로그인하기</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>

                <Link className="hub-personal-card custom" data-home-tilt="personal" to="/login">
                  <span className="hub-personal-tab">오늘의 맞춤 학습</span>
                  <span className="hub-personal-icon">
                    <Target size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>학습 기록이 필요합니다</strong>
                    <small>Placement Test와 학습 이력이 쌓이면 오늘의 맞춤 학습을 구성합니다.</small>
                  </span>
                  <span className="hub-personal-meta">
                    <b>로그인 후 시작</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>

                <Link className="hub-personal-card recommend" data-home-tilt="personal" to="/study">
                  <span className="hub-personal-tab">추천 학습</span>
                  <span className="hub-personal-icon">
                    <CheckCircle2 size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>스터디존을 둘러보세요</strong>
                    <small>레벨과 학습 흐름이 확인되면 다음에 볼 Book을 추천합니다.</small>
                  </span>
                  <span className="hub-personal-meta">
                    <b>둘러보기</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link className="hub-personal-card continue" data-home-tilt="personal" to={routeForBook(selectedBook)}>
                  <span className="hub-personal-tab">이어서 학습</span>
                  <span className="hub-personal-icon">
                    <Clock3 size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>{selectedBook.bookName}</strong>
                    <small>{selected.series.seriesName} · 다음 Activity 예시: Listen & Read</small>
                  </span>
                  <span className="hub-personal-meter" aria-hidden="true">
                    <span style={{ width: `${progressValue}%` }}></span>
                  </span>
                  <span className="hub-personal-meta">
                    <b>{progressValue}%</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>

                <Link className="hub-personal-card custom" data-home-tilt="personal" to={reviewBookData ? routeForBook(reviewBookData) : "/study"}>
                  <span className="hub-personal-tab">오늘의 맞춤 학습</span>
                  <span className="hub-personal-icon">
                    <Target size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>단어 복습 미션</strong>
                    <small>{reviewBookData?.bookName || selectedBook.bookName} 기반 · Word Quiz 6문항 예시</small>
                  </span>
                  <span className="hub-personal-chips" aria-label="맞춤 학습 예시 항목">
                    <i>stork</i>
                    <i>slice</i>
                    <i>over</i>
                  </span>
                  <span className="hub-personal-meta">
                    <b>{reviewProgressValue}%</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>

                <Link className="hub-personal-card recommend" data-home-tilt="personal" to={recommendedBookData ? routeForBook(recommendedBookData) : "/study"}>
                  <span className="hub-personal-tab">추천 학습</span>
                  <span className="hub-personal-icon">
                    <CheckCircle2 size={22} strokeWidth={2.4} />
                  </span>
                  <span className="hub-personal-copy">
                    <strong>{recommendedBookData?.bookName || "다음 Book 추천"}</strong>
                    <small>{recommendedBook?.series.seriesName || selected.series.seriesName} · 비슷한 레벨의 읽기 확장 예시</small>
                  </span>
                  <span className="hub-personal-route" aria-hidden="true">
                    <em>Read</em>
                    <i />
                    <em>Word</em>
                    <i />
                    <em>Quiz</em>
                  </span>
                  <span className="hub-personal-meta">
                    <b>추천</b>
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </span>
                </Link>
              </>
            )}
          </div>
        </section>
      </section>

      <Link className="hub-home-menu-card study" data-home-tilt="portal" to="/study">
        <span className="hub-menu-art">
          <SafeCoverImage fallbackIndex={1} src={selectedBook.thumbnailUrl} />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <BookOpen size={15} strokeWidth={2.4} />
            {progressValue}% 진행
          </span>
          <strong>스터디존</strong>
          <span>Book과 Activity를 완료하며 오늘의 영어 보물을 모아요.</span>
          <span className="hub-menu-progress" aria-hidden="true">
            <span style={{ width: `${progressValue}%` }}></span>
          </span>
        </span>
        <span className="hub-menu-action">입장하기</span>
      </Link>

      <Link className="hub-home-menu-card ai" data-home-tilt="portal" to="/ai-session">
        <span className="hub-menu-art">
          <img src="/metaon-assets/ai-npc-preview.png" alt="" />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <MessageCircle size={15} strokeWidth={2.4} />
            NPC 미션
          </span>
          <strong>AI Speaking</strong>
          <span>{user.name}의 Book context를 넘겨 캐릭터와 대화해요.</span>
        </span>
        <span className="hub-menu-action">대화 시작</span>
      </Link>

      <Link className="hub-home-menu-card meta" data-home-tilt="portal" to="/metaverse-world">
        <span className="hub-menu-art">
          <img src="/metaon-assets/metaverse-preview.png" alt="" />
          <PortalGate />
        </span>
        <span className="hub-menu-copy">
          <span className="hub-menu-badge">
            <Map size={15} strokeWidth={2.4} />
            월드 탐험
          </span>
          <strong>메타버스</strong>
          <span>아바타와 미션 context를 들고 영어 월드로 연결해요.</span>
        </span>
        <span className="hub-menu-action">월드 열기</span>
      </Link>
    </HomeMotionRoot>
  );
}

function getPlacementHomeContent(placement: HubPlacementState) {
  if (placement.status === "completed") {
    return {
      label: "Placement Test",
      title: placement.level || "Level 2",
      detail: `${placement.recommendedBand || "추천 레벨"} · ${placement.score ?? 0}/5`
    };
  }

  if (placement.status === "in-progress") {
    return {
      label: "Placement Test",
      title: "진행 중인 레벨 진단",
      detail: "이어서 완료하고 추천 레벨 확인"
    };
  }

  return {
    label: "Placement Test",
    title: "내 시작 레벨 확인",
    detail: "짧은 진단 후 추천 Book 제시"
  };
}

function getPlacementCtaLabel(isAuthenticated: boolean, status: string) {
  if (!isAuthenticated) return "로그인 후 시작";
  if (status === "completed") return "결과 보기";
  if (status === "in-progress") return "이어서 테스트";
  return "레벨 테스트 시작";
}

function SafeCoverImage({ fallbackIndex, src }: { fallbackIndex: number; src?: string }) {
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

function PortalGate() {
  return (
    <span className="hub-menu-portal-gate" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
