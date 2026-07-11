import type { BookCatalog, BookData, BrandData, SeriesData, SeriesGroup } from "../types/metaonTypes";

type UnknownRecord = Record<string, unknown>;

export const METAON3_BOOKDATA_BASE = "https://metaon.s3.ap-northeast-2.amazonaws.com/MetaOn3/BookData";

export function normalizeCatalog(raw: unknown): BookCatalog {
  const source = asRecord(raw);
  const rawBrands = firstArray(source.brandlist, source.brandList, source.brands);
  const normalizedBrands =
    rawBrands.length > 0
      ? rawBrands.map(normalizeBrand)
      : firstArray(source.brands).map((brand) => normalizeBrandFromNormalized(brand));
  const rawGroups = firstArray(source.sgrouplist, source.sgroupList, source.seriesGroup, source.groups);
  const rawPackages = firstArray(source.plist, source.packageList, source.packagelist, source.packages);
  const packageGroups = rawPackages.flatMap(normalizePackageGroups);
  const groups = mergeGroups([
    ...rawGroups.map(normalizeGroup),
    ...normalizedBrands.flatMap((brand) => brand.groups),
    ...packageGroups
  ]);
  const brands = attachGroupsToBrands(normalizedBrands, groups);

  return {
    resultCode: numberValue(source.resultCode),
    resultMessage: stringValue(source.resultMessage),
    fetchedAt: stringValue(source.fetchedAt) || new Date().toISOString(),
    brands: brands.length > 0 ? brands : deriveBrands(groups),
    groups
  };
}

function normalizePackageGroups(rawPackage: unknown): SeriesGroup[] {
  const packageData = asRecord(rawPackage);
  const packageName = stringValue(packageData.pkgname ?? packageData.pkgName ?? packageData.packageName ?? packageData.name);
  const mainImageUrl = stringValue(packageData.mimgurl ?? packageData.mainImageUrl);
  return firstArray(packageData.sglist, packageData.sgList, packageData.pkgsglist, packageData.pkgsgList, packageData.packageGroups, packageData.groups).map((group) =>
    normalizePackageGroup(group, packageName, mainImageUrl)
  );
}

function normalizePackageGroup(rawGroup: unknown, packageName: string, mainImageUrl: string): SeriesGroup {
  const group = asRecord(rawGroup);
  const groupId = readGroupId(rawGroup);
  const appVersion = stringValue(group.aver ?? group.aVer ?? group.appversion ?? group.appVersion);
  const seriesList = firstArray(group.slist, group.serieslist, group.seriesList).map((series) =>
    normalizePackageSeries(series, groupId, appVersion)
  );

  return {
    groupId,
    groupName: stringValue(group.pkgsgname ?? group.pkgsgName ?? group.sgName ?? group.sgroupName ?? group.groupName),
    groupNumber: numberValue(group.pkgsgnum ?? group.pkgsgNum ?? group.sgNum ?? group.sgroupNum ?? group.groupNum ?? group.groupNumber),
    appVersion,
    brandId: 0,
    brandName: packageName,
    mainImageUrl: stringValue(group.mimgurl ?? group.mainImageUrl ?? mainImageUrl),
    seriesList
  };
}

function normalizePackageSeries(rawSeries: unknown, groupId: number, groupVersion: string): SeriesData {
  const series = asRecord(rawSeries);
  const seriesIdx = readSeriesIdx(rawSeries);
  const appVersion = stringValue(series.aver ?? series.aVer ?? series.appversion ?? series.appVersion) || groupVersion;
  const books = collectPackageBooks(rawSeries).map((book) => normalizeBook(book, groupId, seriesIdx || readSeriesIdx(book), appVersion));

  return {
    seriesGroup: groupId,
    seriesIdx,
    seriesName: stringValue(series.pkgsrname ?? series.pkgsrName ?? series.sName ?? series.seriesName),
    seriesNumber: numberValue(series.pkgsrnum ?? series.pkgsrNum ?? series.sNum ?? series.seriesNum ?? series.seriesNumber),
    mainImageUrl: stringValue(series.mimgurl ?? series.mainImageUrl),
    icon1Url: stringValue(series.icon1url ?? series.icon1Url),
    icon2Url: stringValue(series.icon2url ?? series.icon2Url),
    appVersion,
    books
  };
}

