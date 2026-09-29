'use client'

import { FormEvent, useMemo, useState } from 'react'
import { Activity, Archive, ArrowUpRight, BriefcaseBusiness, Check, ChevronDown, Circle, FileText, Flag, FolderOpen, Menu, Plus, Search, Send, Shield, Sparkles, UserRound, X } from 'lucide-react'

type Case = {
  id: string
  officer: string
  badge: string
  title: string
  status: 'Active' | 'Review' | 'Closed'
  updated: string
  detail: string
  location: string
  opened: string
  priority: string
  messages: { role: 'agent' | 'human'; text: string; time: string }[]
}

const cases: Case[] = [
  { id: 'CP-1048', officer: 'Mara Chen', badge: 'OFC-2714', title: 'North Harbor incident', status: 'Active', updated: '2m ago', detail: 'Use this workspace to review the incident record, surface inconsistencies, and prepare next steps with the case agent.', location: 'North Harbor District', opened: 'Sep 24, 2026', priority: 'High', messages: [
    { role: 'agent', text: 'I\'ve reviewed the initial report and evidence log. The timeline has one unresolved gap between 21:40 and 22:15.', time: '10:42 AM' },
    { role: 'human', text: 'What do we know about that gap so far?', time: '10:43 AM' },
    { role: 'agent', text: 'Two nearby cameras were offline. A witness statement places a gray sedan leaving the marina at approximately 21:58. I can map those details against the vehicle registry next.', time: '10:43 AM' },
  ] },
  { id: 'CP-1039', officer: 'D. Okafor', badge: 'OFC-1832', title: 'East Market theft', status: 'Review', updated: '18m ago', detail: 'Evidence review and witness follow-up for the East Market theft report.', location: 'East Market', opened: 'Sep 21, 2026', priority: 'Medium', messages: [{ role: 'agent', text: 'The evidence chain is complete. I\'m ready to summarize the open questions.', time: '9:18 AM' }] },
  { id: 'CP-1021', officer: 'L. Alvarez', badge: 'OFC-0941', title: 'Ridgeway welfare check', status: 'Active', updated: '1h ago', detail: 'Chronology, call notes, and follow-up actions for the Ridgeway welfare check.', location: 'Ridgeway', opened: 'Sep 19, 2026', priority: 'Medium', messages: [{ role: 'agent', text: 'There are three follow-up actions due before the next review.', time: '8:02 AM' }] },
  { id: 'CP-0998', officer: 'J. Whitaker', badge: 'OFC-2205', title: 'Kingston missing person', status: 'Closed', updated: 'Yesterday', detail: 'Archived case record and closing summary for the Kingston missing person case.', location: 'Kingston', opened: 'Sep 12, 2026', priority: 'Low', messages: [{ role: 'agent', text: 'This case was marked closed on September 28.', time: 'Sep 28' }] },
]

