"use client"

import { Suspense, ViewTransition, useRef, useState, type FocusEvent, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, X } from "lucide-react"
import { useAuth } from "@/lib/auth/store"
import { RabbitMark, type RabbitMarkHandle } from "@/components/shared/rabbit-mark"
import { LoginForm } from "@/components/login-01/login-form"
import "./login.css"

function LoginScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rabbit = useRef<RabbitMarkHandle>(null)

  // The rabbit hops whenever a field gains focus
  const handleFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLInputElement) rabbit.current?.hop()
  }

  // The login-01 form submits up to here
  const handleSubmit = async (e: FormEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (loading) return

    const fields = (e.target as HTMLFormElement).elements
    const usernameInput = fields.namedItem("username") as HTMLInputElement
    const passwordInput = fields.namedItem("password") as HTMLInputElement
    const username = usernameInput.value
    const password = passwordInput.value

    // 1. Empty fields show as a toast, and the first empty one takes focus
    if (!username || !password) {
      setError(!username ? "Username missing" : "Password missing")
      const empty = !username ? usernameInput : passwordInput
      empty.focus()
      return
    }
    // Close the phone keyboard so it doesn't hide the toast or the redirect
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    setLoading(true)
    setError(null)
    // The rabbit spin jumps while RabbitMQ checks the credentials
    const stopSpin = rabbit.current?.spin() ?? (() => Promise.resolve())
    // On success the spinner stays up until the next page cross-fades in
    let navigating = false

    // 2. RabbitMQ checks the credentials; a refusal shows as a toast
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Authentication failed")
        return
      }

      if (data.authenticated && data.user) {
        // Let the last spin jump land before moving on
        await stopSpin()
        setAuth(data.user)
        // Return to the page the user originally asked for — resolved
        // against our own origin so ?next= can never leave the app
        // (URL parsing also neutralizes backslash normalization tricks).
        let dest = "/"
        const next = searchParams.get("next")
        if (next) {
          try {
            const u = new URL(next, window.location.origin)
            if (u.origin === window.location.origin) dest = u.pathname + u.search + u.hash
          } catch {
            // Malformed — fall back to the dashboard
          }
        }
        navigating = true
        router.push(dest, { transitionTypes: ["login"] })
        router.refresh()
      } else {
        setError("Invalid response from server")
      }
    } catch {
      setError("Unable to connect. Check your network and RabbitMQ configuration.")
    } finally {
      void stopSpin()
      if (!navigating) setLoading(false)
    }
  }

  return (
    // Fades out as the page it logs in to fades in (the "login" transition, see globals.css)
    <ViewTransition exit={{ login: "login-fade", default: "none" }} default="none">
      <main className="ob-page">
        {/* Only the form is centred: the equal 1fr rows either side keep it in the middle,
            and the mark hangs off its top edge (the top row grows if the screen is too short) */}
        <div className="grid min-h-svh w-full grid-rows-[1fr_auto_1fr] justify-items-center p-6 md:p-10">
          <div className="flex w-full max-w-sm flex-col justify-end">
            <div className="ob-mark">
              <RabbitMark ref={rabbit} className="ob-mark-rabbit" />
              <span className="ob-mark-name">RabbitMQ</span>
            </div>
            <h1 className="sr-only">Log in to RabbitMQ</h1>
          </div>
          <LoginForm loading={loading} onSubmit={handleSubmit} onFocus={handleFocus} className="w-full max-w-sm" />
        </div>
        {error && (
          <div className="ob-toasts">
            <div className="ob-toast">
              <AlertCircle className="ob-toast-icon" />
              <p role="alert">{error}</p>
              <button type="button" aria-label="Dismiss" onClick={() => setError(null)}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </main>
    </ViewTransition>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  )
}
