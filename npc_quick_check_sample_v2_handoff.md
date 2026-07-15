# QCNP01 Sample v2 Data Handoff

## Deliverable

`npc-quick-check_sample_v2_handoff.zip` contains the existing MP3 files and a
`scenario.draft.json` for each Book.

| Book code | Title | Source questions | Asset path |
| --- | --- | ---: | --- |
| `G1LG11` | Peace and Quiet | 5 | `G1LG11/npc-quiz/audio/` |
| `GPLB64` | What Flies in the Sky? | 5 | `GPLB64/npc-quiz/audio/` |

The draft is source data for the publishing service. Do not return it directly
from the QCNP01 scenario API because its scope and question bindings are not
resolved yet.

## S3 Upload Paths

Upload each asset without changing its relative path.

```text
https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/{BOOK_CODE}/npc-quiz/audio/{FILE}.mp3
```

For example:

```text
https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/G1LG11/npc-quiz/audio/opening.mp3
```

## Publishing Procedure

1. Resolve the actual `book_idx`, `day_idx`, and `act_idx` for the Book Day that has activity code `QCNP01`.
2. Fetch that Day's authoritative Quick Check questions from the learning API.
3. Resolve every `question_bindings[].source_question_id` to exactly one returned Quick Check `q_idx`.
4. Copy the resolved `q_idx` values into the matching `nodes[]` question nodes.
5. Replace the draft scope fields with the requested `book_idx`, `day_idx`, and `act_idx`.
6. Remove `question_bindings` and other `source_*` fields from the public API response. They are publishing metadata, not Viewer data.
7. Validate that all retrieved Quick Check `q_idx` values appear exactly once in scenario `nodes[]`, then publish.

`question_bindings` retains the original question text and choice text only to
make the source-to-`q_idx` mapping auditable. The Viewer must not receive or
use `source_correct_choice_index`; normal Quick Check server-side scoring
remains authoritative.

Each generated question node includes `audio_url` and `tts_text`. The Viewer
implementation must play `audio_url` when available and may use `tts_text`
only as an audio fallback. This preserves the supplied `q01_intro.mp3` through
`q05_intro.mp3` files without moving answer correctness into the client.

## Required API Response

The MetaOn BFF requests:

```http
GET {scenario-api}?book_idx={bookIdx}&day_idx={dayIdx}&act_idx={actIdx}
```

The scenario service must return the resolved graph in this envelope:

```json
{
  "resultCode": 1,
  "resultMessage": "success",
  "scenario": {
    "scenario_id": "g1lg11-npc-quiz-v1",
    "version": 1,
    "book_idx": 123,
    "day_idx": 456,
    "act_idx": 789,
    "start_node_id": "intro",
    "nodes": []
  }
}
```

`audio_url` values must be HTTPS URLs or root-relative URLs. Relative values
such as `audio/opening.mp3` are not valid QCNP01 API values.

## Validation Rules

- Every question node must have a positive `q_idx`.
- Scenario scope must exactly match the requested Book, Day, and Activity.
- Every active Quick Check `q_idx` must occur exactly once in the graph.
- The graph must have no cycle and all paths must reach an `ending` node.
- `correct_next_node_id` and `incorrect_next_node_id` must point to existing nodes.
- If bindings cannot be resolved, return `404` or `scenario: null`; the webapp will use the standard Quick Check fallback.
