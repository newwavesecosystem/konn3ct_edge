import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
} from "react-router-dom";
import {
  CreditCard,
  Disc,
  FolderClock,
  Home,
  Layers,
  Menu,
  Radio,
  Settings as SettingsIcon,
  User,
  Users,
  Video,
  Zap,
} from "lucide-react";
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

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Meeting Room(s)", url: "/rooms", icon: Video },
  { title: "Streaming", url: "/streams", icon: Radio },
  { title: "Recordings", url: "/recordings", icon: Disc },
  { title: "Plans & Payments", url: "/payments", icon: CreditCard },
  { title: "Addons", url: "/addons", icon: Layers },
  { title: "Referee(s)", url: "/referees", icon: Zap },
  { title: "Invite history", url: "/history", icon: FolderClock },
  { title: "Team", url: "/team", icon: Users },
  { title: "More", url: "/others", icon: Menu },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
];

export function AppSidebar() {
  return (
    <Sidebar>
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
      { path: "history", element: <InviteHistory /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
