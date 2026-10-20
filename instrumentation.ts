/** Runs once per server start; launches the metrics collector in the Node runtime. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startCollector } = await import('./lib/metrics/collector')
  // Not awaited: the collector loops for the life of the server
  void startCollector()
}
