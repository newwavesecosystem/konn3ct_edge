"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "../../lib/utils"
import {
  LayoutDashboard,
  Video,
  Calendar,
  Users,
  Film,
  CreditCard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronRight,
  X,
  Globe
} from "lucide-react"

const navigation = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Rooms", href: "/dashboard/rooms", icon: Video },
  { name: "Virtual Events", href: "/dashboard/events", icon: Globe },
  { name: "Schedule", href: "/dashboard/schedule", icon: Calendar },
  { name: "Teams", href: "/dashboard/teams", icon: Users },
  { name: "Recordings", href: "/dashboard/recordings", icon: Film },
  { name: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function DashboardSidebar({ 
  isMobileMenuOpen, 
  setIsMobileMenuOpen 
}: { 
  isMobileMenuOpen?: boolean; 
  setIsMobileMenuOpen?: (open: boolean) => void 
}) {
  const pathname = usePathname()

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-[260px] transform flex-col border-r border-border/60 bg-surface transition-transform duration-300 ease-in-out md:static md:flex md:translate-x-0 shadow-2xl md:shadow-none",
        isMobileMenuOpen ? "translate-x-0 flex" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-border/60">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={() => setIsMobileMenuOpen?.(false)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-blue to-brand-green shadow-md shadow-brand-green/20 transition-transform group-hover:scale-105">
            <Video className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-text-primary">konn3ct</span>
        </Link>
        <button 
          className="md:hidden p-1 text-text-muted hover:text-text-primary transition-colors"
          onClick={() => setIsMobileMenuOpen?.(false)}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4 px-3">
        <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">Menu</p>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== '/dashboard')
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen?.(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
                  isActive
                    ? "bg-brand-green/10 text-brand-green shadow-sm"
                    : "text-text-muted hover:bg-black/[0.03] hover:text-text-primary"
                )}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-brand-green text-white shadow-sm" : "bg-black/[0.04] text-text-muted group-hover:bg-black/[0.06] group-hover:text-text-secondary"
                )}>
                  <item.icon className="h-4 w-4" />
                </div>
                <span className="flex-1">{item.name}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-brand-green/60" />}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="border-t border-border/60 p-3 space-y-1">
        <Link
          href="/support"
          onClick={() => setIsMobileMenuOpen?.(false)}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-text-muted hover:bg-black/[0.03] hover:text-text-primary transition-all"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04]">
            <LifeBuoy className="h-4 w-4" />
          </div>
          Support
        </Link>

        {/* User profile */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-3 mt-2 bg-black/[0.02] border border-border/40">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-blue to-brand-green text-white text-xs font-bold shadow-sm">
            AD
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">Alex Doe</p>
            <p className="text-[11px] text-text-muted truncate">alex@konn3ct.io</p>
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-black/[0.06] text-text-muted hover:text-danger transition-colors">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
