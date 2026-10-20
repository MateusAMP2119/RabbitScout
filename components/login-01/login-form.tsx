import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

import { Button } from "@/components/login-01/ui/button"
import { Card } from "@/components/login-01/ui/card"
import { FieldLabel } from "@/components/login-01/ui/field"
import { Input } from "@/components/login-01/ui/input"

// Every row is exactly 48px (h-12, border-box, so the dividers sit inside the row).
// The card's outline is a ring rather than a border, so it adds no height to the grid.
// Focus rings are drawn inset so they never spill into the neighbouring row.
const focusInset =
  "focus-visible:ring-0 focus-visible:inset-ring-2 focus-visible:inset-ring-ring"
const row = "h-12 border-b"
const fieldRow = cn(row, "grid grid-cols-[96px_1fr]")
const fieldLabel = "h-full w-full border-r px-4"
// Cells share the card's background; a field only lifts when focused
const fieldInput = cn(
  "h-full rounded-none border-0 bg-transparent px-4 shadow-none dark:bg-transparent focus-visible:bg-input/30 dark:focus-visible:bg-input/30",
  focusInset
)

// Return in the username field moves on to an empty password field
// (the phone keyboard shows "Next") instead of submitting half a form
function nextOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter" || e.nativeEvent.isComposing) return
  const password = e.currentTarget.form?.elements.namedItem("password")
  if (password instanceof HTMLInputElement && !password.value) {
    e.preventDefault()
    password.focus()
  }
}

export function LoginForm({
  className,
  loading = false,
  ...props
}: React.ComponentProps<"div"> & { loading?: boolean }) {
  return (
    <div className={className} {...props}>
      <Card className="gap-0 rounded-none border-0 py-0 shadow-none ring-1 ring-border">
        <form noValidate>
          <div className={fieldRow}>
            <FieldLabel htmlFor="username" className={fieldLabel}>
              Username
            </FieldLabel>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              onKeyDown={nextOnEnter}
              className={fieldInput}
              required
            />
          </div>
          <div className={fieldRow}>
            <FieldLabel htmlFor="password" className={fieldLabel}>
              Password
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              enterKeyHint="go"
              className={fieldInput}
              required
            />
          </div>
          <Button
            type="submit"
            aria-busy={loading}
            className={cn("h-12 w-full rounded-none", focusInset)}
          >
            {/* The label stays centred; the spinner hangs off its right edge and
                cross-fades in (and out) with a small pop while logging in */}
            <span className="relative">
              Login
              <Loader2
                aria-hidden
                className={cn(
                  "absolute top-1/2 left-full ml-2 -translate-y-1/2 animate-spin transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none",
                  loading ? "scale-100 opacity-100" : "scale-50 opacity-0"
                )}
              />
            </span>
          </Button>
        </form>
      </Card>
    </div>
  )
}
