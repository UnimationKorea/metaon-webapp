import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "./catalogNormalizer";

describe("normalizeCatalog", () => {
  it("normalizes the MetaOn3 getMyBrands response shape", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      resultMessage: "성공",
      brands: [
        {
          brand_idx: 11,
          brand_name: "Raz Kids",
          order: 0,
          thumb_url: "/11/thumb_bd11.png",
          series_groups: [
            {
              sg_idx: 160,
              sg_name: "Grade Pre",
              order: 0,
              thumb_url: "/11/160/thumb_sg160.png",
              series: [
                {
                  series_idx: 591,
                  series_name: "aa",
                  order: 1,
                  thumb_url: "/11/160/591/thumb_sr591.png",
                  books: [
                    {
                      book_idx: 6710,
                      book_code: "GPLaa01",
                      title: "Over",
                      lexile: "BR110L",
                      order: 1,
                      thumb_url: "/11/160/591/6710/thumb6710.png"
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    expect(catalog.brands[0]).toMatchObject({
      brandId: 11,
      brandName: "Raz Kids"
    });
    expect(catalog.brands[0].groups[0]).toMatchObject({
      groupId: 160,
      groupName: "Grade Pre",
      brandId: 11
    });
    expect(catalog.brands[0].groups[0].seriesList[0].books[0]).toMatchObject({
      bookIdx: 6710,
      bookId: "GPLaa01",
      bookCode: "GPLaa01",
      bookName: "Over",
      seriesGroup: 160,
      seriesIdx: 591,
      thumbnailUrl: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/11/160/591/6710/thumb6710.png"
    });
  });

  it("normalizes the MetaOn /book/list brandlist response shape", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      resultMessage: "성공",
      brandlist: [
        {
          bdIdx: 10,
          bdName: "MetaOn Brand",
          mimgurl: "Brand/10/",
          sglist: [
            {
              sgIdx: 2,
              sgName: "Speaking I",
              sgNum: 140,
              aVer: "2.2.25",
              slist: [
                {
                  sgIdx: 2,
                  sIdx: 3,
                  sName: "2A GuriGuri Chant",
                  sNum: 100,
                  mimgurl: "MetaOn/SeriesImg/2/3/",
                  blist: [
                    {
                      sIdx: 3,
                      bIdx: 14,
                      bId: "2A010",
                      bName: "MongMong Chant",
                      bNum: 1,
                      bUrl: "MetaOn/BookData/2/3/",
                      bookVer: 4
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    expect(catalog.resultCode).toBe(1);
    expect(catalog.brands).toHaveLength(1);
    expect(catalog.brands[0]).toMatchObject({
      brandId: 10,
      brandName: "MetaOn Brand"
    });
    expect(catalog.brands[0].groups).toHaveLength(1);
    expect(catalog.groups[0]).toMatchObject({
      groupId: 2,
      groupName: "Speaking I",
      brandId: 10,
      brandName: "MetaOn Brand"
    });
    expect(catalog.groups[0].seriesList[0].books[0]).toMatchObject({
      seriesGroup: 2,
      seriesIdx: 3,
      bookIdx: 14,
      bookId: "2A010",
      bUrl: "MetaOn/BookData/2/3/",
      appVersion: "4"
    });
  });

  it("attaches top-level sgrouplist groups back to their brands", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brandlist: [
        {
          bdIdx: 21,
          bdName: "Raz-Kids(RHK)",
          mimgurl: "Brand/21/",
          sglist: []
        },
        {
          bdIdx: 22,
          bdName: "하이마이스쿨",
          mimgurl: "Brand/22/",
          sglist: []
        },
        {
          bdIdx: 23,
          bdName: "PlayNLearn Academy",
          mimgurl: "Brand/23/",
          sglist: []
        },
        {
          bdIdx: 24,
          bdName: "First Readers(RHK)",
          mimgurl: "Brand/24/",
          sglist: []
        }
      ],
      sgrouplist: [
        {
          bdIdx: 21,
          bdName: "Raz-Kids(RHK)",
          sgIdx: 7,
          sgName: "Raz-Kids Grade 2",
          sgNum: 70,
          slist: [{ sgIdx: 7, sIdx: 17, sName: "Grade 2", blist: [] }]
        },
        {
          bdIdx: 22,
          bdName: "하이마이스쿨",
          sgIdx: 31,
          sgName: "High My School 1",
          slist: [{ sgIdx: 31, sIdx: 310, sName: "Course 1", blist: [] }]
        },
        {
          bdIdx: 23,
          bdName: "PlayNLearn Academy",
          sgIdx: 41,
          sgName: "PlayNLearn Starter",
          slist: [{ sgIdx: 41, sIdx: 410, sName: "Starter", blist: [] }]
        },
        {
          bdIdx: 24,
          bdName: "First Readers(RHK)",
          sgIdx: 51,
          sgName: "First Readers Level 1",
          slist: [{ sgIdx: 51, sIdx: 510, sName: "Level 1", blist: [] }]
        }
      ]
    });

    expect(catalog.brands.map((brand) => [brand.brandName, brand.groups.map((group) => group.groupName)])).toEqual([
      ["Raz-Kids(RHK)", ["Raz-Kids Grade 2"]],
      ["하이마이스쿨", ["High My School 1"]],
      ["PlayNLearn Academy", ["PlayNLearn Starter"]],
      ["First Readers(RHK)", ["First Readers Level 1"]]
    ]);
    expect(catalog.groups).toHaveLength(4);
    expect(catalog.groups[0]).toMatchObject({
      brandId: 21,
      groupId: 7,
      seriesList: [{ seriesIdx: 17 }]
    });
  });

  it("infers brand groups from group names when group brand ids are missing", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brands: [
        { brandId: 21, brandName: "Raz-Kids(RHK)", groups: [] },
        { brandId: 22, brandName: "하이마이스쿨", groups: [] },
        { brandId: 23, brandName: "PlayNLearn Academy", groups: [] },
        { brandId: 24, brandName: "First Readers(RHK)", groups: [] }
      ],
      groups: [
        { groupId: 7, groupName: "Raz-Kids Grade 2", seriesList: [] },
        { groupId: 31, groupName: "하이마이스쿨 Level 1", seriesList: [] },
        { groupId: 41, groupName: "PlayNLearn Starter", seriesList: [] },
        { groupId: 51, groupName: "First Readers Level 1", seriesList: [] }
      ]
    });

    expect(catalog.brands.map((brand) => [brand.brandName, brand.groups.map((group) => group.groupName)])).toEqual([
      ["Raz-Kids(RHK)", ["Raz-Kids Grade 2"]],
      ["하이마이스쿨", ["하이마이스쿨 Level 1"]],
      ["PlayNLearn Academy", ["PlayNLearn Starter"]],
      ["First Readers(RHK)", ["First Readers Level 1"]]
    ]);
    expect(catalog.brands.every((brand) => brand.groups.length === 1)).toBe(true);
  });

  it("attaches top-level groups that use alternate brand id keys", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brandlist: [
        { bdId: 21, bdName: "Raz-Kids(RHK)", sglist: [] },
        { brandIdx: 22, bdName: "하이마이스쿨", sglist: [] },
        { brand_id: 23, bdName: "PlayNLearn Academy", sglist: [] },
        { brandid: 24, bdName: "First Readers(RHK)", sglist: [] }
      ],
      sgrouplist: [
        { brandIdx: 21, sgIdx: 7, sgName: "Grade 2", slist: [] },
        { brand_id: 22, sgIdx: 31, sgName: "Level 1", slist: [] },
        { bdId: 23, sgIdx: 41, sgName: "Starter", slist: [] },
        { brandid: 24, sgIdx: 51, sgName: "Level 1", slist: [] }
      ]
    });

    expect(catalog.brands.map((brand) => [brand.brandId, brand.brandName, brand.groups.map((group) => group.groupId)])).toEqual([
      [21, "Raz-Kids(RHK)", [7]],
      [22, "하이마이스쿨", [31]],
      [23, "PlayNLearn Academy", [41]],
      [24, "First Readers(RHK)", [51]]
    ]);
  });

  it("merges package list groups into matching empty brands", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brandlist: [
        { bdIdx: 21, bdName: "Raz-Kids(RHK)", sglist: [] },
        { bdIdx: 22, bdName: "하이마이스쿨", sglist: [] },
        { bdIdx: 23, bdName: "PlayNLearn Academy", sglist: [] },
        { bdIdx: 24, bdName: "First Readers(RHK)", sglist: [] }
      ],
      sgrouplist: [
        {
          sgIdx: 7,
          sgName: "Grade 2",
          slist: [
            { sgIdx: 7, sIdx: 700, sName: "Placement", sNum: 1, blist: [] },
            { sgIdx: 7, sIdx: 701, sName: "Level K", sNum: 2, blist: [] },
            { sgIdx: 7, sIdx: 702, sName: "Review", sNum: 3, blist: [] }
          ]
        }
      ],
      plist: [
        {
          pkgidx: 901,
          pkgname: "Raz-Kids",
          sglist: [
            {
              pkgsgidx: 7,
              pkgsgname: "Grade 2",
              pkgsgnum: 70,
              slist: [
                {
                  pkgsridx: 701,
                  pkgsrname: "Level K",
                  pkgsrnum: 1,
                  wlist: [
                    {
                      pkgwkidx: 7001,
                      blist: [
                        {
                          sgidx: 7,
                          sidx: 701,
                          bidx: 70001,
                          bid: "G2LI01",
                          bname: "Raz Book",
                          bver: "3.0.0"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          pkgidx: 902,
          pkgname: "하이마이스쿨",
          sglist: [{ pkgsgidx: 31, pkgsgname: "Level 1", slist: [] }]
        },
        {
          pkgidx: 903,
          pkgname: "PlayNLearn",
          sglist: [{ pkgsgidx: 41, pkgsgname: "Starter", slist: [] }]
        },
        {
          pkgidx: 904,
          pkgname: "First Readers",
          sglist: [{ pkgsgidx: 51, pkgsgname: "Level 1", slist: [] }]
        }
      ]
    });

    expect(catalog.brands.map((brand) => [brand.brandName, brand.groups.map((group) => group.groupId)])).toEqual([
      ["Raz-Kids(RHK)", [7]],
      ["하이마이스쿨", [31]],
      ["PlayNLearn Academy", [41]],
      ["First Readers(RHK)", [51]]
    ]);
    const razSeries = catalog.brands[0].groups[0].seriesList.find((series) => series.seriesIdx === 701);
    expect(catalog.brands[0].groups[0].seriesList).toHaveLength(3);
    expect(razSeries?.books[0]).toMatchObject({
      bookId: "G2LI01",
      bookName: "Raz Book",
      bUrl: "MetaOn/BookData/7/701/",
      thumbnailUrl: "/api/books/7/701/G2LI01/thumbnail?v=3.0.0"
    });
  });

  it("keeps groups with the same id separate when their brand scope differs", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brandlist: [
        {
          bdIdx: 2,
          bdName: "코스북",
          sglist: [
            {
              sgIdx: 12,
              sgName: "Course 2",
              slist: [{ sgIdx: 12, sIdx: 1201, sName: "Course Month 1", blist: [] }]
            }
          ]
        },
        { bdIdx: 3, bdName: "Phonics", sglist: [] }
      ],
      plist: [
        {
          pkgname: "Phonics",
          sglist: [
            {
              pkgsgidx: 12,
              pkgsgname: "Phonics Level 2",
              slist: [
                {
                  pkgsridx: 79,
                  pkgsrname: "1월",
                  wlist: [
                    {
                      blist: [
                        {
                          sgidx: 20,
                          sidx: 137,
                          bidx: 940,
                          bid: "PHOFREN2_1",
                          bname: "am, an",
                          burl: "BookData/",
                          bver: "0.11"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    const coursebook = catalog.brands.find((brand) => brand.brandName === "코스북");
    const phonics = catalog.brands.find((brand) => brand.brandName === "Phonics");

    expect(coursebook?.groups.map((group) => [group.groupId, group.groupName, group.brandName])).toEqual([[12, "Course 2", "코스북"]]);
    expect(phonics?.groups.map((group) => [group.groupId, group.groupName, group.brandName])).toEqual([[12, "Phonics Level 2", "Phonics"]]);
    expect(phonics?.groups[0].seriesList[0].books[0]).toMatchObject({
      bookId: "PHOFREN2_1",
      thumbnailUrl: "/api/books/20/137/PHOFREN2_1/thumbnail?v=0.11"
    });
  });

  it("hydrates brand group references from top-level sgrouplist details", () => {
    const catalog = normalizeCatalog({
      resultCode: 1,
      brandlist: [
        {
          bdIdx: 30,
          bdName: "Coursebook",
          sglist: [101, "102"]
        },
        {
          bdIdx: 31,
          bdName: "Phonics",
          sglist: [201, "202", 203, "204"]
        }
      ],
      sgrouplist: [
        {
          sgIdx: 101,
          sgName: "Course 1",
          slist: [
            {
              sgIdx: 101,
              sIdx: 1001,
              sName: "Course 1",
              blist: [
                {
                  bId: "C101",
                  bName: "Course 1 Book",
                  bUrl: "MetaOn/BookData/101/1001/",
                  bookVer: "1.2.3"
                }
              ]
            }
          ]
        },
        { sgIdx: 102, sgName: "Course 2", slist: [] },
        { sgIdx: 201, sgName: "Phonics Level 1", slist: [] },
        { sgIdx: 202, sgName: "Phonics Level 2", slist: [] },
        { sgIdx: 203, sgName: "Phonics Level 3", slist: [] },
        { sgIdx: 204, sgName: "Phonics Level 4", slist: [] }
      ]
    });

    expect(catalog.brands[0].groups.map((group) => group.groupName)).toEqual(["Course 1", "Course 2"]);
    expect(catalog.brands[1].groups.map((group) => group.groupName)).toEqual([
      "Phonics Level 1",
      "Phonics Level 2",
      "Phonics Level 3",
      "Phonics Level 4"
    ]);
    expect(catalog.brands[0].groups[0].seriesList[0].books[0]).toMatchObject({
      bookId: "C101",
      thumbnailUrl: "/api/books/101/1001/C101/thumbnail?v=1.2.3"
    });
  });
});
