"use client"

import * as React from "react"
import { Sidebar, SidebarContent } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { usePreferences } from "@/lib/stores/preferences"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarCollapsed } = usePreferences()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)

  return (
    <TooltipProvider delayDuration={300}>
      {/* Fades in over the login screen after logging in (see globals.css) */}
      <React.ViewTransition enter={{ login: "login-fade", default: "none" }} default="none">
        <div className="min-h-screen">
          <Header onMobileMenu={() => setMobileNavOpen(true)} />
          <Sidebar />

          {/* Mobile navigation drawer */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-40 bg-sidebar p-0 sm:max-w-40">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex h-full flex-col">
                <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className={cn(sidebarCollapsed ? "lg:ml-16" : "lg:ml-40")}>
            <main className="p-4 lg:p-6">
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>
      </React.ViewTransition>
    </TooltipProvider>
  )
}
