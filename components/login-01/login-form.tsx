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

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
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
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
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
              type="password"
              autoComplete="current-password"
              className={fieldInput}
              required
            />
          </div>
          <Button
            type="submit"
            className={cn("h-12 w-full rounded-none", focusInset)}
          >
            Login
          </Button>
        </form>
      </Card>
    </div>
  )
}
