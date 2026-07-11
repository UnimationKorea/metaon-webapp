import { useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { BookCard } from "../components/BookCard";
import { EmptyState } from "../components/EmptyState";
import { flattenSeries, useCatalog } from "../hooks/useCatalog";
import { getSeriesBackgroundUrl, unityMenuAssets } from "../services/unityAppAssets";
import { firstSeries } from "../utils/catalogLookup";

export function CatalogPage() {
  const { catalog, isLoading, error, usingSample, totals, reload } = useCatalog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const selectedBrandId = numberParam(searchParams.get("brand"));
  const selectedGroupId = numberParam(searchParams.get("group"));
  const selectedSeriesIdx = numberParam(searchParams.get("series"));

  const selectedBrand = useMemo(() => {
    if (!catalog || catalog.brands.length === 0) return undefined;
    if (selectedBrandId) {
      const explicitBrand = catalog.brands.find((brand) => brand.brandId === selectedBrandId);
      if (explicitBrand) return explicitBrand;
    }
    if (selectedGroupId) {
      return catalog.brands.find((brand) => brand.groups.some((group) => group.groupId === selectedGroupId));
    }
    return catalog.brands[0];
  }, [catalog, selectedBrandId, selectedGroupId]);

  const brandGroups = selectedBrand ? selectedBrand.groups : catalog?.groups || [];

  const requestedGroupMissing = useMemo(() => {
    if (!catalog || !selectedGroupId) return false;
    return !brandGroups.some((group) => group.groupId === selectedGroupId);
  }, [brandGroups, catalog, selectedGroupId]);

  const selectedGroup = useMemo(() => {
    if (!catalog) return undefined;
    if (selectedGroupId) return brandGroups.find((group) => group.groupId === selectedGroupId);
    return brandGroups[0];
  }, [brandGroups, catalog, selectedGroupId]);

  const selectedSeries = useMemo(() => {
    if (!catalog || !selectedGroup) return undefined;
    return (
      selectedGroup.seriesList.find((series) => series.seriesIdx === selectedSeriesIdx) ||
      firstSeries([selectedGroup])
    );
  }, [catalog, selectedGroup, selectedSeriesIdx]);

  const visibleBooks = useMemo(() => {
    const books = selectedSeries?.books || [];
    const needle = query.trim().toLowerCase();
    if (!needle) return books;
    return books.filter(
      (book) => book.bookName.toLowerCase().includes(needle) || book.bookId.toLowerCase().includes(needle)
    );
  }, [query, selectedSeries]);
  const selectedGroupSeries = useMemo(() => (selectedGroup ? flattenSeries([selectedGroup]) : []), [selectedGroup]);

  const catalogStyle = {
    "--unity-series-bg": `url("${getSeriesBackgroundUrl(selectedGroup?.groupNumber, selectedGroup?.groupId)}")`
  } as CSSProperties;

  const closeCatalogMenu = () => setIsCatalogMenuOpen(false);

  if (isLoading) {
    return <EmptyState title="Loading catalog" detail="Fetching book list through the same-origin BFF." />;
  }

  if (!catalog || catalog.groups.length === 0) {
    return <EmptyState title="No catalog" detail={error || "Book list is empty."} />;
  }

  if (requestedGroupMissing) {
    return (
      <EmptyState
        title={`${homeMenuNameByGroupId(selectedGroupId)} catalog unavailable`}
        detail="The Unity home menu exists, but the current book API response does not include this group yet."
      />
    );
  }

  return (
    <div className="catalog-grid unity-catalog" style={catalogStyle}>
      <button
        aria-expanded={isCatalogMenuOpen}
        className="catalog-menu-toggle"
        type="button"
        onClick={() => setIsCatalogMenuOpen((isOpen) => !isOpen)}
      >
        <Menu size={18} />
        <span>{selectedGroup?.groupName || "Group menu"}</span>
      </button>
      <button
        aria-label="Close group menu"
        className={isCatalogMenuOpen ? "catalog-menu-backdrop open" : "catalog-menu-backdrop"}
        type="button"
        onClick={closeCatalogMenu}
      />
      <aside className={isCatalogMenuOpen ? "catalog-sidebar open" : "catalog-sidebar"}>
        <div className="catalog-sidebar-header">
          <strong>Books Menu</strong>
          <button aria-label="Close group menu" type="button" onClick={closeCatalogMenu}>
            <X size={18} />
          </button>
        </div>
        <div className="summary-panel">
          <img className="summary-panel-icon" src={unityMenuAssets.myBooks} alt="" />
          <strong>{totals.brands}</strong>
          <span>brands</span>
          <small>
            {totals.books} books / {totals.groups} groups
          </small>
        </div>
        {usingSample ? (
          <div className="warning-panel">
            <strong>Sample mode</strong>
            <span>{error}</span>
            <button type="button" onClick={() => reload({ refresh: true })}>
              Retry remote
            </button>
          </div>
        ) : null}
        <div className="brand-tree">
          {catalog.brands.map((brand, brandIndex) => {
            const isSelectedBrand = brand.brandId === selectedBrand?.brandId;
            return (
              <div
                className={isSelectedBrand ? "brand-node expanded" : "brand-node"}
                key={`${brand.brandId || "brand"}:${brand.brandName}:${brandIndex}`}
              >
                <button
                  aria-expanded="true"
                  className={isSelectedBrand ? "brand-row selected" : "brand-row"}
                  type="button"
                  onClick={() => {
                    const firstGroup = brand.groups[0];
                    setSearchParams({
                      brand: String(brand.brandId),
                      ...(firstGroup ? { group: String(firstGroup.groupId) } : {})
                    });
                    closeCatalogMenu();
                  }}
                >
                  <span className="brand-row-title">
                    <ChevronDown size={15} />
                    <span>{brand.brandName || `Brand ${brand.brandId}`}</span>
                  </span>
                  <small>{brand.groups.length} groups</small>
                </button>
                {brand.groups.length > 0 ? (
                  <div className="brand-group-list">
                    {brand.groups.map((group, groupIndex) => (
                      <button
                        className={
                          isSelectedBrand && group.groupId === selectedGroup?.groupId
                            ? "brand-group-row selected"
                            : "brand-group-row"
                        }
                        key={`${brand.brandId || "brand"}:${group.groupId}:${group.groupName}:${groupIndex}`}
                        type="button"
                        onClick={() => {
                          setSearchParams({
                            brand: String(brand.brandId),
                            group: String(group.groupId)
                          });
                          closeCatalogMenu();
                        }}
                      >
                        <span>{group.groupName}</span>
                        <small>{group.seriesList.length} series</small>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </aside>
      <section className="catalog-main">
        <div className="catalog-heading">
          <div>
            <h1>{selectedBrand?.brandName || selectedGroup?.groupName || "MetaOn"}</h1>
            <p>{selectedGroup?.groupName || selectedSeries?.seriesName || "Select a series to start learning."}</p>
          </div>
          <label className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search books" />
          </label>
        </div>
        <div className="series-tabs">
          {selectedGroupSeries.map((series) => (
            <button
              className={series.seriesIdx === selectedSeries?.seriesIdx ? "selected" : ""}
              key={series.seriesIdx}
              type="button"
              onClick={() =>
                setSearchParams({
                  ...(selectedBrand ? { brand: String(selectedBrand.brandId) } : {}),
                  group: String(selectedGroup?.groupId || series.seriesGroup),
                  series: String(series.seriesIdx)
                })
              }
            >
              {series.seriesName}
            </button>
          ))}
        </div>
        <div className="book-grid">
          {visibleBooks.map((book) => (
            <BookCard book={book} key={`${book.seriesGroup}:${book.seriesIdx}:${book.bookId}`} />
          ))}
        </div>
      </section>
    </div>
  );
}

function numberParam(value: string | null): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function homeMenuNameByGroupId(groupId?: number): string {
  switch (groupId) {
    case 1:
      return "Phonics";
    case 2:
      return "Speaking I";
    case 3:
      return "Speaking II";
    case 4:
      return "Raz-Kids Grade Pre";
    case 5:
      return "Raz-Kids Grade K";
    case 6:
      return "Raz-Kids Grade 1";
    case 7:
      return "Raz-Kids Grade 2";
    case 8:
      return "Raz-Kids Grade 3";
    case 9:
      return "Raz-Kids Grade 4";
    case 10:
      return "Raz-Kids Grade 5";
    case 11:
      return "Raz-Kids Grade 6";
    case 12:
      return "Raz-Kids Grade 6+";
    case 17:
      return "Reading Training Course 1";
    default:
      return "Selected group";
  }
}
