import { ActivityLoadingVisual } from "./activities/ActivityLoadingVisual";

type AppLoadingScreenProps = {
  className?: string;
};

/**
 * Shared visual-only loader for the app bootstrap and lazy route boundaries.
 * Its markup deliberately matches the Activity loader so startup never falls
 * back to a text-only waiting screen.
 */
export function AppLoadingScreen({ className = "" }: AppLoadingScreenProps) {
  return (
    <ActivityLoadingVisual
      ariaLabel="MetaOn 화면을 준비하고 있습니다"
      className={`app-loading-screen${className ? ` ${className}` : ""}`}
    />
  );
}
