import { describe, expect, it, vi } from "vitest";
import { discoverEbookResources } from "./ebookResourceDiscovery.mjs";

const manifest = {
  lessonDays: [
    {
      lesson: 1,
      day: 1,
      activities: [{ actType: 67, activityCode: "EBOOK01" }]
    }
  ],
  resources: [
    {
      path: "Lessons/L1/D1/reading/01/img/img_01.png",
      sourcePath: "/11/162/598/7191/63/63/reading/image/img_01.png",
      url: "https://example.test/reading/image/img_01.png",
      category: "reading"
    }
  ]
};

describe("discoverEbookResources", () => {
  it("adds an existing S3 ebook book.json to a listening day", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({
        "content-length": "29187",
        etag: '"ebook-etag"',
        "last-modified": "Fri, 10 Jul 2026 00:00:00 GMT"
      })
    });

    const result = await discoverEbookResources(manifest, {
      fetchImpl,
      bookDataBase: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData"
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData/11/162/598/7191/63/63/ebook/book.json",
      expect.objectContaining({ method: "HEAD" })
    );
    expect(result.resources).toContainEqual(
      expect.objectContaining({
        path: "Lessons/L1/D1/ebook/book.json",
        sourcePath: "/11/162/598/7191/63/63/ebook/book.json",
        category: "ebook",
        size: 29187,
        etag: '"ebook-etag"'
      })
    );
  });

  it("keeps the existing manifest when the S3 candidate is unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403, headers: new Headers() });

    const result = await discoverEbookResources(manifest, {
      fetchImpl,
      bookDataBase: "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData"
    });

    expect(result).toBe(manifest);
  });

  it("does not probe books without a listening activity", async () => {
    const fetchImpl = vi.fn();
    const result = await discoverEbookResources(
      {
        ...manifest,
        lessonDays: [{ lesson: 1, day: 1, activities: [{ actType: 1017, activityCode: "WDCA01" }] }]
      },
      { fetchImpl, bookDataBase: "https://example.test/MetaOn3/BookData" }
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.resources).toHaveLength(1);
  });
});
