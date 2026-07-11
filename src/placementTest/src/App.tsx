import { useState } from "react";
import RazStartPage from "./pages/RazStartPage";
import RazTestPage from "./pages/RazTestPage";
import RazResultPage from "./pages/RazResultPage";
import { startRazTest } from "./api";
import type { RazResult, RazUnit } from "./types";

type View = "start" | "test" | "result";

export default function App() {
  const [view, setView] = useState<View>("start");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ sessionId: string; unit: RazUnit } | null>(null);
  const [result, setResult] = useState<RazResult | null>(null);

  async function begin() {
    setLoading(true);
    setError(null);
    try {
      const data = await startRazTest(name.trim(), grade);
      setSession(data);
      setView("test");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      {view === "start" && (
        <>
          <RazStartPage
            name={name}
            setName={setName}
            grade={grade}
            setGrade={setGrade}
            onStart={begin}
            loading={loading}
          />
          {error && <p className="error center-error">⚠️ {error}</p>}
        </>
      )}
      {view === "test" && session && (
        <RazTestPage
          sessionId={session.sessionId}
          firstUnit={session.unit}
          onDone={(r) => {
            setResult(r);
            setView("result");
          }}
        />
      )}
      {view === "result" && result && (
        <RazResultPage
          result={result}
          onRestart={() => {
            setResult(null);
            setSession(null);
            setView("start");
          }}
        />
      )}
    </div>
  );
}