function collectPackageBooks(value: unknown, seen = new Set<unknown>()): unknown[] {
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);

  const source = asRecord(value);
  const directBooks = firstArray(source.blist, source.booklist, source.bookList, source.books);
  if (directBooks.length > 0 && directBooks.some((book) => readBookId(book))) {
    return directBooks;
  }

  const nested: unknown[] = [];
  for (const item of Object.values(source)) {
    if (Array.isArray(item)) {
      for (const child of item) nested.push(...collectPackageBooks(child, seen));
    } else {
      nested.push(...collectPackageBooks(item, seen));
    }
  }
  return nested;
}

function normalizeBrand(rawBrand: unknown): BrandData {
  const brand = asRecord(rawBrand);
  const brandId = readBrandId(rawBrand);
  const brandName = readBrandName(rawBrand, true);
  const mainImageUrl = assetUrl(stringValue(brand.mimgurl ?? brand.mainImageUrl ?? brand.thumb_url ?? brand.thumbUrl));
  const groups = firstArray(brand.sglist, brand.sgList, brand.sgrouplist, brand.sgroupList, brand.series_groups, brand.seriesGroups, brand.seriesGroup, brand.groups).map((group) =>
    normalizeBrandGroup(group, brandId, brandName, mainImageUrl)
  );

  return {
    brandId,
    brandName,
    mainImageUrl,
    groups
  };
}

function normalizeBrandFromNormalized(rawBrand: unknown): BrandData {
  const brand = asRecord(rawBrand);
  const brandId = readBrandId(rawBrand);
  const brandName = readBrandName(rawBrand, true);
  const mainImageUrl = assetUrl(stringValue(brand.mainImageUrl ?? brand.mimgurl ?? brand.thumb_url ?? brand.thumbUrl));
  const groups = firstArray(brand.groups, brand.sglist, brand.sgList, brand.sgrouplist, brand.sgroupList, brand.series_groups, brand.seriesGroups, brand.seriesGroup).map((group) =>
    normalizeBrandGroup(group, brandId, brandName, mainImageUrl)
  );

  return {
    brandId,
    brandName,
    mainImageUrl,
    groups
  };
}

function normalizeBrandGroup(rawGroup: unknown, brandId: number, brandName: string, mainImageUrl: string): SeriesGroup {
  const groupId = readGroupId(rawGroup);
  return normalizeGroup({
    ...(groupId ? { sgIdx: groupId } : {}),
    ...asRecord(rawGroup),
    brandId,
    brandName,
    brandImageUrl: mainImageUrl
  });
}

function normalizeGroup(rawGroup: unknown): SeriesGroup {
  const group = asRecord(rawGroup);
  const groupId = readGroupId(rawGroup);
  const appVersion = stringValue(group.aVer ?? group.aver ?? group.appversion ?? group.appVersion);
  const seriesList = firstArray(group.slist, group.serieslist, group.seriesList, group.series).map((series) =>
    normalizeSeries(series, groupId, appVersion)
  );

  return {
    groupId,
    groupName: stringValue(group.sgName ?? group.sgroupName ?? group.groupName ?? group.sg_name),
    groupNumber: numberValue(group.sgNum ?? group.sgroupNum ?? group.groupNum ?? group.groupNumber ?? group.order),
    appVersion,
    brandId: readBrandId(rawGroup),
    brandName: readBrandName(rawGroup),
    mainImageUrl: assetUrl(stringValue(group.mimgurl ?? group.mainImageUrl ?? group.brandImageUrl ?? group.thumb_url ?? group.thumbUrl)),
    seriesList
  };
}

function readBrandId(value: unknown): number {
  const brand = asRecord(value);
  return numberValue(
    brand.brandId ??
      brand.brandid ??
      brand.brandIdx ??
      brand.brandidx ??
      brand.brand_id ??
      brand.bdIdx ??
      brand.bdidx ??
      brand.bdId ??
      brand.bdid ??
      brand.bd_id ??
      brand.brand_idx
  );
}

function readBrandName(value: unknown, includeGenericName = false): string {
  const brand = asRecord(value);
  return stringValue(
    brand.brandName ??
      brand.brandname ??
      brand.bdName ??
      brand.bdname ??
      brand.brand_name ??
      brand.brandTitle ??
      brand.brandtitle ??
      (includeGenericName ? brand.name : undefined)
  );
}

