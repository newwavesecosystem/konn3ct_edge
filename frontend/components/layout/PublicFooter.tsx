import Link from "next/link"
import { Video } from "lucide-react"

export function PublicFooter() {
  return (
    <footer className="w-full bg-[#F8F8F8] border-t border-border pt-16 pb-8">
      <div className="container mx-auto grid grid-cols-1 gap-12 md:grid-cols-5 px-4 md:px-6 max-w-6xl">
        <div className="md:col-span-2 flex flex-col gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue shadow-sm">
              <Video className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-text-primary">konn3ct</span>
          </Link>
          <p className="text-base text-text-secondary pr-4 leading-relaxed max-w-xs">
            The premium video conferencing and collaboration platform built for modern, fast-moving teams.
          </p>

        </div>

        <div>
          <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-text-primary">Product</h3>
          <ul className="space-y-4 text-sm text-text-secondary">
            <li><Link href="/features" className="hover:text-brand-blue transition-colors">Features</Link></li>
            <li><Link href="/pricing" className="hover:text-brand-blue transition-colors">Pricing</Link></li>
            <li><Link href="/recordings" className="hover:text-brand-blue transition-colors">eCinema</Link></li>
            <li><Link href="/security" className="hover:text-brand-blue transition-colors">Security</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-text-primary">Company</h3>
          <ul className="space-y-4 text-sm text-text-secondary">
            <li><Link href="/about" className="hover:text-brand-blue transition-colors">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-brand-blue transition-colors">Contact</Link></li>
            <li><Link href="/careers" className="hover:text-brand-blue transition-colors">Careers</Link></li>
            <li><Link href="/blog" className="hover:text-brand-blue transition-colors">Blog</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-6 text-sm font-bold uppercase tracking-wider text-text-primary">Legal</h3>
          <ul className="space-y-4 text-sm text-text-secondary">
            <li><Link href="/privacy" className="hover:text-brand-blue transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-brand-blue transition-colors">Terms of Service</Link></li>
            <li><Link href="/cookies" className="hover:text-brand-blue transition-colors">Cookie Policy</Link></li>
          </ul>
        </div>
      </div>

      <div className="container mx-auto mt-16 flex flex-col items-center justify-between border-t border-border pt-8 md:flex-row px-4 md:px-6 max-w-6xl">
        <p className="text-sm text-text-muted">
          © {new Date().getFullYear()} konn3ct. All rights reserved.
        </p>
        <div className="mt-4 md:mt-0 flex items-center gap-6 text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-green"></span>
            All systems operational
          </div>
        </div>
      </div>
    </footer>
  )
}
