"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import {
  Check,
  ChevronDown,
  Globe,
  LogOut,
  Menu,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMark } from "@/components/layout/sidebar"
import { Identicon } from "@/components/shared/identicon"
import { useAuth } from "@/lib/auth/store"
import { usePreferences } from "@/lib/stores/preferences"
import { usePolling } from "@/hooks/use-polling"
import { cn } from "@/lib/utils"
import type { VHost } from "@/lib/rabbitmq/types"

// Header controls are full-height cells split by hairlines, flush to the right edge,
// in the same foreground as the sidebar's RabbitMQ wordmark
const CELL = "h-12 rounded-none border-l border-border/60 text-foreground hover:bg-muted/50"

export function Header({ onMobileMenu }: { onMobileMenu?: () => void }) {
  const router = useRouter()
  const { setTheme, resolvedTheme } = useTheme()
  const { user, clearAuth, hydrate } = useAuth()
  const { vhost, setVhost } = usePreferences()

  // Restore user info after hard reloads
  React.useEffect(() => {
    hydrate()
  }, [hydrate])

  // VHost list refreshes slowly — it rarely changes
  const { data: vhosts } = usePolling<VHost[]>("/api/rabbitmq/vhosts", { interval: 60_000 })

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    clearAuth()
    router.push("/login")
  }

  // Most brokers only have "/" — the scope picker is noise until there's a choice
  const showVhostPicker = (vhosts?.length ?? 0) > 1

  // Drop a persisted scope that no longer narrows anything (vhost deleted, or the only one)
  React.useEffect(() => {
    if (!vhosts || vhost === null) return
    if (!showVhostPicker || !vhosts.some((v) => v.name === vhost)) setVhost(null)
  }, [vhosts, vhost, showVhostPicker, setVhost])

  return (
    // Spans the whole width above the sidebar
    <header className="sticky top-0 z-30 flex h-12 items-center border-b border-border/60 bg-background/80 backdrop-blur-md">
      <SidebarMark />
      <div className="flex min-w-0 flex-1 items-center gap-3 pl-4 lg:pl-6">
        {/* Mobile menu */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={onMobileMenu}
        >
          <Menu className="h-4 w-4" />
          <span className="sr-only">Open navigation</span>
        </Button>

        <div className="ml-auto flex items-stretch">
          {/* VHost scope */}
          {showVhostPicker && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className={cn(CELL, "hidden gap-1.5 px-4 text-xs md:inline-flex")}>
                  <Globe className="h-3.5 w-3.5" />
                  <span className="max-w-[120px] truncate font-mono">{vhost ?? "All vhosts"}</span>
                  <ChevronDown className="h-3 w-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuLabel>Virtual host</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setVhost(null)}>
                  All vhosts
                  {vhost === null && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                {(vhosts ?? []).map((v) => (
                  <DropdownMenuItem key={v.name} onClick={() => setVhost(v.name)}>
                    <span className="font-mono text-xs">{v.name}</span>
                    {vhost === v.name && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Theme */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(CELL, "w-12")}
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 -translate-y-0.5 scale-100 rotate-0 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 -translate-y-0.5 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          {/* Account: who's signed in, and the way out, in one cell */}
          <div className="flex border-l border-border/60">
            <div className="hidden -translate-y-0.5 items-center gap-2 pl-4 pr-1 sm:flex">
              {user ? (
                <Identicon value={user.username} className="h-6 w-6 rounded-[4px] ring-1 ring-border" />
              ) : (
                <span className="h-6 w-6 rounded-[4px] bg-muted" />
              )}
              <div className="flex flex-col items-start gap-1">
                <span className="max-w-[160px] truncate text-[13px] font-medium leading-none text-foreground">
                  {user?.username ?? "—"}
                </span>
                {user?.isAdmin && (
                  <span className="text-[11px] leading-none text-muted-foreground">admin</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="group mr-2 h-12 w-12 rounded-none text-foreground hover:bg-transparent hover:text-foreground"
              onClick={handleLogout}
            >
              {/* The icon's first two paths are the arrow — it slides out of the door on hover */}
              <LogOut className="h-4 w-4 -translate-y-0.5 [&_path:not(:last-child)]:transition-transform [&_path:not(:last-child)]:duration-300 [&_path:not(:last-child)]:ease-out group-hover:[&_path:not(:last-child)]:translate-x-[3px] group-focus-visible:[&_path:not(:last-child)]:translate-x-[3px]" />
              <span className="sr-only">Log out</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}
