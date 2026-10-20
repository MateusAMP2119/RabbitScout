// GitHub-style identicon: a 5×5 grid mirrored down the middle, one colour, on a light tile.
// Same input, same picture — so each account keeps its own avatar.
import { useMemo } from "react"
import { cn } from "@/lib/utils"

// 128-bit string hash (cyrb128) — stands in for GitHub's md5, as 32 hex digits
function hash128(str: string) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, "0")).join("")
}

// GitHub's recipe: the first 15 hex digits switch cells on (even = filled) for the left
// three columns, mirrored right; the last 7 pick an HSL colour. Lightness sits 10 points under
// GitHub's 55–75% so pale yellows and greens stay legible on the grey tile.
function identicon(value: string) {
  const hex = hash128(value)
  const cells: [number, number][] = []
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      if (parseInt(hex[col * 5 + row], 16) % 2 !== 0) continue
      cells.push([col, row])
      if (col < 2) cells.push([4 - col, row])
    }
  }
  const hue = (parseInt(hex.slice(25, 28), 16) / 4095) * 360
  const sat = 65 - (parseInt(hex.slice(28, 30), 16) / 255) * 20
  const lum = 65 - (parseInt(hex.slice(30, 32), 16) / 255) * 20
  return { cells, color: `hsl(${hue.toFixed(0)} ${sat.toFixed(0)}% ${lum.toFixed(0)}%)` }
}

export function Identicon({ value, className }: { value: string; className?: string }) {
  const { cells, color } = useMemo(() => identicon(value), [value])
  return (
    // Half a cell of margin around the grid, like GitHub's 420px tile with 35px padding
    <svg viewBox="-0.5 -0.5 6 6" shapeRendering="crispEdges" aria-hidden className={cn("shrink-0", className)}>
      <rect x="-0.5" y="-0.5" width="6" height="6" fill="#f0f0f0" />
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />
      ))}
    </svg>
  )
}
