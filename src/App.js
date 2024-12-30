import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
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

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
  },
  {
    title: "Meeting Room(s)",
    url: "/rooms",
    icon: Video,
  },
  {
    title: "Streaming",
    url: "/streams",
    icon: Radio,
  },
  {
    title: "Recordings",
    url: "/recordings",
    icon: Disc,
  },
  {
    title: "Plans & Payments",
    url: "/payments",
    icon: CreditCard,
  },
  {
    title: "Addons",
    url: "/addons",
    icon: Layers,
  },
  {
    title: "Referee(s)",
    url: "/referees",
    icon: Zap,
  },
  {
    title: "Invite history",
    url: "/history",
    icon: FolderClock,
  },
  {
    title: "Team",
    url: "/team",
    icon: Users,
  },
  {
    title: "More",
    url: "/others",
    icon: Menu,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: SettingsIcon,
  },
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
                    <a href={item.url}>
                      <item.icon className="!w-6 !h-6" />
                      <span>{item.title}</span>
                    </a>
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

function App() {
  return (
    <Router>
      <Navbar />
      <SidebarProvider>
        <AppSidebar />
        <SidebarTrigger />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/streams" element={<Streaming />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/addons" element={<Addon />} />
          <Route path="/referees" element={<Referee />} />
          <Route path="/history" element={<InviteHistory />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </SidebarProvider>
    </Router>
  );
}

export default App;
