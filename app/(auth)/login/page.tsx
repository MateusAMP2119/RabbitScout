"use client"

import { Suspense, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, X } from "lucide-react"
import { useAuth } from "@/lib/auth/store"
import { RabbitMark } from "@/components/shared/rabbit-mark"
import { LoginForm } from "@/components/login-01/login-form"
import "./login.css"

function LoginScreen() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The login-01 form submits up to here
  const handleSubmit = async (e: FormEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (loading) return

    const fields = (e.target as HTMLFormElement).elements
    const username = (fields.namedItem("username") as HTMLInputElement).value
    const password = (fields.namedItem("password") as HTMLInputElement).value

    // 1. Empty fields show as a toast
    if (!username || !password) {
      setError(!username ? "Username missing" : "Password missing")
      return
    }
    setLoading(true)
    setError(null)

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
        router.push(dest)
        router.refresh()
      } else {
        setError("Invalid response from server")
      }
    } catch {
      setError("Unable to connect. Check your network and RabbitMQ configuration.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="ob-page">
      {/* Only the form is centred: the equal 1fr rows either side keep it in the middle,
          and the mark hangs off its top edge (the top row grows if the screen is too short) */}
      <div className="grid min-h-svh w-full grid-rows-[1fr_auto_1fr] justify-items-center p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col justify-end">
          <div className="ob-mark">
            <RabbitMark className="ob-mark-rabbit" />
            <span className="ob-mark-name">RabbitMQ</span>
          </div>
          <h1 className="sr-only">Log in to RabbitMQ</h1>
        </div>
        <LoginForm onSubmit={handleSubmit} className="w-full max-w-sm" />
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
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  )
}
