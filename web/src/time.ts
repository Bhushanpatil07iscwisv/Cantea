/** Format a stored HH:mm clock value for display without changing scheduling data. */
export function formatClock(value: string): string {
  return value.replace(/\b([01]\d|2[0-3]):([0-5]\d)\b/g, (_, hours: string, minutes: string) => {
    const hour = Number(hours)
    return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`
  })
}
