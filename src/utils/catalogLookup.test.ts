import { describe, expect, it } from "vitest";
import { findBook, findSeries } from "./catalogLookup";
import type { BookCatalog } from "../types/metaonTypes";

const catalog: BookCatalog = {
  resultCode: 1,
  resultMessage: "OK",
  fetchedAt: "2026-06-25T00:00:00.000Z",
  brands: [],
  groups: [
    {
      groupId: 152,
      groupName: "Grade 2",
      groupNumber: 70,
      appVersion: "0.11",
      brandId: 11,
      brandName: "Raz-Kids(RHK)",
      seriesList: [
        {
          seriesGroup: 163,
          seriesIdx: 600,
          seriesName: "Level I",
          seriesNumber: 1,
          mainImageUrl: "",
          icon1Url: "",
          icon2Url: "",
          appVersion: "0.11",
          books: [
            {
              seriesGroup: 163,
              seriesIdx: 600,
              bookIdx: 1,
              bookId: "G2LI01",
              bookName: "A Broken Leg for Bonk",
              bookNumber: 1,
              lexile: "",
              bUrl: "BookData/",
              thumbnailUrl: "/api/books/163/600/G2LI01/thumbnail?v=0.11",
              themeId: 0,
              appVersion: "0.11"
            }
          ]
        }
      ]
    }
  ]
};

describe("catalogLookup", () => {
  it("finds books by Unity series group when it differs from the visible menu group", () => {
    expect(findSeries(catalog, 163, 600)?.seriesName).toBe("Level I");
    expect(findBook(catalog, 163, 600, "G2LI01")?.bookName).toBe("A Broken Leg for Bonk");
  });

  it("keeps the visible menu group route compatible", () => {
    expect(findSeries(catalog, 152, 600)?.seriesName).toBe("Level I");
  });
});
