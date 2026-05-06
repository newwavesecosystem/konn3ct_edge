import Link from "next/link"
import { Button } from "../ui/Button"
import { Video } from "lucide-react"

export function PublicNavbar() {
  return (
    <header className="fixed top-4 inset-x-0 z-50 flex justify-center w-full px-4 pointer-events-none">
      <div className="w-full max-w-5xl rounded-2xl border border-white/20 bg-surface/80 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,44,136,0.05)] pointer-events-auto transition-all duration-300">
        <div className="flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-blue to-brand-green shadow-inner transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3 group-active:scale-95">
              <Video className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-brand-blue">konn3ct</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link href="/features" className="text-sm font-medium text-text-secondary transition-colors hover:text-brand-blue">Features</Link>
            <Link href="/pricing" className="text-sm font-medium text-text-secondary transition-colors hover:text-brand-blue">Pricing</Link>
            <Link href="/contact" className="text-sm font-medium text-text-secondary transition-colors hover:text-brand-blue">Contact</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="hidden md:inline-flex text-brand-blue hover:text-brand-blue hover:bg-brand-blue/5 font-semibold">Log in</Button>
            </Link>
            <Link href="/signup">
              <Button className="rounded-xl shadow-[0_4px_14px_rgba(32,116,80,0.3)] hover:shadow-[0_6px_20px_rgba(32,116,80,0.4)]">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
