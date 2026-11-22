/** Wall-clock date and time in a timezone to an ISO instant (works on both server and client). */
export function zonedToIso(date: string, timeHHMM: string, timeZone: string) {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = timeHHMM.split(':').map(Number)
  const target = Date.UTC(y, mo - 1, d, h, mi)
  let t = target
  for (let i = 0; i < 4; i++) {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(t)).map((x) => [x.type, x.value]))
    const shown = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute))
    if (shown === target) return new Date(t).toISOString()
    t += target - shown
  }
  throw new Error('That time does not exist in your timezone (a clock change). Choose another.')
}
