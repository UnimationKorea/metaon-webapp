# QCNP01 시나리오 API 계약

## 목적

`QCNP01`은 기존 Quick Check 문항과 별도로 생성·게시되는 시나리오를 받아 NPC 대화, 문제, 정답/오답 분기, 종료 순서로 실행한다. 시나리오는 연출만 담당하며 정답과 채점은 기존 MetaOn Quick Check Parent가 담당한다.

## BFF 호출

```http
GET /api/activities/npc-quick-check/scenario?bookIdx=7228&dayIdx=33&actIdx=65
Cookie: metaon_auth=...
```

시나리오 원천 서버 호출은 BFF가 수행한다.

```http
GET {METAON_NPC_SCENARIO_API_URL}?book_idx=7228&day_idx=33&act_idx=65
X-Api-Key: {METAON_NPC_SCENARIO_API_KEY}
Accept: application/json
```

브라우저에는 원천 API key를 전달하지 않는다. 원천 API가 미설정이거나 `404`를 반환하면 BFF는 `scenario: null`을 반환하고 기존 선형 Quick Check를 실행한다.

## 응답 예시

```json
{
  "resultCode": 1,
  "resultMessage": "success",
  "scenario": {
    "scenario_id": "g1li02-day33-market-v1",
    "version": 1,
    "book_idx": 7228,
    "day_idx": 33,
    "act_idx": 65,
    "locale": "ko-KR",
    "start_node_id": "intro",
    "content_hash": "sha256:...",
    "published_at": "2026-07-13T06:00:00Z",
    "npc": {
      "id": "jade",
      "name": "Jade",
      "avatar_url": "https://cdn.example.com/npc/jade.png",
      "voice_id": "jade-ko-01"
    },
    "scene": {
      "background_url": "https://cdn.example.com/scenes/market.webp",
      "bgm_url": "https://cdn.example.com/audio/market.mp3"
    },
    "nodes": [
      {
        "id": "intro",
        "type": "dialogue",
        "speaker": "npc",
        "text": "시장 미션을 시작해 볼까요?",
        "audio_url": "https://cdn.example.com/audio/intro.mp3",
        "next_node_id": "q101"
      },
      {
        "id": "q101",
        "type": "question",
        "q_idx": 101,
        "text": "첫 번째 재료를 찾기 위한 문제예요.",
        "audio_url": "https://cdn.example.com/audio/q101-intro.mp3",
        "tts_text": "첫 번째 재료를 찾기 위한 문제예요.",
        "hint_text": "질문의 핵심 단어를 다시 확인해 보세요.",
        "correct_next_node_id": "q101-correct",
        "incorrect_next_node_id": "q101-retry"
      },
      {
        "id": "q101-correct",
        "type": "dialogue",
        "speaker": "npc",
        "text": "정확해요! 다음 장소로 이동할게요.",
        "next_node_id": "ending"
      },
      {
        "id": "q101-retry",
        "type": "dialogue",
        "speaker": "npc",
        "text": "이 문제는 복습 목록에 담아 둘게요.",
        "next_node_id": "ending"
      },
      {
        "id": "ending",
        "type": "ending",
        "text": "오늘의 미션을 완료했어요!"
      }
    ]
  }
}
```

camelCase와 snake_case는 모두 허용되지만 원천 API는 snake_case 사용을 권장한다.

## 노드 규칙

| type | 필수 필드 | 동작 |
|---|---|---|
| `dialogue` | `id`, `speaker`, `text`, `next_node_id` | NPC 또는 학생 대화 후 다음 노드로 이동 |
| `question` | `id`, `q_idx`, `correct_next_node_id`, `incorrect_next_node_id` | 기존 Quick Check 문항을 표시하고 Parent 채점 결과로 분기. 선택 사항인 `audio_url`은 문제 안내 음성, `tts_text`는 음성 실패 시 TTS 대체 문구 |
| `ending` | `id`, `text` | 전체 문항 제출 및 결과 화면 진입 |

`question` 노드는 실행 시 조회된 Quick Check의 모든 `q_idx`를 정확히 한 번씩 참조해야 한다. `correctAnswer`, `rightAnswer`, `selectedNum` 등 정답 필드는 시나리오에 포함하지 않는다.

## 게시 전 검증

- `book_idx`, `day_idx`, `act_idx`가 요청 scope와 일치해야 한다.
- `scenario_id`, node `id`는 게시 version 내에서 변경되지 않는 안정적인 ID여야 한다.
- 시작 노드와 모든 참조 노드가 실제로 존재해야 한다.
- 중복 node ID와 중복 `q_idx`를 허용하지 않는다.
- 모든 노드는 시작 노드에서 도달 가능해야 한다.
- 모든 실행 경로는 하나 이상의 `ending`에 도달할 수 있어야 한다.
- 답변이 이미 저장된 문항으로 재진입하지 않도록 실행 경로의 순환을 허용하지 않는다.
- 최대 노드 수는 300개다.
- 리소스 URL은 HTTPS 또는 `/`로 시작하는 동일 출처 경로만 허용한다.
- AI 생성 결과는 `draft -> validation -> approved -> published` 절차를 거쳐야 한다.

검증에 실패한 시나리오는 Activity를 중단시키지 않고 기존 선형 Quick Check로 fallback한다.

## LearnEvent

시나리오 실행 시 다음 action을 추가 기록한다.

- `scenario_start`
- `dialogue_view`
- `scenario_node_view`
- `branch_taken`
- `scenario_complete`

`item_idx`는 Activity의 실제 `act_idx`를 사용한다. `scenario_id`, `scenario_version`, `node_id`, `to_node_id`, `outcome`은 `extra`에 저장한다. 문항·단어·문장의 기존 `q_idx`, `word_idx`, `sentence_idx` 기록 규칙은 변경하지 않는다.
