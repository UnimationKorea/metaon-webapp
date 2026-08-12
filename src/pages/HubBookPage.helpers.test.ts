import { describe, expect, it } from "vitest";
import {
  buildTrailLinks,
  buildTrailPoints,
  computeTrailColumns,
  isActivityResourceReady,
  trailPathWidth,
  trailRowCount
} from "./HubBookPage";
import { ActType } from "../types/metaonTypes";
import type { Activity, LessonDay } from "../types/metaonTypes";

const day = { id: "1:1", lesson: 1, day: 1, title: "L1 D1", activities: [] } as unknown as LessonDay;

function activity(activityCode: string): Activity {
  return { id: activityCode, activityCode, actType: ActType.QuickCheck, title: activityCode, actNum: 0 };
}

describe("isActivityResourceReady", () => {
  it("always lists non-NPC activities", () => {
    expect(isActivityResourceReady(activity("WDCA01"), day, [])).toBe(true);
    expect(isActivityResourceReady(activity("QCHK01"), day, undefined)).toBe(true);
  });

  it("hides an NPC activity when its script.json was not cached", () => {
    expect(isActivityResourceReady(activity("NPCQHK01"), day, [])).toBe(false);
    expect(isActivityResourceReady(activity("NPCQHK02"), day, ["Lessons/L1/D1/npcqhk/script.json"])).toBe(false);
  });

  it("shows an NPC activity when its own script.json is present", () => {
    expect(isActivityResourceReady(activity("NPCQHK01"), day, ["Lessons/L1/D1/npcqhk/script.json"])).toBe(true);
    expect(isActivityResourceReady(activity("NPCQHK02"), day, ["Lessons/L1/D1/npcqhk2/script.json"])).toBe(true);
  });

  it("does not filter when the package predates script-path tracking", () => {
    expect(isActivityResourceReady(activity("NPCQHK01"), day, undefined)).toBe(true);
  });
});

describe("buildTrailPoints", () => {
  it("spaces stones evenly along the path", () => {
    const points = buildTrailPoints(5);
    expect(points).toHaveLength(5);
    const gaps = points.slice(1).map((point, i) => point.x - points[i].x);
    expect(new Set(gaps).size).toBe(1); // uniform horizontal spacing
    expect(points[0].x).toBe(166); // one turn lane plus half a slot, so the first stone is not clipped
  });

  it("bows the middle of the path away from the camera", () => {
    const points = buildTrailPoints(5);
    const ys = points.map((point) => point.y);
    // Smaller y = further back. The middle stone is the furthest; the ends are nearest and level.
    expect(Math.min(...ys)).toBe(ys[2]);
    expect(ys[0]).toBe(ys[4]);
    expect(ys[0]).toBeGreaterThan(ys[1]);
    expect(ys[1]).toBeGreaterThan(ys[2]);
  });

  it("handles degenerate counts without dividing by zero", () => {
    expect(buildTrailPoints(0)).toEqual([]);
    expect(buildTrailPoints(1)).toHaveLength(1);
    expect(Number.isFinite(buildTrailPoints(1)[0].y)).toBe(true);
  });

  it("keeps every stone inside the path box for a long day", () => {
    const points = buildTrailPoints(8);
    expect(points).toHaveLength(8);
    expect(points.every((point) => point.y > 0 && Number.isFinite(point.x))).toBe(true);
  });
});

describe("computeTrailColumns", () => {
  it("never puts out more stones than the width can hold once turn lanes are reserved", () => {
    // 700px − 180px of turn lanes leaves 520px, so 3 stones fit and a 4th does not.
    expect(computeTrailColumns(700, 8)).toBe(3);
  });

  it("wraps a long day even when the screen could fit it all on one line", () => {
    // A landscape tablet has room for nine in a row; the cap wraps them anyway.
    expect(computeTrailColumns(1600, 9)).toBeLessThanOrEqual(5);
    expect(computeTrailColumns(1600, 9)).toBe(5); // 5 + 4
    expect(computeTrailColumns(1600, 12)).toBe(4); // 4 + 4 + 4
  });

  it("evens the rows out instead of leaving a stub", () => {
    expect(computeTrailColumns(1600, 6)).toBe(3); // 3 + 3, not 5 + 1
    expect(computeTrailColumns(1600, 8)).toBe(4); // 4 + 4, not 5 + 3
    expect(computeTrailColumns(1600, 10)).toBe(5); // 5 + 5
  });

  it("leaves a short day on one line", () => {
    expect(computeTrailColumns(1600, 3)).toBe(3);
    expect(computeTrailColumns(1600, 5)).toBe(5);
  });

  it("keeps at least one column on a very narrow screen", () => {
    expect(computeTrailColumns(90, 6)).toBe(1);
    expect(computeTrailColumns(200, 6)).toBe(1);
  });

  it("still wraps before the scene has been measured", () => {
    expect(computeTrailColumns(0, 6)).toBe(3);
    expect(computeTrailColumns(Number.NaN, 9)).toBe(5);
  });
});

describe("trailPathWidth", () => {
  it("reserves a turn lane on each flank", () => {
    expect(trailPathWidth(4, 8)).toBe(4 * 152 + 180);
    expect(trailPathWidth(8, 3)).toBe(3 * 152 + 180); // never wider than the stones present
  });
});

describe("trailRowCount", () => {
  it("counts the rows a wrapped walk needs", () => {
    expect(trailRowCount(8, 4)).toBe(2);
    expect(trailRowCount(7, 3)).toBe(3); // trailing row is partly filled
    expect(trailRowCount(8, 8)).toBe(1);
    expect(trailRowCount(0, 4)).toBe(1);
  });
});

