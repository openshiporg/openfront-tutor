'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { Btn, Notice } from './ui'
import { deleteItem, runOperation, saveItem, type Command } from './request'

type Result = { success: boolean; error: string | null; data: unknown }

function useRun(onDone?: (data: unknown) => void) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<ReactNode>(null)
  const [pending, start] = useTransition()
  const run = (work: () => Promise<Result>, success?: (data: unknown) => ReactNode) => {
    setError(null); setInfo(null)
    start(async () => {
      const r = await work()
      if (!r.success) { setError(r.error || 'This could not be completed.'); return }
      if (success) setInfo(success(r.data))
      onDone?.(r.data)
      router.refresh()
    })
  }
  return { run, error, info, pending }
}

/**
 * A button that asks on the page before it acts. Not window.confirm: a dismissed or
 * blocked browser dialog made the click do nothing. Disabled until the page is live,
 * so an early click is visibly not taken.
 */
export function ConfirmButton({ label, confirm, onConfirm, variant = 'raised', pending, pendingLabel = 'Working…', yesLabel }: { label: string; confirm?: string; onConfirm: () => void; variant?: 'raised' | 'primary' | 'danger'; pending?: boolean; pendingLabel?: string; yesLabel?: string }) {
  const [live, setLive] = useState(false)
  const [asking, setAsking] = useState(false)
  useEffect(() => setLive(true), [])
  if (asking && confirm) {
    return (
      <span role="group" aria-label={confirm} className="inline-grid gap-1.5 rounded-md border p-2">
        <span className="text-sm">{confirm}</span>
        <span className="flex flex-wrap gap-2">
          <Btn variant={variant === 'raised' ? 'primary' : variant} onClick={() => { setAsking(false); onConfirm() }}>{yesLabel ?? `Yes, ${label.charAt(0).toLowerCase()}${label.slice(1)}`}</Btn>
          <Btn onClick={() => setAsking(false)}>Cancel</Btn>
        </span>
      </span>
    )
  }
  return <Btn variant={variant} disabled={!live || pending} onClick={() => (confirm ? setAsking(true) : onConfirm())}>{pending ? pendingLabel : label}</Btn>
}

/** One button that runs one tutor operation, with an optional confirmation. */
export function ActionButton({ op, vars, label, variant = 'raised', confirm, done, after }: { op: string; vars: Record<string, unknown>; label: string; variant?: 'raised' | 'primary' | 'danger'; confirm?: string; done?: (data: any) => ReactNode; after?: (data: any) => void }) {
  const { run, error, info, pending } = useRun(after)
  return (
    <span className="inline-grid gap-1.5">
      <ConfirmButton variant={variant} label={label} confirm={confirm} pending={pending} onConfirm={() => run(() => runOperation(op, vars), done)} />
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {info ? <Notice>{info}</Notice> : null}
    </span>
  )
}

/**
 * A form whose fields become the operation's variables through `toVars`.
 * Used for every platform form, so validation errors come back as sentences.
 */
export function ActionForm({ op, toVars, children, submit, className, done, after, resetOnDone }: { op: string; toVars: (form: FormData) => Record<string, unknown>; children: ReactNode; submit: string; className?: string; done?: (data: any) => ReactNode; after?: (data: any) => void; resetOnDone?: boolean }) {
  const { run, error, info, pending } = useRun(after)
  return (
    <form
      className={className ?? 'grid gap-3'}
      onSubmit={(e) => {
        e.preventDefault()
        const el = e.currentTarget
        const form = new FormData(el)
        let vars: Record<string, unknown>
        try { vars = toVars(form) } catch (err) { run(async () => ({ success: false, error: err instanceof Error ? err.message : 'Check the form.', data: null })); return }
        run(async () => { const r = await runOperation(op, vars); if (r.success && resetOnDone) el.reset(); return r }, done)
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-2"><Btn type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : submit}</Btn></div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
      {info ? <Notice>{info}</Notice> : null}
    </form>
  )
}

/** A form that creates or updates one item of a list through the generic API (its access rules apply). */
export function ItemForm({ list, id, toData, children, submit, className, resetOnDone }: { list: string; id?: string | null; toData: (form: FormData) => Record<string, unknown>; children: ReactNode; submit: string; className?: string; resetOnDone?: boolean }) {
  const { run, error, pending } = useRun()
  return (
    <form
      className={className ?? 'grid gap-3'}
      onSubmit={(e) => {
        e.preventDefault()
        const el = e.currentTarget
        let data: Record<string, unknown>
        try { data = toData(new FormData(el)) } catch (err) { run(async () => ({ success: false, error: err instanceof Error ? err.message : 'Check the form.', data: null })); return }
        run(async () => { const r: Command = await saveItem(list, id ?? null, data); if (r.success && resetOnDone) el.reset(); return r })
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-2"><Btn type="submit" variant="primary" disabled={pending}>{pending ? 'Saving…' : submit}</Btn></div>
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </form>
  )
}

export function DeleteItemButton({ list, id, label = 'Remove', confirm = 'Remove this?' }: { list: string; id: string; label?: string; confirm?: string }) {
  const { run, error, pending } = useRun()
  return (
    <span className="inline-grid gap-1.5">
      <ConfirmButton variant="danger" label={label} confirm={confirm} pending={pending} onConfirm={() => run(() => deleteItem(list, id))} />
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </span>
  )
}

/** A link the tutor sends by text or WhatsApp when there is no email (§7). */
export function CopyLink({ url, label = 'Copy link' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <code className="min-w-0 max-w-full truncate rounded border bg-muted/40 px-2 py-1 text-xs">{url}</code>
      <Btn onClick={async () => { await navigator.clipboard.writeText(url).catch(() => null); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? 'Copied' : label}</Btn>
    </span>
  )
}

/** Runs an operation that returns a link, then shows it to copy. */
export function LinkMaker({ op, vars, label }: { op: string; vars: Record<string, unknown>; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const { run, error, pending } = useRun()
  return (
    <span className="grid gap-2">
      {url ? <CopyLink url={url} /> : <Btn disabled={pending} onClick={() => run(async () => { const r = await runOperation(op, vars); if (r.success) setUrl(String((r.data as { url?: string })?.url ?? '')); return r })}>{pending ? 'Working…' : label}</Btn>}
      {error ? <Notice tone="alert">{error}</Notice> : null}
    </span>
  )
}
