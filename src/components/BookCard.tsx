import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { unityMenuAssets } from "../services/unityAppAssets";
import type { BookData } from "../types/metaonTypes";

export function BookCard({ book }: { book: BookData }) {
  const preferredCoverUrl = book.thumbnailUrl || unityMenuAssets.bookStrip;
  const [coverUrl, setCoverUrl] = useState(preferredCoverUrl);

  useEffect(() => {
    setCoverUrl(preferredCoverUrl);
  }, [preferredCoverUrl]);

  return (
    <Link className="book-card" to={`/books/${book.seriesGroup}/${book.seriesIdx}/${book.bookId}`}>
      <div className="book-cover">
        <img
          src={coverUrl}
          alt=""
          onError={(event) => {
            if (event.currentTarget.src !== new URL(unityMenuAssets.bookStrip, window.location.origin).href) {
              setCoverUrl(unityMenuAssets.bookStrip);
            }
          }}
        />
        <span className="book-title-overlay">{book.bookName}</span>
      </div>
    </Link>
  );
}
