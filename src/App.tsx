import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MetaOnHubShell } from "./components/MetaOnHubShell";
import { AuthProvider } from "./hooks/useAuth";
import { HubStateProvider } from "./hooks/useHubState";
import { ActivityPrototypePage } from "./pages/ActivityPrototypePage";
import { ActivityRenewalPreviewPage } from "./pages/ActivityRenewalPreviewPage";
import { ActivityPage } from "./pages/ActivityPage";
import { ChatHistoryPage, ExternalFramePage, ExternalStartPage } from "./pages/ExternalPages";
import { HubBookPage } from "./pages/HubBookPage";
import { HubHomePage } from "./pages/HubHomePage";
import { LoginPage } from "./pages/LoginPage";
import { PlacementIntroPage, PlacementResultPage, PlacementTestPage } from "./pages/PlacementPages";
import {
  AccessDeniedPage,
  InstitutionApplyPage,
  InstitutionStatusPage,
  NotificationsPage,
  ProfileEditPage,
  ProfilePage,
  ProgressPage
} from "./pages/ProfilePages";
import { StudyZonePage } from "./pages/StudyZonePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthProvider>
        <HubStateProvider>
          <MetaOnHubShell />
        </HubStateProvider>
      </AuthProvider>
    ),
    children: [
      { index: true, element: <HubHomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "study", element: <StudyZonePage /> },
      { path: "catalog", element: <StudyZonePage /> },
      { path: "books/:bookIdx", element: <HubBookPage /> },
      { path: "books/:seriesGroup/:seriesIdx/:bookId", element: <HubBookPage /> },
      { path: "activity/:bookIdx/:dayIdx/:actIdx", element: <ActivityPage /> },
      { path: "activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum", element: <ActivityPage /> },
      { path: "activity-prototypes", element: <ActivityPrototypePage /> },
      { path: "activity-preview/:kind", element: <ActivityRenewalPreviewPage /> },
      { path: "placement", element: <PlacementIntroPage /> },
      { path: "placement/intro", element: <PlacementIntroPage /> },
      { path: "placement/test", element: <PlacementTestPage /> },
      { path: "placement/result", element: <PlacementResultPage /> },
      { path: "ai-chat", element: <ExternalStartPage kind="ai-chat" /> },
      { path: "ai-session", element: <ExternalFramePage kind="ai-chat" /> },
      { path: "chat-history", element: <ChatHistoryPage /> },
      { path: "metaverse", element: <ExternalStartPage kind="metaverse" /> },
      { path: "metaverse-world", element: <ExternalFramePage kind="metaverse" /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "profile/edit", element: <ProfileEditPage /> },
      { path: "progress", element: <ProgressPage /> },
      { path: "notifications", element: <NotificationsPage /> },
      { path: "institution/apply", element: <InstitutionApplyPage /> },
      { path: "institution/status", element: <InstitutionStatusPage /> },
      { path: "access-denied", element: <AccessDeniedPage /> }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}
