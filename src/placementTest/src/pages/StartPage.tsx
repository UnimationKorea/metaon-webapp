import { SECTION_META } from "../levels";
import type { SectionId } from "../types";

interface Props {
  name: string;
  setName: (v: string) => void;
  onStart: () => void;
}

const ORDER: SectionId[] = ["vocabulary", "grammar", "reading", "listening"];

export default function StartPage({ name, setName, onStart }: Props) {
  return (
    <div className="page start-page">
      <div className="hero">
        <div className="hero-emoji">🦉</div>
        <h1>영어 레벨테스트</h1>
        <p className="subtitle">네 가지 영역을 풀고 내 레벨을 알아봐요!</p>
      </div>

      <div className="section-chips">
        {ORDER.map((s) => (
          <div key={s} className="chip">
            <span className="chip-emoji">{SECTION_META[s].emoji}</span>
            <span>{SECTION_META[s].label}</span>
          </div>
        ))}
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
      </div>

      <button className="big-btn primary" onClick={onStart} disabled={!name.trim()}>
        시작하기 🚀
      </button>
    </div>
  );
}