describe("buildTrailPoints — wrapping", () => {
  it("runs odd rows right→left so the walk snakes instead of jumping back", () => {
    const points = buildTrailPoints(8, 4);
    const row0 = points.slice(0, 4).map((point) => point.x);
    const row1 = points.slice(4).map((point) => point.x);
    expect(points.map((point) => point.row)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
    expect(row0).toEqual([...row0].sort((a, b) => a - b)); // left → right
    expect(row1).toEqual([...row1].sort((a, b) => b - a)); // right → left
    expect(row1[0]).toBe(row0[3]); // the turn happens in place, straight down
  });

  it("stacks rows down the scene", () => {
    const points = buildTrailPoints(8, 4);
    expect(points[4].y - points[0].y).toBe(244);
  });

  it("keeps a partly filled last row starting under the previous turn", () => {
    const points = buildTrailPoints(7, 3);
    expect(points.map((point) => point.row)).toEqual([0, 0, 0, 1, 1, 1, 2]);
    expect(points[6].x).toBe(points[5].x); // stone 7 drops straight below stone 6
  });

  it("falls back to a single column without dividing by zero", () => {
    const points = buildTrailPoints(3, 1);
    expect(points.map((point) => point.x)).toEqual([166, 166, 166]); // 90px turn lane + half a slot
    expect(points.map((point) => point.row)).toEqual([0, 1, 2]);
  });

  it("insets every stone by the turn lane so the U-turns have room", () => {
    expect(buildTrailPoints(4, 4).map((point) => point.x)).toEqual([166, 318, 470, 622]);
  });

  it("keeps rows far enough apart that a plaque groups with its own stone", () => {
    // A plaque occupies the top 67px of its 152×196 slot, whose stone sits at 118px less the state
    // lift (2px when locked — the tightest case). So the gap down to its own stone is 49px, and a
    // wrapped row must sit further below the stone above it than that or the label reads as the
    // wrong stone's. Measured in the browser before this spacing was raised: 18px vs 49px.
    const gapToOwnStone = 118 - 2 - 67;
    const points = buildTrailPoints(8, 4);
    const stoneAboveBottom = points[3].y - 172 + 12; // previous row's stone, completed lift
    const gapToStoneAbove = points[4].y - 150 - stoneAboveBottom;
    expect(gapToOwnStone).toBe(49);
    expect(gapToStoneAbove).toBeGreaterThan(gapToOwnStone);
  });
});

describe("buildTrailLinks", () => {
  it("joins every consecutive pair of stones", () => {
    expect(buildTrailLinks(buildTrailPoints(5))).toHaveLength(4);
    expect(buildTrailLinks(buildTrailPoints(1))).toEqual([]);
    expect(buildTrailLinks([])).toEqual([]);
  });

  it("turns through an arc at a row change instead of hopping straight down", () => {
    const points = buildTrailPoints(8, 4);
    const links = buildTrailLinks(points);
    const turn = links[3]; // stone 4 → stone 5, the row change
    expect(links.filter((link) => link.kind === "turn")).toHaveLength(1);
    expect(turn.kind).toBe("turn");
    expect(turn.width).toBe(90);
  });

  it("starts and ends the turn on the waterline ring, not the middle of the stone", () => {
    const points = buildTrailPoints(8, 4);
    const turn = buildTrailLinks(points)[3];
    // Even rows run left→right, so the U opens at the right edge of the ring — 68px out from the
    // stone's centre and 26px below it, which is that ring's rightmost point.
    expect(turn.side).toBe("right");
    expect(turn.left).toBe(points[3].x + 68);
    expect(turn.top).toBe(points[3].y + 26);
    // ...and closes on the next stone's ring, level with it, so both ends touch a ring edge.
    expect(turn.top + turn.height).toBe(points[4].y + 26);
  });

  it("still reaches past the plaque above the next stone", () => {
    const points = buildTrailPoints(8, 4);
    const turn = buildTrailLinks(points)[3];
    // The far side of the U has to clear the 74px half-width of the plaque it would otherwise hide behind.
    expect(turn.left + turn.width - points[3].x).toBeGreaterThan(74);
  });

  it("alternates the turn side so the walk snakes", () => {
    const points = buildTrailPoints(12, 4);
    const turns = buildTrailLinks(points).filter((link) => link.kind === "turn");
    expect(turns.map((turn) => turn.side)).toEqual(["right", "left"]);
    const [, leftTurn] = turns;
    // Mirrored: opens at the left edge of the ring and bulges further left.
    expect(leftTurn.left + leftTurn.width).toBe(points[7].x - 68);
    expect(points[7].x - leftTurn.left).toBeGreaterThan(74);
  });

  it("trims a straight link to the stone's ellipse", () => {
    const points = buildTrailPoints(8, 4);
    const links = buildTrailLinks(points);
    const trim = Math.hypot(links[0].left - points[0].x, links[0].top - points[0].y);
    // Stones inside a row sit on the arc, so the link is tilted and stops short of the 62px
    // semi-major axis but well past the 27px semi-minor one.
    expect(links[0].kind).toBe("straight");
    expect(trim).toBeGreaterThan(50);
    expect(trim).toBeLessThan(62);
  });

  it("never renders a negative-size link", () => {
    const links = buildTrailLinks(buildTrailPoints(6, 2));
    expect(links.every((link) => link.width >= 0 && link.height >= 0)).toBe(true);
  });
});
