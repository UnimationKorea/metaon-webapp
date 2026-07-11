import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCatalog } from "../hooks/useCatalog";
import { getHomeMenuImageUrl, getSeriesBackgroundUrl } from "../services/unityAppAssets";
import type { BrandData, SeriesGroup } from "../types/metaonTypes";

type HomeMenuItem = {
  label: string;
  imageUrl: string;
  brandId: number;
  groupId: number;
  path: string;
};

const fallbackHomeGroups: Array<Pick<SeriesGroup, "groupId" | "groupName" | "groupNumber" | "brandId">> = [
  { groupId: 1, groupName: "Phonics", groupNumber: 130 },
  { groupId: 2, groupName: "Speaking I", groupNumber: 140 },
  { groupId: 3, groupName: "Speaking II", groupNumber: 150 },
  { groupId: 4, groupName: "Raz-Kids Grade Pre", groupNumber: 40 },
  { groupId: 5, groupName: "Raz-Kids Grade K", groupNumber: 50 },
  { groupId: 6, groupName: "Raz-Kids Grade 1", groupNumber: 60 },
  { groupId: 7, groupName: "Raz-Kids Grade 2", groupNumber: 70 },
  { groupId: 8, groupName: "Raz-Kids Grade 3", groupNumber: 80 },
  { groupId: 9, groupName: "Raz-Kids Grade 4", groupNumber: 90 },
  { groupId: 10, groupName: "Raz-Kids Grade 5", groupNumber: 100 },
  { groupId: 11, groupName: "Raz-Kids Grade 6", groupNumber: 110 },
  { groupId: 12, groupName: "Raz-Kids Grade 6+", groupNumber: 120 },
  { groupId: 17, groupName: "Reading Training Course 1", groupNumber: 20 }
];

const fallbackHomeBrands: Array<Pick<BrandData, "brandId" | "brandName" | "mainImageUrl" | "groups">> = [
  { brandId: 10, brandName: "MetaOn", mainImageUrl: "", groups: fallbackHomeGroups as SeriesGroup[] }
];

export function HomePage() {
  const { catalog, usingSample } = useCatalog();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const homeMenuItems = useMemo(() => {
    const brands = catalog && catalog.brands.length > 0 ? catalog.brands : fallbackHomeBrands;
    return brands
      .slice()
      .filter((brand) => brand.groups.length > 0)
      .map(toHomeMenuItem);
  }, [catalog, usingSample]);
  const selectedItem = homeMenuItems[selectedIndex % homeMenuItems.length];

  function moveBy(delta: number) {
    setSelectedIndex((current) => (current + delta + homeMenuItems.length) % homeMenuItems.length);
  }

  return (
    <section
      className="home-screen"
      style={{ "--unity-home-bg": `url("${getSeriesBackgroundUrl(4, 4)}")` } as CSSProperties}
    >
      <div className="home-carousel" aria-label="Main menu">
        <button className="home-arrow" type="button" onClick={() => moveBy(-1)} aria-label="Previous menu">
          <ChevronLeft size={34} />
        </button>

        <Link
          className="home-menu-card"
          to={selectedItem.path}
          aria-label={selectedItem.label}
          data-brand={selectedItem.brandId}
          data-series-group={selectedItem.groupId}
        >
          <div className="home-menu-image">
            <img src={selectedItem.imageUrl} alt="" />
          </div>
          <span className="home-menu-caption">{selectedItem.label}</span>
        </Link>

        <button className="home-arrow" type="button" onClick={() => moveBy(1)} aria-label="Next menu">
          <ChevronRight size={34} />
        </button>
      </div>
    </section>
  );
}

function toHomeMenuItem(brand: Pick<BrandData, "brandId" | "brandName" | "mainImageUrl" | "groups">): HomeMenuItem {
  const firstGroup = brand.groups[0];
  const query = `brand=${brand.brandId}&group=${firstGroup.groupId}`;
  return {
    label: normalizeName(brand.brandName),
    imageUrl: getHomeMenuImageUrl(firstGroup.groupId, firstGroup.groupName),
    brandId: brand.brandId,
    groupId: firstGroup.groupId,
    path: `/catalog?${query}`
  };
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
