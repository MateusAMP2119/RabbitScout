"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { flushSync } from "react-dom"
import {
  ArrowRightLeft,
  Cable,
  LayoutDashboard,
  Layers,
  PanelLeft,
  PanelLeftClose,
  Radio,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { usePreferences } from "@/lib/stores/preferences"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { RabbitMark } from "@/components/shared/rabbit-mark"

// Everything sits on 48px rows, and every icon and the mascot share one vertical axis 32px in,
// the middle of the collapsed rail, so collapsing only takes the labels away.
const SIDEBAR_WIDTH = { collapsed: 64, expanded: 160 }

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/queues", label: "Queues", icon: Layers },
  { href: "/exchanges", label: "Exchanges", icon: ArrowRightLeft },
  { href: "/connections", label: "Connections", icon: Cable },
  { href: "/channels", label: "Channels", icon: Radio },
]

// A 40px item in a 48px row, its 16px icon 16px in from an 8px gutter; expanded, the sidebar hugs
// the longest label with the same inset on its right
const itemClass =
  "flex h-10 w-full items-center gap-3 rounded-lg px-4 text-sm transition-colors duration-(--duration-fast)"

function WithTooltip({ label, show, children }: { label: string; show: boolean; children: React.ReactElement }) {
  if (!show) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

function NavLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: (typeof navItems)[number]
  collapsed: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)

  return (
    <li className="flex h-12 items-center">
      <WithTooltip label={item.label} show={collapsed}>
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive ? "page" : undefined}
          aria-label={collapsed ? item.label : undefined}
          className={cn(
            itemClass,
            isActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-sidebar-foreground hover:bg-accent/70 hover:text-foreground",
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
      </WithTooltip>
    </li>
  )
}

export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean
  onNavigate?: () => void
}) {
  return (
    <>
      <nav className="flex-1 px-2 pt-2">
        <ul>
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </ul>
      </nav>
    </>
  )
}

/** The mascot heading the sidebar's column of the header: the login page's rabbit and name, sized to one row.
 *  Its canvas keeps room above the rabbit for a hop, so it rises past the row to centre the rabbit itself. */
export function SidebarMark() {
  const { sidebarCollapsed } = usePreferences()
  return (
    <div
      className="relative hidden h-12 shrink-0 lg:block"
      style={{ width: sidebarCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
    >
      <RabbitMark className="absolute left-[18px] top-[-8.75px] h-[52px] w-[34px] cursor-pointer" />
      {/* The login mark's name, sized to the row and starting on the nav labels' line; like there,
          it sits a little below the rabbit's middle to line up with its head */}
      {!sidebarCollapsed && (
        <span
          className="absolute left-[52px] top-1/2 -translate-y-1/2 pt-[2.5px] text-[15px] font-semibold leading-none tracking-[-0.225px] text-foreground"
          style={{ fontFamily: '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        >
          RabbitMQ
        </span>
      )}
    </div>
  )
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = usePreferences()

  // The one animation: the page cross-fades from one width to the other
  const toggle = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduced) return toggleSidebar()
    document.startViewTransition(() => flushSync(toggleSidebar))
  }

  return (
    <aside
      className="fixed bottom-0 left-0 top-12 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar lg:flex"
      style={{ width: sidebarCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
    >
      <SidebarContent collapsed={sidebarCollapsed} />

      <div className="flex h-12 shrink-0 items-center px-2">
        <WithTooltip label="Expand" show={sidebarCollapsed}>
          <button
            onClick={toggle}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(itemClass, "text-sidebar-foreground hover:bg-accent/70 hover:text-foreground")}
          >
            {sidebarCollapsed ? (
              <PanelLeft className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </WithTooltip>
      </div>
    </aside>
  )
}
