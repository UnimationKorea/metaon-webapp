import { describe, expect, it } from "vitest";
import { buildBays, buildGradeBlocks, resolveMyBayIndex, splitRows } from "./StudyZonePage";
import type { BookData, BrandData } from "../types/metaonTypes";

function book(seriesGroup: number, seriesIdx: number, bookIdx: number, bookId: string): BookData {
  return {
    seriesGroup,
    seriesIdx,
    bookIdx,
    bookId,
    bookName: bookId,
    bookNumber: 1,
    lexile: "",
    bUrl: "",
    thumbnailUrl: "",
    themeId: 0,
    appVersion: "1"
  } as BookData;
}

function series(seriesGroup: number, seriesIdx: number, seriesName: string, count: number, base = 0) {
  return {
    seriesGroup,
    seriesIdx,
    seriesName,
    seriesNumber: 1,
    mainImageUrl: "",
    icon1Url: "",
    icon2Url: "",
    appVersion: "2.2.25",
    books: Array.from({ length: count }, (_, i) => book(seriesGroup, seriesIdx, base + i + 1, `${seriesName}-${i + 1}`))
  };
}

const razBrand: BrandData = {
  brandId: 21,
  brandName: "Raz-Kids(RHK)",
  mainImageUrl: "",
  groups: [
    {
      groupId: 6,
      groupName: "Raz-Kids Grade 1",
      groupNumber: 60,
      appVersion: "2.2.25",
      brandId: 21,
      brandName: "Raz-Kids(RHK)",
      seriesList: [series(6, 500, "Level F", 3, 0), series(6, 501, "Level G", 8, 10)]
    },
    {
      groupId: 7,
      groupName: "Raz-Kids Grade 2",
      groupNumber: 70,
      appVersion: "2.2.25",
      brandId: 21,
      brandName: "Raz-Kids(RHK)",
      seriesList: [series(7, 600, "Level H", 12, 100), series(7, 601, "Level I", 12, 200)]
    }
  ]
};

describe("Study Zone shelf helpers", () => {
  it("builds one bay per non-empty level, in grade→level order", () => {
    const bays = buildBays(razBrand);
    expect(bays.map((b) => `${b.gradeName}/${b.levelName}`)).toEqual([
      "Grade 1/Level F",
      "Grade 1/Level G",
      "Grade 2/Level H",
      "Grade 2/Level I"
    ]);
  });

  it("groups consecutive bays into grade minimap blocks", () => {
    const blocks = buildGradeBlocks(buildBays(razBrand));
    expect(blocks).toEqual([
      { label: "Grade 1", start: 0, end: 1 },
      { label: "Grade 2", start: 2, end: 3 }
    ]);
  });

  it("splits a level into two shelf rows only when it holds more than six books", () => {
    const bays = buildBays(razBrand);
    expect(splitRows(bays[0].books)).toHaveLength(1); // Level F: 3 books
    expect(splitRows(bays[2].books)).toHaveLength(2); // Level H: 12 books
    expect(splitRows(bays[2].books)[0]).toHaveLength(6);
  });

  it("anchors the current bay on the Placement Test level", () => {
    const bays = buildBays(razBrand);
    const index = resolveMyBayIndex(bays, razBrand, undefined, { grade: "2", level: "I" }, []);
    expect(bays[index].levelName).toBe("Level I");
  });

  it("prefers an explicit ?series= deep link over placement", () => {
    const bays = buildBays(razBrand);
    const index = resolveMyBayIndex(bays, razBrand, 600, { grade: "2", level: "I" }, []);
    expect(bays[index].levelName).toBe("Level H");
  });

  it("falls back to a recently-opened book's bay, then to the first bay", () => {
    const bays = buildBays(razBrand);
    const recentKey = `book:${bays[1].books[0].bookIdx}`; // a Level G book
    expect(bays[resolveMyBayIndex(bays, razBrand, undefined, undefined, [recentKey])].levelName).toBe("Level G");
    expect(resolveMyBayIndex(bays, razBrand, undefined, undefined, [])).toBe(0);
  });
});
