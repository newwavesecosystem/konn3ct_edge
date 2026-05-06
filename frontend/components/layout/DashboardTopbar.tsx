"use client"

import { Menu, Search, Bell, Plus } from "lucide-react"
import { Button } from "../ui/Button"
import { Input } from "../ui/Input"
import { Avatar } from "../ui/Avatar"

export function DashboardTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-border/60 bg-surface px-4 lg:px-6 w-full">
      <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </Button>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <Input
          type="search"
          placeholder="Search rooms, recordings..."
          leftIcon={<Search className="h-4 w-4" />}
          className="h-10 bg-black/[0.02] border-transparent hover:border-border focus-within:border-brand-green/50 focus-within:bg-surface"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Quick create */}
        <Button size="sm" className="hidden sm:flex h-9 rounded-lg bg-brand-green hover:bg-[#287854] shadow-sm text-xs font-semibold">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New Meeting
        </Button>

        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04] text-text-muted hover:text-text-primary transition-colors">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-green ring-2 ring-surface" />
        </button>

        {/* Separator */}
        <div className="hidden sm:block h-6 w-px bg-border/60 mx-1" />

        {/* Avatar */}
        <Avatar fallback="AD" className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-brand-green/20 transition-all" />
      </div>
    </header>
  )
}
