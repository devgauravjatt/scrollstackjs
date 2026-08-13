/**
 * Shared Tailwind class strings. Kept as constants rather than a component
 * library so each demo stays readable as plain markup.
 */

export const card = 'overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60'

export const bar =
  'flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5'

export const barTitle = 'inline-flex items-center gap-2 text-[13px] text-slate-400'

export const dot = 'size-2 rounded-full bg-teal-400 ring-4 ring-teal-400/15'

export const btn =
  'inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 ' +
  'text-xs font-medium text-slate-100 transition hover:border-teal-500 hover:bg-slate-700 ' +
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:bg-slate-800'

export const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-teal-400 px-3 py-1.5 text-xs font-semibold ' +
  'text-teal-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-40'

export const scrollBox =
  'h-80 overflow-y-auto overscroll-contain [scrollbar-color:#334155_transparent] [scrollbar-width:thin]'

export const row = 'flex items-center gap-3 border-b border-slate-800 px-4 py-2.5'

export const sentinel = 'flex min-h-14 items-center justify-center gap-2 text-[13px] text-slate-400'

export const footer =
  'flex flex-wrap items-center gap-3 border-t border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-500'

export const code = 'rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-teal-300'

export const spinner =
  'size-3 animate-spin rounded-full border-2 border-slate-600 border-t-teal-400 motion-reduce:[animation-duration:2.4s]'
