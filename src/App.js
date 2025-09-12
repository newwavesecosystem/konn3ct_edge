import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router-dom";
import { LogOut } from "lucide-react";
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

const items = [
  { title: "Home", url: "/", icon: HomeIcon },
  { title: "Profile", url: "/profile", icon: UserIcon },
  { title: "Meeting Room(s)", url: "/rooms", icon: VideoIcon },
  { title: "Streaming", url: "/streams", icon: StreamIcon },
  { title: "Recordings", url: "/recordings", icon: RecordIcon },
  { title: "Plans & Payments", url: "/payments", icon: CardIcon },
  { title: "Addons", url: "/addons", icon: AddonIcon },
  { title: "Referee(s)", url: "/referees", icon: RefereeIcon },
  { title: "Donations", url: "/donations", icon: DonationIcon },
  { title: "Invite history", url: "/history", icon: HistoryIcon },
  // { title: "Settings", url: "/settings", icon: SettingsIcon },
  { title: "Logout", url: "/login", icon: LogOut },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>PERSONAL</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title} url={item.url}>
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

const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <>
        <Navbar />
        <Login />
      </>
    ),
  },
  {
    path: "/register",
    element: (
      <>
        <Navbar />
        <Register />
      </>
    ),
  },
  {
    path: "/join",
    element: (
      <>
        <Navbar />
        <JoinRoom />
      </>
    ),
  },
  {
    path: "/",
    element: (
      <IsAuthenticated>
        <Navbar />
        <SidebarProvider>
          <AppSidebar />
          <SidebarTrigger />
          <Outlet />
        </SidebarProvider>
      </IsAuthenticated>
    ),
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
      { path: "history", element: <InviteHistory /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
