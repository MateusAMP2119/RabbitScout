"use client"

import { useMemo } from "react"
import { useTheme } from "next-themes"
import * as echarts from "echarts/core"
import { LineChart } from "echarts/charts"
import { BrushComponent, GridComponent, ToolboxComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"
import { Chart, ChartPalette, TimeseriesChart as KumoTimeseriesChart } from "@cloudflare/kumo/components/chart"

// Kumo takes the ECharts instance from us so only these modules get bundled.
// Its option always declares a brush, so Brush/Toolbox are registered even though
// range selection is never switched on.
echarts.use([LineChart, GridComponent, TooltipComponent, BrushComponent, ToolboxComponent, CanvasRenderer])

/** Shared time axis (unix seconds) followed by one value array per series */
export type ColumnarData = [number[], ...number[][]]

function useIsDark() {
  const { resolvedTheme } = useTheme()
  // Unresolved before hydration; the app defaults to dark
  return resolvedTheme !== "light"
}

/** Kumo's categorical chart colours for the current theme, one per series */
export function useSeriesColors(count: number): string[] {
  const dark = useIsDark()
  return useMemo(
    () => Array.from({ length: count }, (_, i) => ChartPalette.categorical(i, dark)),
    [count, dark],
  )
}

interface TimeSeriesChartProps {
  data: ColumnarData
  series: Array<{ label: string; color: string }>
  yAxisFormat?: (v: number) => string
  /** Pixel height; Kumo sizes the canvas from this and fills the parent's width */
  height: number
}

export function TimeSeriesChart({ data, series, yAxisFormat, height }: TimeSeriesChartProps) {
  const dark = useIsDark()

  const kumoData = useMemo(
    () =>
      series.map((s, i) => ({
        name: s.label,
        color: s.color,
        data: data[0].map((t, j) => [t * 1000, data[i + 1]?.[j] ?? 0] as [number, number]),
      })),
    [data, series],
  )

  // Seconds only matter on short windows (Live, 10m)
  const ts = data[0]
  const span = ts.length > 1 ? ts[ts.length - 1] - ts[0] : 0
  const tickTime = (ms: number) =>
    new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      ...(span < 900 && { second: "2-digit" }),
    })

  return (
    <KumoTimeseriesChart
      echarts={echarts}
      data={kumoData}
      height={height}
      isDarkMode={dark}
      xAxisTickFormat={tickTime}
      yAxisTickFormat={yAxisFormat}
      tooltipValueFormat={yAxisFormat}
      tooltipTimestampFormat={(ms) => new Date(ms).toLocaleTimeString()}
      tooltipFollowCursor="x"
    />
  )
}

interface SparklineProps {
  /** Window bounds and bucket times, unix seconds */
  from: number
  to: number
  ts: number[]
  /** null leaves a gap */
  values: Array<number | null>
  height: number
}

// Axis-less line for behind a stat tile: Kumo's Chart with TimeseriesChart's line
// look (palette colour, no symbols, gradient fill), toned down so the label and
// value stay readable on top. The x-axis spans the whole window, so a short
// recording sits at the right edge rather than stretching.
export function Sparkline({ from, to, ts, values, height }: SparklineProps) {
  const dark = useIsDark()

  const options = useMemo(() => {
    const color = ChartPalette.categorical(0, dark)
    return {
      animation: false,
      // Bottom half only, under the text; a flat series lies near the floor
      grid: { left: 0, right: 0, top: 26, bottom: 0 },
      xAxis: { type: "time" as const, show: false, min: from * 1000, max: to * 1000 },
      yAxis: {
        type: "value" as const,
        show: false,
        min: ({ min, max }: { min: number; max: number }) => (min === max ? min - 1 : min),
        max: ({ min, max }: { min: number; max: number }) => (min === max ? max + 9 : max),
      },
      series: [
        {
          type: "line" as const,
          silent: true,
          showSymbol: false,
          color,
          lineStyle: { width: 1, opacity: 0.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: echarts.color.modifyAlpha(color, 0.2) },
              { offset: 1, color: echarts.color.modifyAlpha(color, 0) },
            ]),
          },
          data: ts.map((t, i) => [t * 1000, values[i]]),
        },
      ],
    }
  }, [dark, from, to, ts, values])

  return <Chart echarts={echarts} options={options} isDarkMode={dark} height={height} />
}
