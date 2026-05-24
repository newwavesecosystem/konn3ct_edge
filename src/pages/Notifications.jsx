import React from "react";
import { Bell, CheckCircle2, Info, AlertTriangle, Calendar as CalendarIcon, Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";

// Mock data for notifications since no backend connection is required
const mockNotifications = [
  {
    id: 1,
    title: "New Meeting Scheduled",
    description: "You have been invited to 'Quarterly Planning' by John Doe.",
    time: "10 minutes ago",
    type: "info",
    icon: CalendarIcon,
    isUnread: true,
  },
  {
    id: 2,
    title: "System Update Complete",
    description: "Konn3ct dashboard has been updated to version 2.4.0 successfully.",
    time: "2 hours ago",
    type: "success",
    icon: CheckCircle2,
    isUnread: true,
  },
  {
    id: 3,
    title: "Upcoming Meeting Reminder",
    description: "Your meeting 'Product Sync' starts in 15 minutes.",
    time: "5 hours ago",
    type: "warning",
    icon: Clock,
    isUnread: false,
  },
  {
    id: 4,
    title: "Subscription Renewed",
    description: "Your premium subscription has been successfully renewed for another month.",
    time: "1 day ago",
    type: "success",
    icon: CheckCircle2,
    isUnread: false,
  },
  {
    id: 5,
    title: "Network Latency Warning",
    description: "We detected high latency during your last call. Check your internet connection.",
    time: "2 days ago",
    type: "warning",
    icon: AlertTriangle,
    isUnread: false,
  }
];

const Notifications = () => {
  const { t } = useTranslation();
  const [notifications, setNotifications] = React.useState(mockNotifications);

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isUnread: false })));
  };

  const removeNotification = (id) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getIconColor = (type) => {
    switch (type) {
      case "success": return "text-green-500 bg-green-500/10";
      case "warning": return "text-orange-500 bg-orange-500/10";
      case "error": return "text-red-500 bg-red-500/10";
      default: return "text-brand-blue bg-brand-blue/10";
    }
  };

  const unreadCount = notifications.filter(n => n.isUnread).length;

  return (
    <div className="w-full flex-1 p-4 md:p-6 lg:p-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
              <Bell className="h-6 w-6" />
            </div>
            {t("notifications.title", "Notifications")}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            {t("notifications.subtitle", "Stay updated with your latest meeting alerts, system announcements, and account activities.")}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button 
            variant="outline" 
            onClick={markAllAsRead}
            className="rounded-xl font-medium border-border/60 hover:bg-black/[0.02]"
          >
            <CheckCircle2 className="w-4 h-4 mr-2 text-muted-foreground" />
            {t("notifications.markAllRead", "Mark all as read")}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-surface border border-border/60 rounded-3xl">
            <div className="h-16 w-16 bg-black/[0.03] dark:bg-white/[0.03] rounded-full flex items-center justify-center mb-4">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No notifications yet</h3>
            <p className="text-sm text-muted-foreground mt-1">You're all caught up! Check back later for updates.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div 
              key={notification.id}
              className={cn(
                "group relative flex gap-4 p-5 rounded-2xl border transition-all duration-200 hover:shadow-md",
                notification.isUnread 
                  ? "bg-surface border-brand-green/30 shadow-sm" 
                  : "bg-surface/50 border-border/60 hover:bg-surface"
              )}
            >
              {notification.isUnread && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-brand-green rounded-r-full" />
              )}
              
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", getIconColor(notification.type))}>
                <notification.icon className="h-6 w-6" />
              </div>
              
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center justify-between gap-4">
                  <h4 className={cn("text-base font-semibold truncate", notification.isUnread ? "text-foreground" : "text-foreground/80")}>
                    {notification.title}
                  </h4>
                  <span className="shrink-0 text-xs font-medium text-muted-foreground">
                    {notification.time}
                  </span>
                </div>
                <p className={cn("mt-1 text-sm leading-relaxed", notification.isUnread ? "text-muted-foreground" : "text-muted-foreground/80")}>
                  {notification.description}
                </p>
              </div>

              <button 
                onClick={() => removeNotification(notification.id)}
                className="opacity-0 group-hover:opacity-100 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-black/[0.04] text-muted-foreground transition-all absolute right-4 top-4"
                title="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Notifications;