function readGroupId(value: unknown): number {
  if (typeof value === "number" || typeof value === "string") return numberValue(value);
  const group = asRecord(value);
  return numberValue(
      group.sgIdx ??
      group.sgidx ??
      group.sg_idx ??
      group.sgId ??
      group.sgid ??
      group.sg_id ??
      group.pkgsgidx ??
      group.pkgsgIdx ??
      group.pkgsgid ??
      group.pkgsgId ??
      group.sgroupIdx ??
      group.sgroupidx ??
      group.sgroupId ??
      group.sgroupid ??
      group.groupCode ??
      group.groupIdx ??
      group.groupidx ??
      group.groupId ??
      group.groupid ??
      group.seriesGroup ??
      group.seriesgroup ??
      group.id ??
      group.idx ??
      group.value
  );
}

function attachGroupsToBrands(brands: BrandData[], groups: SeriesGroup[]): BrandData[] {
  if (brands.length === 0) return [];
  const seenBrandIds = new Set<number>();
  const assignedGroupIds = new Set<number>();
  const attached = brands.map((brand) => {
    seenBrandIds.add(brand.brandId);
    const brandGroupIds = new Set(brand.groups.map((group) => group.groupId).filter(Boolean));
    const brandGroups = mergeGroups([
      ...brand.groups,
      ...groups.filter((group) => (brandGroupIds.has(group.groupId) && canAttachGroupById(brand, group)) || isGroupForBrand(brand, group))
    ]);
    for (const group of brandGroups) assignedGroupIds.add(group.groupId);
    return {
      ...brand,
      groups: brandGroups
    };
  });
  const orphanBrands = deriveBrands(
    groups.filter((group) => !assignedGroupIds.has(group.groupId) && !seenBrandIds.has(group.brandId || 0))
  );
  return [...attached, ...orphanBrands];
}

function isGroupForBrand(brand: BrandData, group: SeriesGroup): boolean {
  if (brand.brandId && group.brandId === brand.brandId) return true;

  const brandName = normalizeName(brand.brandName);
  const groupBrandName = normalizeName(group.brandName || "");
  const groupName = normalizeName(group.groupName);

  if (brandName && groupBrandName && (brandName.includes(groupBrandName) || groupBrandName.includes(brandName))) {
    return true;
  }

  return brandAliases(brand.brandName).some((alias) => Boolean(alias) && (groupName.includes(alias) || groupBrandName.includes(alias)));
}

