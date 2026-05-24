import {
  createBrowserRouter,
  RouterProvider,
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";
import React, { useState, useContext } from "react";
import { LogOut, X, Menu, Search, Bell, Plus, Moon, Sun, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import NewInvite from "./pages/NewInvite";
import NewSchedule from "./pages/NewSchedule";
import NewRoom from "./pages/NewRoom";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import IsAuthenticated from "./lib/IsAuthenticated";
import JoinRoom from "./pages/JoinRoom";
import Donations from "./pages/Donations";
import Attendance from "./pages/Attendance";
import ViewAttendance from "./pages/ViewAttendance";
import EventParticipants from "./pages/EventParticipants";
import Events from "./pages/Events";
import ViewProfile from "./pages/view-profile/ViewProfile";
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
import Notifications from "./pages/Notifications";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { RouteErrorFallback } from "./components/ui/resilience";
import { Avatar, AvatarFallback } from "./components/ui/avatar";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { ThemeContext } from "./providers/ThemeProvider";
import { cn } from "./lib/utils";
import logo from "./assets/konn3ct_logo.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "./components/ui/dropdown-menu";

export function AppSidebar({ isMobileMenuOpen, setIsMobileMenuOpen, isCollapsed, setIsCollapsed }) {
  const { t } = useTranslation();
  const location = useLocation();
  const pathname = location.pathname;

  const items = [
    { titleKey: "app.sidebar.home", url: "/", icon: HomeIcon },
    { titleKey: "app.sidebar.rooms", url: "/rooms", icon: VideoIcon },
    { titleKey: "app.sidebar.streaming", url: "/streams", icon: StreamIcon },
    {
      titleKey: "app.sidebar.recordings",
      url: "/recordings",
      icon: RecordIcon,
    },
    { titleKey: "app.sidebar.payments", url: "/payments", icon: CardIcon },
    { titleKey: "app.sidebar.addons", url: "/addons", icon: AddonIcon },
    { titleKey: "app.sidebar.referees", url: "/referees", icon: RefereeIcon },
    {
      titleKey: "app.sidebar.donations",
      url: "/donations",
      icon: DonationIcon,
    },
    {
      titleKey: "app.sidebar.attendance",
      url: "/attendance",
      icon: AttendanceIcon,
    },
    { titleKey: "app.sidebar.events", url: "/events", icon: EventIcon },
    { titleKey: "app.sidebar.history", url: "/history", icon: HistoryIcon },
    { titleKey: "app.sidebar.profile", url: "/profile", icon: UserIcon },
    { titleKey: "app.sidebar.settings", url: "/settings", icon: SettingsIcon },
  ];

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-40 transform flex-col border-r border-border/60 bg-surface transition-all duration-300 ease-in-out md:static md:flex shadow-2xl md:shadow-none",
        isMobileMenuOpen ? "translate-x-0 flex w-[260px]" : "-translate-x-full md:translate-x-0",
        isCollapsed && !isMobileMenuOpen ? "md:w-[80px]" : "md:w-[260px]"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center border-b border-border/60", isCollapsed && !isMobileMenuOpen ? "justify-center px-0" : "justify-between px-6")}>
        {(!isCollapsed || isMobileMenuOpen) && (
          <Link to="/" className="flex items-center gap-2.5 group" onClick={() => setIsMobileMenuOpen?.(false)}>
            <img src={logo} alt={t("app.navbar.logoAlt", "Konn3ct Logo")} className="h-8" />
          </Link>
        )}
        {isCollapsed && !isMobileMenuOpen && (
          <Link to="/" className="flex items-center justify-center group" onClick={() => setIsMobileMenuOpen?.(false)}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green">
              <VideoIcon className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        <button 
          className="hidden md:flex p-1.5 text-muted-foreground hover:bg-black/[0.04] rounded-md transition-colors"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <button 
          className="md:hidden p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setIsMobileMenuOpen?.(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 overflow-x-hidden">
        {(!isCollapsed || isMobileMenuOpen) && <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t("app.sidebar.groupLabel", "Menu")}</p>}
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = pathname === item.url || (pathname.startsWith(`${item.url}/`) && item.url !== '/');
            return (
              <Link
                key={item.url}
                to={item.url}
                onClick={() => setIsMobileMenuOpen?.(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-green/10 text-brand-green shadow-sm"
                    : "text-muted-foreground hover:bg-black/[0.03] hover:text-foreground"
                )}
              >
                <div className={cn(
                  "flex shrink-0 h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-brand-green text-white shadow-sm" : "bg-black/[0.04] text-muted-foreground group-hover:bg-black/[0.06] group-hover:text-foreground"
                )}>
                  <item.icon className={cn("h-4 w-4", isActive ? "text-white" : "text-muted-foreground")} />
                </div>
                {(!isCollapsed || isMobileMenuOpen) && <span className="flex-1 truncate">{t(item.titleKey)}</span>}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="border-t border-border/60 p-3 space-y-1">
        <Link
          to="/login"
          onClick={() => setIsMobileMenuOpen?.(false)}
          className={cn("group flex items-center gap-3 rounded-xl py-2.5 text-[13px] font-medium text-muted-foreground hover:bg-black/[0.03] hover:text-foreground transition-all", isCollapsed && !isMobileMenuOpen ? "justify-center px-0" : "px-3")}
        >
          <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04] group-hover:bg-black/[0.06]">
            <LogOut className="h-4 w-4" />
          </div>
          {(!isCollapsed || isMobileMenuOpen) && <span className="truncate">{t("app.sidebar.logout", "Log out")}</span>}
        </Link>
      </div>
    </div>
  );
}

function DashboardTopbar({ onMenuClick }) {
  const { theme, setTheme } = useContext(ThemeContext);
  const { t } = useTranslation();

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-surface px-4 lg:px-6 w-full">
      <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-md hidden sm:flex items-center relative">
        <Search className="h-4 w-4 absolute left-3 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search rooms, recordings..."
          className="h-10 pl-9 bg-black/[0.02] border-transparent hover:border-border focus-within:border-brand-green/50 focus-within:bg-surface"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">

        {/* Theme Toggle */}
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        {/* Notifications */}
        <Link 
          to="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-green ring-2 ring-surface" />
        </Link>

        {/* Separator */}
        <div className="hidden sm:block h-6 w-px bg-border/60 mx-1" />

        {/* Avatar with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-brand-green/20 transition-all focus:outline-none">
              <AvatarFallback className="bg-gradient-to-br from-brand-blue to-brand-green text-white text-xs font-bold shadow-sm">AD</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 rounded-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">Admin User</p>
                <p className="text-xs leading-none text-muted-foreground">admin@konn3ct.com</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <Link to="/profile">
              <DropdownMenuItem className="cursor-pointer py-2 px-3 rounded-lg hover:bg-black/[0.04]">
                <UserIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{t("app.sidebar.profile", "Profile")}</span>
              </DropdownMenuItem>
            </Link>
            <Link to="/settings">
              <DropdownMenuItem className="cursor-pointer py-2 px-3 rounded-lg hover:bg-black/[0.04]">
                <SettingsIcon className="mr-3 h-4 w-4 text-muted-foreground" />
                <span>{t("app.sidebar.settings", "Settings")}</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuSeparator />
            <Link to="/login">
              <DropdownMenuItem className="cursor-pointer py-2 px-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 focus:text-red-500 focus:bg-red-50">
                <LogOut className="mr-3 h-4 w-4" />
                <span>{t("app.sidebar.logout", "Log out")}</span>
              </DropdownMenuItem>
            </Link>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

const AuthenticatedAppLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  return (
    <IsAuthenticated>
      <div className="flex h-screen w-full flex-col bg-muted/20">
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar 
            isMobileMenuOpen={isMobileMenuOpen} 
            setIsMobileMenuOpen={setIsMobileMenuOpen} 
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
          />
          
          {/* Mobile backdrop */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          <div className="flex flex-1 flex-col overflow-hidden w-full">
            <DashboardTopbar onMenuClick={() => setIsMobileMenuOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-muted/20">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
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
        path: "view-profile",
        element: <ViewProfile />,
      },
      {
        element: <AuthenticatedAppLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "dashboard/schedule/new", element: <NewSchedule /> },
          { path: "dashboard/rooms/new", element: <NewRoom /> },
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
          { path: "history/new", element: <NewInvite /> },
          { path: "settings", element: <Settings /> },
          { path: "notifications", element: <Notifications /> },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