export default function Page() {
  const [selectedId, setSelectedId] = useState('CP-1048')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [caseMessages, setCaseMessages] = useState<Record<string, Case['messages']>>({})
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0]
  const messages = [...selected.messages, ...(caseMessages[selected.id] ?? [])]
  const visibleCases = useMemo(() => cases.filter((item) => `${item.title} ${item.officer} ${item.id}`.toLowerCase().includes(query.toLowerCase())), [query])

  function submitMessage(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim()) return
    const text = draft.trim()
    setDraft('')
    setCaseMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), { role: 'human', text, time: 'Now' }] }))
    window.setTimeout(() => setCaseMessages((current) => ({ ...current, [selected.id]: [...(current[selected.id] ?? []), { role: 'agent', text: `I'll review "${text}" against the case record and return a focused answer. In the live model setup, this is where the agent response will stream back.`, time: 'Now' }] })), 650)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6">
        <div className="flex items-center gap-3"><button className="rounded-md p-2 hover:bg-muted md:hidden" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle case list">{mobileNav ? <X size={18} /> : <Menu size={18} />}</button><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Shield size={17} /></div><div><p className="font-mono text-[10px] font-bold tracking-[0.18em] text-muted-foreground">FIELDNOTE</p><p className="text-xs text-muted-foreground">Case intelligence workspace</p></div></div>
        <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground sm:flex"><Circle className="fill-emerald-500 text-emerald-500" size={8} /> Agent online</div><div className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground"><UserRound size={15} /></div></div>
      </header>
      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className={`${mobileNav ? 'fixed inset-y-16 left-0 z-20 flex w-[300px] shadow-2xl' : 'hidden'} w-[300px] shrink-0 flex-col border-r border-border bg-sidebar md:flex`}>
          <div className="border-b border-sidebar-border p-4"><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] font-bold tracking-[0.16em] text-sidebar-foreground/50">MY CASES</p><p className="mt-1 text-sm font-medium">4 active records</p></div><button className="rounded-md border border-sidebar-border p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent" aria-label="New case"><Plus size={16} /></button></div><label className="flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2"><Search size={14} className="text-sidebar-foreground/50" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-xs outline-none placeholder:text-sidebar-foreground/40" placeholder="Search cases" /></label></div>
          <div className="flex-1 overflow-y-auto p-2">{visibleCases.map((item) => <button key={item.id} onClick={() => { setSelectedId(item.id); setMobileNav(false) }} className={`w-full rounded-md border p-3 text-left transition ${item.id === selected.id ? 'border-sidebar-primary/30 bg-sidebar-accent' : 'border-transparent hover:bg-sidebar-accent/60'}`}><div className="mb-2 flex items-center justify-between"><span className="font-mono text-[10px] font-bold tracking-wider text-sidebar-foreground/50">{item.id}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${item.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : item.status === 'Review' ? 'bg-amber-500/10 text-amber-700' : 'bg-sidebar-foreground/10 text-sidebar-foreground/50'}`}>{item.status}</span></div><p className="text-sm font-medium text-sidebar-foreground">{item.title}</p><div className="mt-2 flex items-center justify-between text-[11px] text-sidebar-foreground/50"><span>{item.officer}</span><span>{item.updated}</span></div></button>)}</div>
          <div className="border-t border-sidebar-border p-3"><button className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent"><Archive size={14} /> Archived cases <ArrowUpRight className="ml-auto" size={13} /></button></div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col lg:flex-row">
          <div className="min-w-0 flex-1 border-b border-border lg:border-b-0 lg:border-r"><div className="border-b border-border px-5 py-5 md:px-8"><div className="mb-4 flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.16em] text-muted-foreground"><span>CASE {selected.id}</span><span className="text-border">/</span><span>{selected.status.toUpperCase()}</span></div><div className="flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-balance md:text-3xl">{selected.title}</h1><p className="mt-2 text-sm text-muted-foreground">Assigned to <span className="font-medium text-foreground">{selected.officer}</span> · {selected.badge}</p></div><button className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted sm:flex">Case actions <ChevronDown size={14} /></button></div></div><div className="space-y-6 p-5 md:p-8"><div className="rounded-lg border border-border bg-card p-5"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><FileText size={15} className="text-primary" /> Case brief</div><p className="text-sm leading-6 text-muted-foreground">{selected.detail}</p></div><div><div className="mb-3 flex items-center justify-between"><h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Record details</h2><button className="text-xs font-medium text-primary hover:underline">Edit record</button></div><div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4"><Detail label="Location" value={selected.location} icon={<FolderOpen size={14} />} /><Detail label="Opened" value={selected.opened} icon={<Activity size={14} />} /><Detail label="Priority" value={selected.priority} icon={<Flag size={14} />} /><Detail label="Evidence" value="12 items" icon={<BriefcaseBusiness size={14} />} /></div></div><div><div className="mb-3 flex items-center gap-2"><h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Activity timeline</h2><span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">4 events</span></div><div className="space-y-0 border-l border-border pl-5"><TimelineItem title="Agent workspace opened" detail="Case context indexed for conversation" time="Today, 10:38 AM" active /><TimelineItem title="Evidence log updated" detail="12 items attached by {selected.officer}" time="Yesterday, 4:12 PM" /><TimelineItem title="Initial report filed" detail="North Harbor District" time="Sep 24, 2026" /></div></div></div></div>
          <div className="flex w-full flex-col bg-muted/30 lg:w-[430px] xl:w-[480px]"><div className="flex items-center justify-between border-b border-border bg-card px-5 py-4"><div><div className="flex items-center gap-2"><Sparkles size={15} className="text-primary" /><h2 className="text-sm font-semibold">Case agent</h2><span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">LIVE</span></div><p className="mt-1 text-xs text-muted-foreground">GPT-5 · grounded in case records</p></div><button className="rounded-md p-2 text-muted-foreground hover:bg-muted" aria-label="Agent settings"><span className="font-mono text-xs">•••</span></button></div><div className="flex-1 space-y-5 overflow-y-auto p-5">{messages.map((message, index) => <div key={`${message.time}-${index}`} className={`${message.role === 'human' ? 'ml-8' : 'mr-4'}`}><div className={`rounded-lg border p-3.5 text-sm leading-6 ${message.role === 'human' ? 'border-primary/20 bg-primary text-primary-foreground' : 'border-border bg-card'}`}>{message.role === 'agent' && <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-primary"><Sparkles size={12} /> Agent</div>}<p>{message.text}</p></div><p className={`mt-1.5 text-[10px] text-muted-foreground ${message.role === 'human' ? 'text-right' : ''}`}>{message.time}</p></div>)}</div><form onSubmit={submitMessage} className="border-t border-border bg-card p-4"><div className="rounded-lg border border-border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); submitMessage(event as unknown as FormEvent) } }} rows={2} className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground" placeholder="Ask about this case..." aria-label="Message case agent" /><div className="flex items-center justify-between px-1 pt-2"><span className="text-[10px] text-muted-foreground">Enter to send · Shift + Enter for new line</span><button type="submit" className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:opacity-90 disabled:opacity-50" disabled={!draft.trim()} aria-label="Send message"><Send size={14} /></button></div></div></form></div>
        </section>
      </div>
    </main>
  )
}

function Detail({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="bg-card p-3.5"><div className="mb-2 flex items-center gap-1.5 text-muted-foreground">{icon}<span className="text-[10px] uppercase tracking-wider">{label}</span></div><p className="truncate text-xs font-medium">{value}</p></div> }
function TimelineItem({ title, detail, time, active = false }: { title: string; detail: string; time: string; active?: boolean }) { return <div className="relative pb-5"><span className={`absolute -left-[25px] top-1.5 flex size-2.5 rounded-full border-2 border-background ${active ? 'bg-primary ring-4 ring-primary/10' : 'bg-muted-foreground/40'}`} /><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p><p className="mt-1.5 font-mono text-[10px] text-muted-foreground/70">{time}</p></div> }