function brandAliases(brandName: string): string[] {
  const normalized = normalizeName(brandName);
  const aliases = new Set([normalized]);

  if (normalized.includes("razkids")) {
    aliases.add("razkids");
    aliases.add("razkid");
  }
  if (normalized.includes("하이마이스쿨") || normalized.includes("highmyschool")) {
    aliases.add("하이마이스쿨");
    aliases.add("highmyschool");
    aliases.add("himyschool");
  }
  if (normalized.includes("playnlearn")) {
    aliases.add("playnlearn");
  }
  if (normalized.includes("firstreaders") || normalized.includes("firstreader")) {
    aliases.add("firstreaders");
    aliases.add("firstreader");
  }

  return Array.from(aliases).filter((alias) => alias.length >= 3);
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

function mergeGroups(groups: SeriesGroup[]): SeriesGroup[] {
  const merged: SeriesGroup[] = [];
  for (const group of groups) {
    if (!group.groupId) continue;
    const existingIndex = merged.findIndex((existing) => existing.groupId === group.groupId && canMergeGroups(existing, group));
    if (existingIndex >= 0) {
      merged[existingIndex] = mergeGroup(merged[existingIndex], group);
    } else {
      merged.push(group);
    }
  }
  return merged;
}

function canMergeGroups(left: SeriesGroup, right: SeriesGroup): boolean {
  const leftScope = brandScope(left);
  const rightScope = brandScope(right);
  return !leftScope || !rightScope || leftScope === rightScope;
}

function canAttachGroupById(brand: BrandData, group: SeriesGroup): boolean {
  return !brandScope(group) || isGroupForBrand(brand, group);
}

function brandScope(value: Pick<SeriesGroup, "brandId" | "brandName">): string {
  const normalizedBrandName = normalizeName(value.brandName || "");
  if (normalizedBrandName) return canonicalBrandScope(normalizedBrandName);
  return value.brandId ? `id:${value.brandId}` : "";
}

function canonicalBrandScope(normalizedBrandName: string): string {
  if (normalizedBrandName.includes("razkids") || normalizedBrandName.includes("razkid")) return "razkids";
  if (normalizedBrandName.includes("하이마이스쿨") || normalizedBrandName.includes("highmyschool") || normalizedBrandName.includes("himyschool")) {
    return "highmyschool";
  }
  if (normalizedBrandName.includes("playnlearn")) return "playnlearn";
  if (normalizedBrandName.includes("firstreaders") || normalizedBrandName.includes("firstreader")) return "firstreaders";
  return normalizedBrandName;
}

function mergeGroup(existing: SeriesGroup, incoming: SeriesGroup): SeriesGroup {
  return {
    ...existing,
    ...incoming,
    groupName: incoming.groupName || existing.groupName,
    groupNumber: incoming.groupNumber || existing.groupNumber,
    appVersion: incoming.appVersion || existing.appVersion,
    brandId: incoming.brandId || existing.brandId,
    brandName: incoming.brandName || existing.brandName,
    mainImageUrl: incoming.mainImageUrl || existing.mainImageUrl,
    seriesList: mergeSeriesLists(existing.seriesList, incoming.seriesList)
  };
}

function mergeSeriesLists(existing: SeriesData[], incoming: SeriesData[]): SeriesData[] {
  const byKey = new Map<string, SeriesData>();
  for (const series of [...existing, ...incoming]) {
    const key = series.seriesIdx ? String(series.seriesIdx) : `${series.seriesGroup}:${series.seriesName}:${series.seriesNumber}`;
    const current = byKey.get(key);
    byKey.set(key, current ? mergeSeries(current, series) : series);
  }
  return Array.from(byKey.values()).sort((left, right) => left.seriesNumber - right.seriesNumber || left.seriesIdx - right.seriesIdx);
}

function mergeSeries(existing: SeriesData, incoming: SeriesData): SeriesData {
  return {
    ...existing,
    ...incoming,
    seriesName: incoming.seriesName || existing.seriesName,
    seriesNumber: incoming.seriesNumber || existing.seriesNumber,
    mainImageUrl: incoming.mainImageUrl || existing.mainImageUrl,
    icon1Url: incoming.icon1Url || existing.icon1Url,
    icon2Url: incoming.icon2Url || existing.icon2Url,
    appVersion: incoming.appVersion || existing.appVersion,
    books: mergeBooks(existing.books, incoming.books)
  };
}

function mergeBooks(existing: BookData[], incoming: BookData[]): BookData[] {
  const byKey = new Map<string, BookData>();
  for (const book of [...existing, ...incoming]) {
    const key = book.bookId || String(book.bookIdx);
    if (!key) continue;
    const current = byKey.get(key);
    byKey.set(key, current ? mergeBook(current, book) : book);
  }
  return Array.from(byKey.values()).sort((left, right) => left.bookNumber - right.bookNumber || left.bookIdx - right.bookIdx);
}

function mergeBook(existing: BookData, incoming: BookData): BookData {
  return {
    ...existing,
    ...incoming,
    bookId: incoming.bookId || existing.bookId,
    bookName: incoming.bookName || existing.bookName,
    bUrl: incoming.bUrl || existing.bUrl,
    thumbnailUrl: incoming.thumbnailUrl || existing.thumbnailUrl,
    appVersion: incoming.appVersion || existing.appVersion
  };
}

function deriveBrands(groups: SeriesGroup[]): BrandData[] {
  const byId = new Map<number, BrandData>();
  for (const group of groups) {
    const brandId = group.brandId || 0;
    const brandName = group.brandName || "Catalog";
    const existing =
      byId.get(brandId) ||
      ({
        brandId,
        brandName,
        mainImageUrl: group.mainImageUrl || "",
        groups: []
      } satisfies BrandData);
    existing.groups.push(group);
    byId.set(brandId, existing);
  }
  return Array.from(byId.values());
}

function normalizeSeries(rawSeries: unknown, groupId: number, groupVersion: string): SeriesData {
  const series = asRecord(rawSeries);
  const seriesIdx = readSeriesIdx(rawSeries);
  const appVersion = stringValue(series.aVer ?? series.aver ?? series.appversion ?? series.appVersion) || groupVersion;
  const books = firstArray(series.blist, series.booklist, series.bookList, series.books).map((book) =>
    normalizeBook(book, groupId, seriesIdx, appVersion)
  );

  return {
    seriesGroup: numberValue(series.sgIdx ?? series.sg_idx ?? series.sgroupIdx ?? series.seriesGroup) || groupId,
    seriesIdx,
    seriesName: stringValue(series.sName ?? series.seriesName ?? series.series_name),
    seriesNumber: numberValue(series.sNum ?? series.seriesNum ?? series.seriesNumber ?? series.order),
    mainImageUrl: assetUrl(stringValue(series.mimgurl ?? series.mainImageUrl ?? series.thumb_url ?? series.thumbUrl)),
    icon1Url: stringValue(series.icon1url ?? series.icon1Url),
    icon2Url: stringValue(series.icon2url ?? series.icon2Url),
    appVersion,
    books
  };
}

function normalizeBook(rawBook: unknown, groupId: number, seriesIdx: number, appVersion: string): BookData {
  const book = asRecord(rawBook);
  const bookId = readBookId(rawBook);
  const bookVersion = stringValue(book.bookVer ?? book.bver ?? book.bVer ?? book.aVer ?? book.appversion ?? book.appVersion ?? book.version) || appVersion;
  const normalizedGroupId = readGroupId(rawBook) || groupId;
  const normalizedSeriesIdx = readSeriesIdx(rawBook) || seriesIdx;
  const explicitThumbnailUrl = assetUrl(stringValue(book.thumbnailUrl ?? book.coverUrl ?? book.coverURL ?? book.imgUrl ?? book.imageUrl ?? book.thumb_url ?? book.thumbUrl));
  const rawThumbUrl = stringValue(book.thumb_url ?? book.thumbUrl);
  const bUrl =
    stringValue(book.burl ?? book.bUrl ?? book.url ?? book.bookUrl ?? book.bookURL) ||
    (normalizedGroupId && normalizedSeriesIdx ? `MetaOn/BookData/${normalizedGroupId}/${normalizedSeriesIdx}/` : "");
  const bookIdx = numberValue(book.bidx ?? book.bIdx ?? book.bookIdx ?? book.book_idx);
  const bookName = stringValue(book.bname ?? book.bName ?? book.bookName ?? book.name ?? book.title ?? bookId);

  return {
    seriesGroup: normalizedGroupId,
    seriesIdx: normalizedSeriesIdx,
    bookIdx,
    bookId,
    bookCode: bookId,
    bookName,
    title: bookName,
    bookNumber: numberValue(book.pkgbknum ?? book.bNum ?? book.bookNum ?? book.bookNumber ?? book.order),
    lexile: stringValue(book.blexile ?? book.booklexile ?? book.lexile),
    bUrl,
    thumbnailUrl:
      explicitThumbnailUrl ||
      (bookIdx && rawThumbUrl
        ? assetUrl(rawThumbUrl)
        : `/api/books/${normalizedGroupId}/${normalizedSeriesIdx}/${encodeURIComponent(bookId)}/thumbnail?v=${encodeURIComponent(bookVersion)}`),
    themeId: numberValue(book.theme_id ?? book.themaIdx ?? book.themeId),
    appVersion: bookVersion,
    brandIdx: readBrandId(rawBook),
    sgIdx: normalizedGroupId
  };
}

function readSeriesIdx(value: unknown): number {
  const series = asRecord(value);
  return numberValue(
    series.pkgsridx ??
      series.pkgsrIdx ??
      series.pkgsrid ??
      series.pkgsrId ??
      series.sIdx ??
      series.sidx ??
      series.series_idx ??
      series.seriesIdx ??
      series.seriesidx ??
      series.seriesId ??
      series.seriesid
  );
}

function readBookId(value: unknown): string {
  const book = asRecord(value);
  return stringValue(book.bId ?? book.bid ?? book.bookId ?? book.bookID ?? book.bookid ?? book.book_id ?? book.book_code);
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstArray(...values: unknown[]): unknown[] {
  return arrayValue(values.find((value) => Array.isArray(value) && value.length > 0) ?? values.find((value) => Array.isArray(value)));
}

function stringValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function assetUrl(value: string): string {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${METAON3_BOOKDATA_BASE}${value}`;
  return value;
}
