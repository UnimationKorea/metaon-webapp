import type { BookData } from "../types/metaonTypes";
import { packageKeyForBook } from "./metaon3ResourceAdapter";

export function packageKeyFor(book: Pick<BookData, "bookIdx" | "seriesGroup" | "seriesIdx" | "bookId">): string {
  return packageKeyForBook(book);
}
