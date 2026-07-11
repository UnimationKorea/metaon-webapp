interface Props {
  name: string;
  setName: (v: string) => void;
  grade: string;
  setGrade: (v: string) => void;
  onStart: () => void;
  loading: boolean;
}

// 시작점 보정을 위한 한국 학년 선택. 값은 백엔드 EFL 시작점 매핑 키.
const GRADES: { value: string; label: string }[] = [
  { value: "kinder", label: "유치원" },
  { value: "e1", label: "초1" },
  { value: "e2", label: "초2" },
  { value: "e3", label: "초3" },
  { value: "e4", label: "초4" },
  { value: "e5", label: "초5" },
  { value: "e6", label: "초6" },
  { value: "m1", label: "중1+" },
];

export default function RazStartPage({ name, setName, grade, setGrade, onStart, loading }: Props) {
  return (
    <div className="page start-page">
      <div className="hero">
        <div className="hero-emoji">📚</div>
        <h1>Raz 읽기 레벨테스트</h1>
        <p className="subtitle">글을 읽고 문제를 풀면 내 읽기 레벨을 찾아줘요!</p>
      </div>

      <div className="section-chips">
        <div className="chip"><span className="chip-emoji">📖</span><span>독해</span></div>
        <div className="chip"><span className="chip-emoji">🔤</span><span>어휘</span></div>
        <div className="chip"><span className="chip-emoji">🎯</span><span>레벨 맞춤</span></div>
      </div>

      <div className="info-card">
        문제가 <b>쉬우면 조금 더 어려운 글</b>이, <b>어려우면 조금 더 쉬운 글</b>이 나와요.
        끝나면 <b>나에게 딱 맞는 Raz 단계와 추천 책</b>을 알려줄게요. (약 3~6개 글)
      </div>

      <div className="name-box">
        <label htmlFor="name">이름</label>
        <input
          id="name"
          type="text"
          placeholder="이름을 적어요"
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="grade-label">학년 (시작 단계를 맞춰줘요)</label>
        <div className="grade-grid">
          {GRADES.map((g) => (
            <button
              key={g.value}
              className={`grade-chip ${grade === g.value ? "selected" : ""}`}
              onClick={() => setGrade(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <button
        className="big-btn primary"
        onClick={onStart}
        disabled={!name.trim() || !grade || loading}
      >
        {loading ? "준비 중… ⏳" : "시작하기 🚀"}
      </button>
    </div>
  );
}
