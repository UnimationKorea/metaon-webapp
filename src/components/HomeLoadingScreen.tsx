import { type CSSProperties } from "react";

type HomeLoadingScreenProps = {
  backgroundImage: string;
  backgroundPosition: string;
  themeId: string;
};

export function HomeLoadingScreen({ backgroundImage, backgroundPosition, themeId }: HomeLoadingScreenProps) {
  const style = {
    "--hub-home-loading-position": backgroundPosition
  } as CSSProperties;

  return (
    <section
      className="hub-home-loading-screen"
      data-loading-theme={themeId}
      style={style}
      role="status"
      aria-busy="true"
      aria-label="MetaOn 홈 화면을 준비하고 있습니다"
    >
      <img className="hub-home-loading-backdrop" src={backgroundImage} alt="" aria-hidden="true" />
      <span className="hub-home-loading-visual" aria-hidden="true">
        <span className="hub-home-loading-icon-stage">
          <i className="hub-home-loading-orbit" />
          <img src="/unity-app-ui/brand/app-icon.png" alt="" />
        </span>
        <span className="hub-home-loading-progress">
          <i />
        </span>
      </span>
    </section>
  );
}
