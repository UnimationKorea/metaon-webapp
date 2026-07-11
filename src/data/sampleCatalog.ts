import type { BookCatalog } from "../types/metaonTypes";

export const sampleCatalog: BookCatalog = {
  resultCode: 1,
  resultMessage: "sample",
  fetchedAt: new Date(0).toISOString(),
  brands: [
    {
      brandId: 10,
      brandName: "MetaOn",
      mainImageUrl: "",
      groups: []
    }
  ],
  groups: [
    {
      groupId: 2,
      groupName: "Speaking I",
      groupNumber: 140,
      appVersion: "2.2.25",
      brandId: 10,
      brandName: "MetaOn",
      seriesList: [
        {
          seriesGroup: 2,
          seriesIdx: 3,
          seriesName: "2A GuriGuri Chant",
          seriesNumber: 100,
          mainImageUrl: "MetaOn/SeriesImg/2/3/",
          icon1Url: "MetaOn/SeriesImg/2/3/icon_nor.png",
          icon2Url: "MetaOn/SeriesImg/2/3/icon_sel.png",
          appVersion: "2.2.25",
          books: [
            {
              seriesGroup: 2,
              seriesIdx: 3,
              bookIdx: 14,
              bookId: "2A010",
              bookName: "MongMong Chant",
              bookNumber: 1,
              lexile: "",
              bUrl: "MetaOn/BookData/2/3/",
              thumbnailUrl: "/api/books/2/3/2A010/thumbnail",
              themeId: 0,
              appVersion: "2.2.25"
            }
          ]
        }
      ]
    }
  ]
};

sampleCatalog.brands[0].groups = sampleCatalog.groups;
