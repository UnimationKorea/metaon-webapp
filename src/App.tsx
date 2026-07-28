import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { MetaOnHubShell } from "./components/MetaOnHubShell";
import { RequireMetaOnProfile } from "./components/RequireMetaOnProfile";
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
import { ProfileSelectPage } from "./pages/ProfileSelectPage";
import {
  AccessDeniedPage,
  InstitutionApplyPage,
  InstitutionStatusPage,
  NotificationsPage,
  PasswordChangePage,
  ProfileEditPage,
  ProfileManagePage,
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
      { path: "profiles", element: <ProfileSelectPage /> },
      { path: "profiles/manage", element: <ProfileManagePage /> },
      { path: "account/password", element: <PasswordChangePage /> },
      { path: "study", element: <RequireMetaOnProfile><StudyZonePage /></RequireMetaOnProfile> },
      { path: "catalog", element: <RequireMetaOnProfile><StudyZonePage /></RequireMetaOnProfile> },
      { path: "books/:bookIdx", element: <RequireMetaOnProfile><HubBookPage /></RequireMetaOnProfile> },
      { path: "books/:seriesGroup/:seriesIdx/:bookId", element: <RequireMetaOnProfile><HubBookPage /></RequireMetaOnProfile> },
      { path: "activity/:bookIdx/:dayIdx/:actIdx", element: <RequireMetaOnProfile><ActivityPage /></RequireMetaOnProfile> },
      { path: "activity/:seriesGroup/:seriesIdx/:bookId/:dayId/:actNum", element: <RequireMetaOnProfile><ActivityPage /></RequireMetaOnProfile> },
      { path: "activity-prototypes", element: <ActivityPrototypePage /> },
      { path: "activity-preview/:kind", element: <ActivityRenewalPreviewPage /> },
      { path: "placement", element: <PlacementIntroPage /> },
      { path: "placement/intro", element: <PlacementIntroPage /> },
      { path: "placement/test", element: <PlacementTestPage /> },
      { path: "placement/result", element: <PlacementResultPage /> },
      { path: "ai-chat", element: <RequireMetaOnProfile><ExternalStartPage kind="ai-chat" /></RequireMetaOnProfile> },
      { path: "ai-session", element: <RequireMetaOnProfile><ExternalFramePage kind="ai-chat" /></RequireMetaOnProfile> },
      { path: "chat-history", element: <RequireMetaOnProfile><ChatHistoryPage /></RequireMetaOnProfile> },
      { path: "metaverse", element: <RequireMetaOnProfile><ExternalStartPage kind="metaverse" /></RequireMetaOnProfile> },
      { path: "metaverse-world", element: <RequireMetaOnProfile><ExternalFramePage kind="metaverse" /></RequireMetaOnProfile> },
      { path: "profile", element: <RequireMetaOnProfile><ProfilePage /></RequireMetaOnProfile> },
      { path: "profile/edit", element: <RequireMetaOnProfile><ProfileEditPage /></RequireMetaOnProfile> },
      { path: "progress", element: <RequireMetaOnProfile><ProgressPage /></RequireMetaOnProfile> },
      { path: "notifications", element: <RequireMetaOnProfile><NotificationsPage /></RequireMetaOnProfile> },
      { path: "institution/apply", element: <RequireMetaOnProfile><InstitutionApplyPage /></RequireMetaOnProfile> },
      { path: "institution/status", element: <RequireMetaOnProfile><InstitutionStatusPage /></RequireMetaOnProfile> },
      { path: "access-denied", element: <AccessDeniedPage /> }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}
