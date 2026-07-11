import { ExternalLink, Home, Map, Menu, MessageCircle, Play, RefreshCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createExternalLaunch, type ExternalExperienceKind, type ExternalLaunch } from "../api/externalLaunch";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../hooks/useAuth";
import { useCatalog } from "../hooks/useCatalog";
import { useHubState } from "../hooks/useHubState";
import { getHubBooks } from "../services/hubCatalog";

const labels = {
  "ai-chat": {
    title: "AI Speaking",
    subtitle: "학습 Book context를 넘겨 외부 AI 프로젝트를 앱 안에 임베드합니다.",
    mockTitle: "AI Speaking 연결 대기",
    image: "/metaon-assets/ai-npc-preview.png"
  },
  metaverse: {
    title: "메타버스",
    subtitle: "저장된 아바타와 학습 미션 context를 외부 월드에 전달합니다.",
    mockTitle: "메타버스 월드 연결 대기",
    image: "/metaon-assets/metaverse-preview.png"
  }
};

const SESSION_ID_KEY = "metaon-session-id";
const USER_IDX_KEY = "metaon-user-idx";

export function ExternalStartPage({ kind }: { kind: ExternalExperienceKind }) {
  const navigate = useNavigate();
  const { catalog } = useCatalog();
  const books = getHubBooks(catalog);
  const selectedBook = books[0]?.book;
  const copy = labels[kind];
  const isAi = kind === "ai-chat";

  return (
    <section className="hub-external-start">
      <div className="hub-section-heading">
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
      </div>
      <div className="hub-launch-panel">
        <span className={`hub-tile-icon ${isAi ? "ai" : "meta"}`}>
          {isAi ? <MessageCircle size={28} strokeWidth={2.35} /> : <Map size={28} strokeWidth={2.35} />}
        </span>
        <h2>{isAi ? "Book 연계 세션 시작" : "월드 미션 시작"}</h2>
        <p>
          현재 context: <strong>{selectedBook?.bookName || "선택된 Book 없음"}</strong>
        </p>
        <div className="hub-contract-list">
          <span>사용자 SSO launchToken</span>
          {selectedBook ? <span>book: {selectedBook.bookId}</span> : null}
          <span>locale: ko-KR</span>
        </div>
        <button className="hub-primary-action" type="button" onClick={() => navigate(kind === "ai-chat" ? "/ai-session" : "/metaverse-world")}>
          <Play size={18} fill="currentColor" strokeWidth={0} />
          iframe에서 열기
        </button>
        {isAi ? (
          <Link className="hub-secondary-action" to="/chat-history">
            채팅 이력 목록
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function ExternalFramePage({ kind }: { kind: ExternalExperienceKind }) {
  const navigate = useNavigate();
  const auth = useAuth();
  const { catalog } = useCatalog();
  const { createNotification, user: hubUser } = useHubState();
  const [reloadKey, setReloadKey] = useState(0);
  const [launch, setLaunch] = useState<ExternalLaunch>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "completed" | "error">("loading");
  const [error, setError] = useState<string>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const selectedBook = getHubBooks(catalog)[0]?.book;
  const copy = labels[kind];

  useEffect(() => {
    let cancelled = false;
    if (auth.isLoading) return () => {
      cancelled = true;
    };
    if (!auth.isAuthenticated) {
      navigate("/login");
      return () => {
        cancelled = true;
      };
    }

    setStatus("loading");
    setError(undefined);
    createExternalLaunch({
      kind,
      bookId: selectedBook?.bookId,
      bookIdx: selectedBook?.bookIdx,
      seriesGroup: selectedBook?.seriesGroup,
      seriesIdx: selectedBook?.seriesIdx
    })
      .then((next) => {
        if (cancelled) return;
        setLaunch(next);
        if (next.isMock) setStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        setStatus("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    kind,
    navigate,
    reloadKey,
    selectedBook?.bookId,
    selectedBook?.bookIdx,
    selectedBook?.seriesGroup,
    selectedBook?.seriesIdx
  ]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;
      const message = event.data as {
        id?: string;
        kind?: ExternalExperienceKind;
        method?: string;
        params?: Record<string, unknown>;
        reason?: string;
        type?: string;
      };

      if (message.type === "rpc_call") {
        if (event.source !== iframeRef.current?.contentWindow || !message.id || !message.method) return;
        void handleFrameRpc({ id: message.id, method: message.method, params: message.params }, event);
        return;
      }

      if (message.kind !== kind) return;
      if (message.type === "ready") setStatus("ready");
      if (message.type === "completed") {
        setStatus("completed");
        createNotification({
          title: `${copy.title} 세션 완료`,
          body: "외부 프로젝트에서 완료 이벤트를 수신했습니다.",
          tone: "success"
        });
      }
      if (message.type === "error") {
        setStatus("error");
        createNotification({
          title: `${copy.title} 연결 오류`,
          body: message.reason || "외부 iframe 연결 중 오류가 발생했습니다.",
          tone: "danger"
        });
      }
      if (message.type === "requestClose") navigate(kind === "ai-chat" ? "/ai-chat" : "/metaverse");
    }

    async function handleFrameRpc(
      message: { id: string; method: string; params?: Record<string, unknown> },
      event: MessageEvent
    ) {
      try {
        let result: unknown;
        if (message.method === "getAuthInfo") {
          result = buildFrameAuthPayload(launch, hubUser, selectedBook);
          setStatus("ready");
        } else if (message.method === "onActivityComplete") {
          setStatus("completed");
          createNotification({
            title: `${copy.title} 세션 완료`,
            body: "외부 프로젝트에서 완료 이벤트를 수신했습니다.",
            tone: "success"
          });
          result = { ok: true };
        } else if (message.method === "onActivityExit") {
          navigate(kind === "ai-chat" ? "/ai-chat" : "/metaverse");
          result = { ok: true };
        } else if (message.method === "navigate") {
          const to = String(message.params?.to || "");
          if (to === "goBack" || to === "home" || to === "/") {
            navigate("/");
          } else if (to.startsWith("/")) {
            navigate(to);
          }
          result = { ok: true };
        } else {
          throw new Error(`Unsupported RPC method: ${message.method}`);
        }
        postRpcResult(event, { type: "rpc_result", id: message.id, result });
      } catch (caught) {
        postRpcResult(event, {
          type: "rpc_result",
          id: message.id,
          error: caught instanceof Error ? caught.message : String(caught)
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [copy.title, createNotification, hubUser, kind, launch, navigate, selectedBook]);

  const srcDoc = useMemo(() => {
    if (!launch?.isMock) return undefined;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
body{margin:0;font-family:system-ui,Segoe UI,sans-serif;background:linear-gradient(135deg,#effaff,#f7fff4);color:#14213d}
.wrap{min-height:100vh;display:grid;place-items:center;padding:32px;box-sizing:border-box}
.panel{width:min(620px,100%);background:white;border:1px solid #dbe9f5;border-radius:12px;padding:28px;box-shadow:0 20px 55px rgba(29,90,130,.14)}
h1{margin:0 0 10px;font-size:28px;line-height:1.1}p{margin:0 0 18px;color:#52616f;line-height:1.55}
.token{font:13px ui-monospace,Consolas,monospace;background:#eef6ff;border:1px solid #cfe5ff;border-radius:8px;padding:12px;word-break:break-all}
button{margin-top:20px;border:0;background:#18a36b;color:white;border-radius:8px;padding:12px 16px;font-weight:800;cursor:pointer}
.status{display:inline-flex;margin-bottom:14px;background:#fff1c5;color:#6a4a00;border-radius:999px;padding:6px 10px;font-size:12px;font-weight:800}
</style></head><body><div class="wrap"><section class="panel"><span class="status">MOCK IFRAME</span><h1>${copy.mockTitle}</h1><p>실제 URL은 METAON_AI_CHAT_URL 또는 METAON_METAVERSE_URL 환경 변수로 교체됩니다.</p><div class="token">${launch.iframeUrl}</div><button onclick="parent.postMessage({type:'completed',kind:'${kind}'},'*')">완료 이벤트 보내기</button></section></div><script>parent.postMessage({type:'ready',kind:'${kind}'},'*')</script></body></html>`;
  }, [copy.mockTitle, kind, launch]);

  if (error) {
    return <EmptyState title="External launch failed" detail={error} />;
  }

  return (
    <section className="hub-external-frame-screen">
      <button
        className={`hub-external-frame-menu-tab${isMenuOpen ? " is-open" : ""}`}
        type="button"
        onClick={() => setIsMenuOpen((value) => !value)}
        aria-expanded={isMenuOpen}
        aria-label={`${copy.title} 메뉴`}
      >
        <Menu size={20} strokeWidth={2.4} />
        <span>메뉴</span>
      </button>

      <div className={`hub-external-frame-header${isMenuOpen ? " is-open" : ""}`}>
        <div>
          <span className={`hub-connection-status ${status}`}>
            <ShieldCheck size={16} strokeWidth={2.3} />
            {status === "loading" && "연결 중"}
            {status === "ready" && "SSO 연결됨"}
            {status === "completed" && "완료 이벤트 수신"}
            {status === "error" && "오류"}
          </span>
          <h1>{copy.title}</h1>
          <p>{copy.subtitle}</p>
        </div>
        <div className="hub-frame-actions">
          <button className="hub-secondary-action" type="button" onClick={() => navigate("/")}>
            <Home size={17} strokeWidth={2.2} />
            홈
          </button>
          <button className="hub-secondary-action" type="button" onClick={() => setReloadKey((value) => value + 1)}>
            <RefreshCcw size={17} strokeWidth={2.2} />
            재시도
          </button>
          {launch && !launch.isMock ? (
            <a className="hub-secondary-action" href={launch.iframeUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} strokeWidth={2.2} />
              새 탭
            </a>
          ) : null}
          <button className="hub-secondary-action" type="button" onClick={() => setIsMenuOpen(false)}>
            접기
          </button>
          <button className="hub-icon-button" type="button" onClick={() => navigate(kind === "ai-chat" ? "/ai-chat" : "/metaverse")}>
            <X size={19} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {launch ? (
        <iframe
          ref={iframeRef}
          className="hub-external-frame"
          key={`${launch.iframeUrl}-${reloadKey}`}
          title={copy.title}
          src={launch.isMock ? undefined : launch.iframeUrl}
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-pointer-lock allow-downloads"
          allow="autoplay; fullscreen; microphone; camera; clipboard-read; clipboard-write"
          allowFullScreen
          onLoad={() => setStatus((current) => (current === "error" ? current : "ready"))}
          onError={() => setStatus("error")}
        />
      ) : (
        <div className="hub-empty-inline">외부 세션을 생성하는 중입니다.</div>
      )}

      {launch ? (
        <div className="hub-handoff-contract">
          <strong>전달 context</strong>
          <span>launchToken: {launch.launchToken.slice(0, 16)}...</span>
          <span>userId: {hubUser.id}</span>
          {selectedBook ? <span>book: {selectedBook.bookId}</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function postRpcResult(event: MessageEvent, payload: { error?: string; id: string; result?: unknown; type: "rpc_result" }) {
  const target = event.source as Window | null;
  const targetOrigin = event.origin && event.origin !== "null" ? event.origin : "*";
  target?.postMessage(payload, targetOrigin);
}

function buildFrameAuthPayload(launch: ExternalLaunch | undefined, user: { id: string; name: string }, selectedBook: { bookId?: string; bookIdx?: number } | undefined) {
  const storedSessionId = window.localStorage.getItem(SESSION_ID_KEY) || "";
  const storedUserIdx = Number(window.localStorage.getItem(USER_IDX_KEY) || 0);
  const sessionId = launch?.auth?.session_id || storedSessionId;
  const userIdx = launch?.auth?.user_idx || (Number.isFinite(storedUserIdx) ? storedUserIdx : 0);

  return {
    book_id: selectedBook?.bookId || "",
    book_idx: selectedBook?.bookIdx || 0,
    expires_at: launch?.expiresAt || "",
    kind: launch?.kind || "ai-chat",
    launch_token: launch?.launchToken || "",
    locale: "ko-KR",
    session_id: sessionId,
    user_id: launch?.auth?.user_id || user.id,
    user_idx: userIdx,
    username: launch?.auth?.username || user.name
  };
}

export function ChatHistoryPage() {
  const { kind = "ai-chat" } = useParams();
  void kind;
  return (
    <section className="hub-list-screen">
      <Link className="hub-back-link" to="/ai-chat">AI Speaking으로</Link>
      <div className="hub-section-heading">
        <div>
          <h1>채팅 이력 목록</h1>
          <p>외부 AI 프로젝트에서 전달될 세션 목록을 표시하는 자리입니다.</p>
        </div>
      </div>
      {["최근 Book 복습", "Activity 발음 연습"].map((title, index) => (
        <div className="hub-list-row" key={title}>
          <MessageCircle size={20} strokeWidth={2.25} />
          <span>
            <strong>{title}</strong>
            <small>{index === 0 ? "오늘" : "어제"}</small>
          </span>
        </div>
      ))}
    </section>
  );
}
