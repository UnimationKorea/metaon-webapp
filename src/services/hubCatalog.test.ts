import { describe, expect, it } from "vitest";
import { getHubBooks, getHubBrands, percent, routeForActivity, routeForPlacementRecommendation } from "./hubCatalog";
import type { BookCatalog } from "../types/metaonTypes";

const catalog: BookCatalog = {
  resultCode: 1,
  resultMessage: "ok",
  fetchedAt: "2026-06-26T00:00:00.000Z",
  brands: [
    {
      brandId: 2,
      brandName: "코스북",
      mainImageUrl: "",
      groups: [
        {
          groupId: 11,
          groupName: "Course 1",
          groupNumber: 1,
          appVersion: "2.2.25",
          brandId: 2,
          brandName: "코스북",
          seriesList: [
            {
              seriesGroup: 11,
              seriesIdx: 101,
              seriesName: "Month 1",
              seriesNumber: 1,
              mainImageUrl: "",
              icon1Url: "",
              icon2Url: "",
              appVersion: "2.2.25",
              books: [
                {
                  seriesGroup: 11,
                  seriesIdx: 101,
                  bookIdx: 1,
                  bookId: "BK01",
                  bookName: "Book One",
                  bookNumber: 1,
                  lexile: "",
                  bUrl: "MetaOn/BookData/11/101/",
                  thumbnailUrl: "/api/books/11/101/BK01/thumbnail?v=1",
                  themeId: 0,
                  appVersion: "1"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  groups: []
};

describe("hubCatalog", () => {
  it("maps real MetaOn catalog data into hub brands and books", () => {
    const brands = getHubBrands(catalog);
    const books = getHubBooks(catalog);

    expect(brands).toHaveLength(1);
    expect(brands[0]).toMatchObject({
      id: "2",
      name: "코스북",
      bookCount: 1
    });
    expect(books[0]).toMatchObject({
      key: "book:1",
      book: { bookId: "BK01", bookName: "Book One" },
      group: { groupName: "Course 1" },
      series: { seriesName: "Month 1" }
    });
  });

  it("keeps activity routes compatible with the existing runtime route", () => {
    expect(routeForActivity(catalog.brands[0].groups[0].seriesList[0].books[0], { id: "978", dayIdx: 978 }, { actIdx: 12881, actNum: 0 })).toBe(
      "/activity/1/978/12881"
    );
  });

  it("calculates progress percentage defensively", () => {
    expect(percent(1, 4)).toBe(25);
    expect(percent(3, 0)).toBe(0);
  });

  it("routes placement recommendations into the matching Raz-Kids grade and level", () => {
    const razCatalog: BookCatalog = {
      ...catalog,
      brands: [
        ...catalog.brands,
        {
          brandId: 21,
          brandName: "Raz-Kids(RHK)",
          mainImageUrl: "",
          groups: [
            {
              groupId: 7,
              groupName: "Raz-Kids Grade 2",
              groupNumber: 70,
              appVersion: "2.2.25",
              brandId: 21,
              brandName: "Raz-Kids(RHK)",
              seriesList: [
                {
                  seriesGroup: 7,
                  seriesIdx: 600,
                  seriesName: "Level H",
                  seriesNumber: 1,
                  mainImageUrl: "",
                  icon1Url: "",
                  icon2Url: "",
                  appVersion: "2.2.25",
                  books: [
                    {
                      seriesGroup: 7,
                      seriesIdx: 600,
                      bookIdx: 9001,
                      bookId: "G2LH01",
                      bookName: "Level H Book",
                      bookNumber: 1,
                      lexile: "",
                      bUrl: "MetaOn/BookData/7/600/",
                      thumbnailUrl: "",
                      themeId: 0,
                      appVersion: "1"
                    }
                  ]
                },
                {
                  seriesGroup: 7,
                  seriesIdx: 601,
                  seriesName: "Level I",
                  seriesNumber: 2,
                  mainImageUrl: "",
                  icon1Url: "",
                  icon2Url: "",
                  appVersion: "2.2.25",
                  books: [
                    {
                      seriesGroup: 7,
                      seriesIdx: 601,
                      bookIdx: 9002,
                      bookId: "G2LI01",
                      bookName: "Level I Book",
                      bookNumber: 1,
                      lexile: "",
                      bUrl: "MetaOn/BookData/7/601/",
                      thumbnailUrl: "",
                      themeId: 0,
                      appVersion: "1"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      groups: []
    };

    expect(routeForPlacementRecommendation(razCatalog, { grade: "2", level: "I" })).toBe(
      "/study?brand=21&group=7&series=601&book=9002&menu=1"
    );
  });
});
