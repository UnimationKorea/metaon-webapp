import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { MetaOnHubShell } from "./components/MetaOnHubShell";
import { RequireMetaOnProfile } from "./components/RequireMetaOnProfile";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { HubStateProvider } from "./hooks/useHubState";

// Keep the initial route small. Activity renderers, catalog views, placement,
// and external frames are downloaded only when their route is actually opened.
const ActivityPrototypePage = lazy(() => import("./pages/ActivityPrototypePage").then(({ ActivityPrototypePage: Page }) => ({ default: Page })));
const ActivityRenewalPreviewPage = lazy(() => import("./pages/ActivityRenewalPreviewPage").then(({ ActivityRenewalPreviewPage: Page }) => ({ default: Page })));
const ActivityPage = lazy(() => import("./pages/ActivityPage").then(({ ActivityPage: Page }) => ({ default: Page })));
const ChatHistoryPage = lazy(() => import("./pages/ExternalPages").then(({ ChatHistoryPage: Page }) => ({ default: Page })));
const ExternalFramePage = lazy(() => import("./pages/ExternalPages").then(({ ExternalFramePage: Page }) => ({ default: Page })));
const ExternalStartPage = lazy(() => import("./pages/ExternalPages").then(({ ExternalStartPage: Page }) => ({ default: Page })));
const HubBookPage = lazy(() => import("./pages/HubBookPage").then(({ HubBookPage: Page }) => ({ default: Page })));
const HubHomePage = lazy(() => import("./pages/HubHomePage").then(({ HubHomePage: Page }) => ({ default: Page })));
const LoginPage = lazy(() => import("./pages/LoginPage").then(({ LoginPage: Page }) => ({ default: Page })));
const PlacementIntroPage = lazy(() => import("./pages/PlacementPages").then(({ PlacementIntroPage: Page }) => ({ default: Page })));
const PlacementResultPage = lazy(() => import("./pages/PlacementPages").then(({ PlacementResultPage: Page }) => ({ default: Page })));
const PlacementTestPage = lazy(() => import("./pages/PlacementPages").then(({ PlacementTestPage: Page }) => ({ default: Page })));
const ProfileSelectPage = lazy(() => import("./pages/ProfileSelectPage").then(({ ProfileSelectPage: Page }) => ({ default: Page })));
const AccessDeniedPage = lazy(() => import("./pages/ProfilePages").then(({ AccessDeniedPage: Page }) => ({ default: Page })));
const InstitutionApplyPage = lazy(() => import("./pages/ProfilePages").then(({ InstitutionApplyPage: Page }) => ({ default: Page })));
const InstitutionStatusPage = lazy(() => import("./pages/ProfilePages").then(({ InstitutionStatusPage: Page }) => ({ default: Page })));
const NotificationsPage = lazy(() => import("./pages/ProfilePages").then(({ NotificationsPage: Page }) => ({ default: Page })));
const PasswordChangePage = lazy(() => import("./pages/ProfilePages").then(({ PasswordChangePage: Page }) => ({ default: Page })));
const ProfileEditPage = lazy(() => import("./pages/ProfilePages").then(({ ProfileEditPage: Page }) => ({ default: Page })));
const ProfileManagePage = lazy(() => import("./pages/ProfilePages").then(({ ProfileManagePage: Page }) => ({ default: Page })));
const ProfilePage = lazy(() => import("./pages/ProfilePages").then(({ ProfilePage: Page }) => ({ default: Page })));
const ProgressPage = lazy(() => import("./pages/ProfilePages").then(({ ProgressPage: Page }) => ({ default: Page })));
const StudyZonePage = lazy(() => import("./pages/StudyZonePage").then(({ StudyZonePage: Page }) => ({ default: Page })));

function RouteLoadingBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<AppLoadingScreen />}>{children}</Suspense>;
}

function routeElement(children: ReactNode) {
  return <RouteLoadingBoundary>{children}</RouteLoadingBoundary>;
}

function AppBootstrap() {
  const { isLoading } = useAuth();

  if (isLoading) return <AppLoadingScreen />;

  return (
    <HubStateProvider>
      <MetaOnHubShell />
    </HubStateProvider>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <AppBootstrap />
      </AuthProvider>
    ),
    children: [
      { index: true, element: routeElement(<HubHomePage />) },
      { path: "login", element: routeElement(<LoginPage />) },
      { path: "profiles", element: routeElement(<ProfileSelectPage />) },
      { path: "profiles/manage", element: routeElement(<ProfileManagePage />) },
      { path: "account/password", element: routeElement(<PasswordChangePage />) },
      { path: "study", element: routeElement(<RequireMetaOnProfile><StudyZonePage /></RequireMetaOnProfile>) },
      { path: "catalog", element: routeElement(<RequireMetaOnProfile><StudyZonePage /></RequireMetaOnProfile>) },
      { path: "books/:bookIdx", element: routeElement(<RequireMetaOnProfile><HubBookPage /></RequireMetaOnProfile>) },
      { path: "books/:seriesGroup/:seriesIdx/:bookId", element: routeElement(<RequireMetaOnProfile><HubBookPage /></RequireMetaOnProfile>) },
      { path: "activity/:bookIdx/:dayIdx/:actIdx", element: routeElement(<RequireMetaOnProfile><ActivityPage /></RequireMetaOnProfile>) },
      { path: "activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum", element: routeElement(<RequireMetaOnProfile><ActivityPage /></RequireMetaOnProfile>) },
      { path: "activity-prototypes", element: routeElement(<ActivityPrototypePage />) },
      { path: "activity-preview/:kind", element: routeElement(<ActivityRenewalPreviewPage />) },
      { path: "placement", element: routeElement(<PlacementIntroPage />) },
      { path: "placement/intro", element: routeElement(<PlacementIntroPage />) },
      { path: "placement/test", element: routeElement(<PlacementTestPage />) },
      { path: "placement/result", element: routeElement(<PlacementResultPage />) },
      { path: "ai-chat", element: routeElement(<RequireMetaOnProfile><ExternalStartPage kind="ai-chat" /></RequireMetaOnProfile>) },
      { path: "ai-session", element: routeElement(<RequireMetaOnProfile><ExternalFramePage kind="ai-chat" /></RequireMetaOnProfile>) },
      { path: "chat-history", element: routeElement(<RequireMetaOnProfile><ChatHistoryPage /></RequireMetaOnProfile>) },
      { path: "metaverse", element: routeElement(<RequireMetaOnProfile><ExternalStartPage kind="metaverse" /></RequireMetaOnProfile>) },
      { path: "metaverse-world", element: routeElement(<RequireMetaOnProfile><ExternalFramePage kind="metaverse" /></RequireMetaOnProfile>) },
      { path: "profile", element: routeElement(<RequireMetaOnProfile><ProfilePage /></RequireMetaOnProfile>) },
      { path: "profile/edit", element: routeElement(<RequireMetaOnProfile><ProfileEditPage /></RequireMetaOnProfile>) },
      { path: "progress", element: routeElement(<RequireMetaOnProfile><ProgressPage /></RequireMetaOnProfile>) },
      { path: "notifications", element: routeElement(<RequireMetaOnProfile><NotificationsPage /></RequireMetaOnProfile>) },
      { path: "institution/apply", element: routeElement(<RequireMetaOnProfile><InstitutionApplyPage /></RequireMetaOnProfile>) },
      { path: "institution/status", element: routeElement(<RequireMetaOnProfile><InstitutionStatusPage /></RequireMetaOnProfile>) },
      { path: "access-denied", element: routeElement(<AccessDeniedPage />) }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}
