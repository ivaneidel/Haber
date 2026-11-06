import { useEffect, useState } from 'react'

type Listener = (msg: string) => void
const listeners = new Set<Listener>()

/** Fire-and-forget confirmation message. */
export function toast(msg: string) {
  listeners.forEach((l) => l(msg))
}

export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const l: Listener = (m) => {
      setMsg(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 2400)
    }
    listeners.add(l)
    return () => {
      listeners.delete(l)
      clearTimeout(timer)
    }
  }, [])
  if (!msg) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status">
      <div className="sheet-in rounded-full bg-ink-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-ink-100 dark:text-ink-900">{msg}</div>
    </div>
  )
}
