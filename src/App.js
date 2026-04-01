import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router-dom";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./components/ui/sidebar";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Rooms from "./pages/Rooms";
import Profile from "./pages/profile/Profile";
import Streaming from "./pages/Streaming";
import Recordings from "./pages/Recordings";
import Payments from "./pages/Payments";
import Addon from "./pages/Addon";
import Referee from "./pages/Referee";
import Settings from "./pages/Settings";
import InviteHistory from "./pages/InviteHistory";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import IsAuthenticated from "./lib/IsAuthenticated";
import JoinRoom from "./pages/JoinRoom";
import Donations from "./pages/Donations";
import Attendance from "./pages/Attendance";
import ViewAttendance from "./pages/ViewAttendance";
import EventParticipants from "./pages/EventParticipants";
import Events from "./pages/Events";
import EventIcon from "./assets/components/EventIcon";
import HomeIcon from "./assets/components/HomeIcon";
import CardIcon from "./assets/components/CardIcon";
import UserIcon from "./assets/components/UserIcon";
import RecordIcon from "./assets/components/RecordIcon";
import VideoIcon from "./assets/components/VideoIcon";
import StreamIcon from "./assets/components/StreamIcon";
import AddonIcon from "./assets/components/AddonIcon";
import RefereeIcon from "./assets/components/RefereeIcon";
import HistoryIcon from "./assets/components/HistoryIcon";
import DonationIcon from "./assets/components/DonationIcon";
import SettingsIcon from "./assets/components/SettingsIcon";
import AttendanceIcon from "./assets/components/AttendanceIcon";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { RouteErrorFallback } from "./components/ui/resilience";

export function AppSidebar() {
  const { t } = useTranslation();

  const items = [
    { title: t("navigation.home"), url: "/", icon: HomeIcon },
    { title: t("navigation.profile"), url: "/profile", icon: UserIcon },
    { title: t("navigation.rooms"), url: "/rooms", icon: VideoIcon },
    { title: t("navigation.streaming"), url: "/streams", icon: StreamIcon },
    {
      title: t("navigation.recordings"),
      url: "/recordings",
      icon: RecordIcon,
    },
    { title: t("navigation.payments"), url: "/payments", icon: CardIcon },
    { title: t("navigation.addons"), url: "/addons", icon: AddonIcon },
    { title: t("navigation.referees"), url: "/referees", icon: RefereeIcon },
    {
      title: t("navigation.donations"),
      url: "/donations",
      icon: DonationIcon,
    },
    {
      title: t("navigation.attendance"),
      url: "/attendance",
      icon: AttendanceIcon,
    },
    { title: t("navigation.events"), url: "/events", icon: EventIcon },
    { title: t("navigation.history"), url: "/history", icon: HistoryIcon },
    { title: t("navigation.settings"), url: "/settings", icon: SettingsIcon },
    { title: t("navigation.logout"), url: "/login", icon: LogOut },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("navigation.personal")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url} url={item.url}>
                  <SidebarMenuButton asChild>
                    <Link to={item.url}>
                      <item.icon className="!w-6 !h-6" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const AuthenticatedAppLayout = () => {
  return (
    <IsAuthenticated>
      <Navbar />
      <SidebarProvider>
        <AppSidebar />
        <SidebarTrigger />
        <Outlet />
      </SidebarProvider>
    </IsAuthenticated>
  );
};

const router = createBrowserRouter([
  {
    path: "/",
    errorElement: <RouteErrorFallback />,
    children: [
      {
        path: "login",
        element: (
          <>
            <Navbar />
            <Login />
          </>
        ),
      },
      {
        path: "register",
        element: (
          <>
            <Navbar />
            <Register />
          </>
        ),
      },
      {
        path: "forgot-password",
        element: (
          <>
            <Navbar />
            <ForgotPassword />
          </>
        ),
      },
      {
        path: "join",
        element: (
          <>
            <Navbar />
            <JoinRoom />
          </>
        ),
      },
      {
        element: <AuthenticatedAppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "rooms", element: <Rooms /> },
          { path: "profile", element: <Profile /> },
          { path: "streams", element: <Streaming /> },
          { path: "recordings", element: <Recordings /> },
          { path: "payments", element: <Payments /> },
          { path: "addons", element: <Addon /> },
          { path: "referees", element: <Referee /> },
          { path: "donations", element: <Donations /> },
          { path: "attendance", element: <Attendance /> },
          {
            path: "attendance-details/:meeting_id/:identifier",
            element: <ViewAttendance />,
          },
          {
            path: "events/participants/:reference",
            element: <EventParticipants />,
          },
          { path: "events/*", element: <Events /> },
          { path: "history", element: <InviteHistory /> },
          { path: "settings", element: <Settings /> },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
