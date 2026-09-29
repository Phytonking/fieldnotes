'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, AudioLines, Check, ChevronDown, Circle, Menu, MessageSquare, Mic, Moon, MoreHorizontal, Plus, Search, Shield, Sparkles, Sun, UserRound, Wrench, X } from 'lucide-react'
import { openai } from '@ai-sdk/openai'
import { experimental_useRealtime } from '@ai-sdk/react'
import { useEveAgent } from 'eve/react'
import { loadChatSnapshot, saveChatSnapshot, type StoredLogEntry } from '@/lib/chat-store'

type LogEntry = StoredLogEntry
type CaseItem = { id: string; title: string; location: string; status: 'LIVE' | 'STANDBY' | 'CLOSED'; time: string; unread?: boolean; address?: string; callTime?: string; callType?: string }

const liveVoiceModel = openai.experimental_realtime('gpt-live-1')
const liveGatewayUrl = 'wss://ai-gateway.vercel.sh/v1/live/sessions'

const initialCases: CaseItem[] = [
  { id: 'CP-1048', title: 'North Harbor incident', location: 'North Harbor', status: 'LIVE', time: 'now', unread: true },
  { id: 'CP-1039', title: 'East Market theft', location: 'East Market', status: 'STANDBY', time: '18m' },
  { id: 'CP-1021', title: 'Ridgeway welfare check', location: 'Ridgeway', status: 'STANDBY', time: '1h' },
  { id: 'CP-0998', title: 'Kingston missing person', location: 'Kingston', status: 'CLOSED', time: 'Yesterday' },
]

const firstLog: LogEntry[] = [
  { id: 1, kind: 'system', time: '10:41', text: 'Case context loaded', detail: 'Scene brief · 12 evidence items · 4 witness notes' },
  { id: 2, kind: 'officer', time: '10:42', duration: '0:08', transcript: 'I’m heading to the north entrance. Can you pull up the latest scene brief?' },
  { id: 3, kind: 'tool', time: '10:42', text: 'Retrieved scene brief', detail: 'North Harbor perimeter · updated 10:38 AM' },
  { id: 4, kind: 'assistant', time: '10:42', duration: '0:14', transcript: 'The north entrance is clear. The last report notes a witness near the loading dock and a 35-minute gap in the timeline between 9:40 and 10:15 PM.' },
  { id: 5, kind: 'officer', time: '10:43', duration: '0:04', transcript: 'Got it. I’m at the entrance now.' },
  { id: 6, kind: 'assistant', time: '10:43', duration: '0:07', transcript: 'Understood. I’ve kept the perimeter notes and witness timeline here so they’re ready when you need them.' },
]

export default function Page() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [selectedId, setSelectedId] = useState('CP-1048')
  const [cases, setCases] = useState(initialCases)
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({ 'CP-1048': firstLog })
  const [agentOn, setAgentOn] = useState(false)
  const [mobileRail, setMobileRail] = useState(false)
  const [search, setSearch] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'local' | 'connected' | 'error'>('checking')
  const [liveToken, setLiveToken] = useState('')
  const [liveInstructions, setLiveInstructions] = useState('')
  const [pendingLiveStream, setPendingLiveStream] = useState<MediaStream | null>(null)
  const [liveContextUpdate, setLiveContextUpdate] = useState<{ content: string; channel: 'thinking' | 'commentary' } | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingChatId = useRef('')
  const transcriptEntriesRef = useRef(new Map<string, string>())
  const activeOfficerTranscriptRef = useRef({ startMs: -1, text: '' })
  const lastMemoryQueryRef = useRef('')
  const memorySearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0]
  const currentLogs = logs[selectedId] ?? []
  const realtimeConfig = useMemo(() => ({
    instructions: liveInstructions || 'You are Scout, the concise OnScene field assistant. Listen to the officer and follow your system instructions.',
    providerOptions: { openai: { store: false, delegation: { type: 'client' as const } } },
  }), [liveInstructions])
  const liveVoice = experimental_useRealtime({
    model: liveVoiceModel,
    api: {
      websocket: liveGatewayUrl,
      protocols: liveToken ? ['ai-gateway-realtime.v1', `ai-gateway-auth.${liveToken}`] : [],
    },
    sessionConfig: realtimeConfig,
    sampleRate: 24000,
    maxPlaybackBufferSeconds: 2,
    onEvent(event) {
      const chatId = recordingChatId.current
      if (event.type === 'session-started') {
        setLiveContextUpdate({ content: 'Start the conversation now by asking the officer what they are seeing. Do not list records.', channel: 'commentary' })
        return
      }
      if (event.type === 'session-usage') {
        const seconds = Math.floor(event.usage.seconds)
        setLiveUsage(`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`)
        return
      }
      if (event.type !== 'transcript-fragment' || !chatId) return

      const speaker = event.speaker === 'user' ? 'officer' : 'assistant'
      const segmentId = `${chatId}:live:${speaker}:${event.startMs}`
      const transcript = `${transcriptEntriesRef.current.get(segmentId) ?? ''}${event.delta}`
      transcriptEntriesRef.current.set(segmentId, transcript)
      setLogs((all) => {
        const rows = all[chatId] ?? []
        const existing = rows.findIndex((entry) => entry.memoryId === segmentId)
        const next: LogEntry = {
          id: existing >= 0 ? rows[existing].id : Date.now() + Math.random(),
          memoryId: segmentId,
          kind: speaker,
          time: 'now',
          transcript,
          duration: 'live',
        }
        return { ...all, [chatId]: existing >= 0 ? rows.map((entry, index) => index === existing ? next : entry) : [...rows, next] }
      })

      if (event.speaker === 'user') {
        const active = activeOfficerTranscriptRef.current
        activeOfficerTranscriptRef.current = event.startMs === active.startMs
          ? { startMs: active.startMs, text: `${active.text}${event.delta}` }
          : { startMs: event.startMs, text: event.delta }
        if (memorySearchTimerRef.current) clearTimeout(memorySearchTimerRef.current)
        const query = activeOfficerTranscriptRef.current.text.trim().slice(-900)
        if (query.length >= 8) {
          memorySearchTimerRef.current = setTimeout(() => { void searchLiveMemory(chatId, query) }, 900)
        }
      }
    },
    onError(error) {
      const chatId = recordingChatId.current
      setAgentOn(false)
      if (!chatId) return
      setLogs((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'GPT-Live connection interrupted', detail: error.message }] }))
    },
  })
  const [liveUsage, setLiveUsage] = useState('0:00')

  useEffect(() => {
    if (!liveContextUpdate || liveVoice.status !== 'connected') return
    const contextUpdate = liveContextUpdate
    setLiveContextUpdate(null)
    void liveVoice.sendEvent({
      type: 'context-append',
      delegationId: null,
      content: contextUpdate.content,
      providerOptions: { openai: { channel: contextUpdate.channel } },
    }).catch((error) => {
      console.error('Could not update GPT-Live context:', error instanceof Error ? error.message : 'unknown error')
    })
  }, [liveContextUpdate, liveVoice.status, liveVoice.sendEvent])

  useEffect(() => {
    if (!liveToken || !pendingLiveStream || !liveInstructions) return
    let active = true
    void liveVoice.connect({ stream: pendingLiveStream }).then(() => {
      if (active) {
        setAgentOn(true)
        setPendingLiveStream(null)
      }
    }).catch((error) => {
      if (active) {
        setAgentOn(false)
        setLogs((all) => ({ ...all, [recordingChatId.current]: [...(all[recordingChatId.current] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Could not start GPT-Live', detail: error instanceof Error ? error.message : 'Check the live assistant connection.' }] }))
      }
    })
    return () => { active = false }
  }, [liveToken, liveInstructions, pendingLiveStream, liveVoice.connect])

  useEffect(() => () => {
    if (memorySearchTimerRef.current) clearTimeout(memorySearchTimerRef.current)
    liveVoice.disconnect()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [liveVoice.disconnect])

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('on-scene-theme')
    const preferredTheme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    setTheme(preferredTheme)
    document.documentElement.style.colorScheme = preferredTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', preferredTheme === 'dark' ? '#141613' : '#f7f7f5')
  }, [])

  function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(nextTheme)
    window.localStorage.setItem('on-scene-theme', nextTheme)
    document.documentElement.style.colorScheme = nextTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'dark' ? '#141613' : '#f7f7f5')
  }

  useEffect(() => {
    let active = true
    loadChatSnapshot().then((snapshot) => {
      if (!active) return
      if (snapshot) {
        setCases(snapshot.cases)
        setLogs(Object.fromEntries(Object.entries(snapshot.logs).map(([caseId, entries]) => [
          caseId,
          entries.map((entry) => ({ ...entry, audioUrl: entry.audioBlob ? URL.createObjectURL(entry.audioBlob) : undefined })),
        ])))
        if (snapshot.selectedId && snapshot.cases.some((item) => item.id === snapshot.selectedId)) setSelectedId(snapshot.selectedId)
        else if (snapshot.cases.length) setSelectedId(snapshot.cases[0].id)
      }
      setStorageReady(true)
    }).catch(() => {
      if (!active) return
      setStorageError(true)
      setStorageReady(true)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!storageReady) return
    saveChatSnapshot({ cases, logs, selectedId }).then(() => setStorageError(false)).catch(() => setStorageError(true))
  }, [cases, logs, selectedId, storageReady])

  useEffect(() => {
    if (!storageReady) return
    const timeout = window.setTimeout(() => {
      void fetch('/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chats: cases.map((item) => ({ ...item, logs: logs[item.id] ?? [] })) }),
        keepalive: true,
      }).then((response) => {
        setDatabaseStatus(response.status === 204 ? 'local' : response.ok ? 'connected' : 'error')
      }).catch(() => setDatabaseStatus('error'))
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [cases, logs, storageReady])

  async function searchLiveMemory(chatId: string, query: string) {
    if (!query || query === lastMemoryQueryRef.current) return
    lastMemoryQueryRef.current = query
    try {
      const response = await fetch('/api/live/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId: chatId, query }),
      })
      const result = await response.json() as {
        system?: string
        checkedAt?: string
        results?: Array<{ role: string; content: string; record: { title: string; chatId: string; savedAt: string } }>
        error?: string
      }
      if (!response.ok) throw new Error(result.error || 'Neon case memory search failed.')
      const records = result.results ?? []
      const detail = records.length
        ? records.map((record) => `${record.record.title} (${record.record.chatId}), saved ${new Date(record.record.savedAt).toLocaleString()}: ${record.content}`).join('\n')
        : `No matching prior case-chat messages. Checked ${result.checkedAt ? new Date(result.checkedAt).toLocaleString() : 'just now'}.`
      setLogs((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), { id: Date.now() + Math.random(), kind: 'tool', time: 'now', text: `Searched ${result.system ?? 'Neon case chat memory'}`, detail: records.length ? `${records.length} saved chat message(s) returned.` : 'No matching prior messages.' }] }))
      setLiveContextUpdate({
        channel: 'thinking',
        content: `Connected system result: ${result.system ?? 'Neon case chat memory'}. Checked ${result.checkedAt ? new Date(result.checkedAt).toISOString() : 'just now'}. This is only saved chat history for the selected case, not a live incident or neighborhood records feed. ${records.length ? `Records returned: ${detail}` : 'No matching prior chat messages were returned.'}`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Neon case memory is unavailable.'
      setLogs((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), { id: Date.now() + Math.random(), kind: 'tool', time: 'now', text: 'Neon case chat memory unavailable', detail: message }] }))
      setLiveContextUpdate({ channel: 'thinking', content: `Neon case chat memory could not be searched. Do not claim that a neighborhood records or incident feed was checked.` })
    }
  }

  function selectCase(item: CaseItem) {
    liveVoice.disconnect()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recordingChatId.current = ''
    setLiveToken('')
    setLiveInstructions('')
    setPendingLiveStream(null)
    setSelectedId(item.id)
    setMobileRail(false)
    setAgentOn(false)
    setLiveUsage('0:00')
  }

  function newChat() {
    liveVoice.disconnect()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recordingChatId.current = ''
    setLiveToken('')
    setLiveInstructions('')
    setPendingLiveStream(null)
    const id = `CP-${String(1100 + cases.length)}`
    const fresh = { id, title: 'New scene chat', location: 'Unassigned', status: 'STANDBY' as const, time: 'now' }
    setCases((all) => [fresh, ...all])
    setLogs((all) => ({ ...all, [id]: [{ id: Date.now(), kind: 'system', time: 'now', text: 'New voice chat created', detail: 'Voice turns and case activity will stay together here.' }] }))
    setSelectedId(id)
    setAgentOn(false)
    setLiveUsage('0:00')
    setMobileRail(false)
  }

  async function startAgent() {
    let stream: MediaStream | null = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } })
      streamRef.current = stream
      recordingChatId.current = selectedId
      const response = await fetch('/api/live/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callSlip: selected }),
      })
      const setup = await response.json() as { token?: string; expiresAt?: number; instructions?: string; error?: string }
      if (!response.ok || !setup.token || !setup.instructions) throw new Error(setup.error || 'GPT-Live could not be started.')
      if (setup.expiresAt && Date.now() >= setup.expiresAt * 1000) throw new Error('The live-session token expired. Try again.')
      transcriptEntriesRef.current.clear()
      activeOfficerTranscriptRef.current = { startMs: -1, text: '' }
      lastMemoryQueryRef.current = ''
      setLiveUsage('0:00')
      setLiveInstructions(setup.instructions)
      setLiveToken(setup.token)
      setPendingLiveStream(stream)
      setAgentOn(true)
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'GPT-Live assistant starting', detail: 'Full-duplex audio · AI Gateway connected' }] }))
    } catch (error) {
      setAgentOn(false)
      stream?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      recordingChatId.current = ''
      const message = error instanceof Error ? error.message : 'Allow microphone access and check the AI Gateway connection.'
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live assistant unavailable', detail: message }] }))
    }
  }

  async function endAgent() {
    await liveVoice.close().catch(() => liveVoice.disconnect())
    setAgentOn(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recordingChatId.current = ''
    setLiveToken('')
    setLiveInstructions('')
    setPendingLiveStream(null)
    setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live assistant ended', detail: 'Activity saved to this chat.' }] }))
  }

  const visibleCases = cases.filter((item) => `${item.title} ${item.location} ${item.id}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <main data-theme={theme} className="on-scene flex h-[100dvh] min-h-[560px] overflow-hidden bg-[var(--scene-bg)] text-[var(--scene-fg)]">
      {mobileRail && <button onClick={() => setMobileRail(false)} className="fixed inset-0 z-30 bg-black/20 md:hidden" aria-label="Close chat rail" />}
      <aside className={`${mobileRail ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[286px] shrink-0 flex-col border-r border-[var(--scene-border)] bg-[var(--scene-panel)] transition-transform md:relative md:translate-x-0`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[var(--scene-border-soft)] px-5">
          <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-[10px] bg-[var(--scene-mark)] text-white"><Shield size={15} strokeWidth={1.8} /></div><div><p className="text-[13px] font-semibold tracking-[-0.02em]">On Scene</p><p className="mt-0.5 text-[10px] text-[var(--scene-muted)]">Live field assistant</p></div></div>
          <button onClick={() => setMobileRail(false)} className="rounded-md p-1.5 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)] md:hidden" aria-label="Close sidebar"><X size={17} /></button>
          <button className="hidden rounded-md p-1.5 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)] md:block" aria-label="Workspace options"><MoreHorizontal size={17} /></button>
        </div>
        <div className="px-3 pt-5">
          <div className="mb-2 flex items-center justify-between px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--scene-muted)]">Your chats <span className="ml-1 font-normal">{cases.length}</span></p><button onClick={newChat} className="rounded-md p-1.5 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)] hover:text-[var(--scene-text)]" aria-label="New chat"><Plus size={15} /></button></div>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--scene-border-soft)] bg-[var(--scene-card)] px-2.5 py-2"><Search size={13} className="shrink-0 text-[var(--scene-muted)]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[var(--scene-muted)]" placeholder="Search chats" /></label>
          <div className="space-y-1">{visibleCases.map((item) => <button key={item.id} onClick={() => selectCase(item)} className={`group w-full rounded-lg px-2.5 py-2.5 text-left transition ${item.id === selectedId ? 'bg-[var(--scene-active)]' : 'hover:bg-[var(--scene-hover)]'}`}><div className="flex items-start gap-2.5"><div className={`mt-[3px] flex size-7 shrink-0 items-center justify-center rounded-[8px] ${item.id === selectedId ? 'bg-[var(--scene-card)] text-[var(--scene-text)]' : 'bg-[var(--scene-hover)] text-[var(--scene-muted)]'}`}><MessageSquare size={13} strokeWidth={1.8} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[12px] font-medium text-[var(--scene-text)]">{item.title}</p><span className="shrink-0 text-[9px] text-[var(--scene-muted)]">{item.time}</span></div><div className="mt-1 flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${item.status === 'LIVE' ? 'bg-[#6ca17c]' : item.status === 'CLOSED' ? 'bg-[#c7c7c1]' : 'bg-[#d4aa61]'}`} /><p className="truncate text-[10px] text-[var(--scene-muted)]">{item.id} · {item.location}</p>{item.unread && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[#587963]" />}</div></div></div></button>)}</div>
        </div>
        <div className="mt-auto border-t border-[var(--scene-border-soft)] p-3"><button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[11px] text-[var(--scene-muted)] hover:bg-[var(--scene-hover)]"><Archive size={14} /><span>Archived chats</span><ChevronDown className="ml-auto rotate-[-90deg]" size={13} /></button><div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2"><div className="flex size-7 items-center justify-center rounded-full bg-[var(--scene-border-soft)] text-[var(--scene-text)]"><UserRound size={14} /></div><div className="min-w-0"><p className="text-[11px] font-medium">Mara Chen</p><p className="text-[10px] text-[var(--scene-muted)]">Field officer</p></div><MoreHorizontal className="ml-auto text-[var(--scene-muted)]" size={15} /></div></div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[var(--scene-border)] bg-[var(--scene-panel)] px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileRail(true)} className="rounded-md p-1.5 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)] md:hidden" aria-label="Open chats"><Menu size={17} /></button><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-[14px] font-semibold tracking-[-0.02em]">{selected.title}</h1><ChevronDown size={13} className="shrink-0 text-[var(--scene-muted)]" /></div><p className="mt-0.5 truncate text-[10px] text-[var(--scene-muted)]">{selected.id} <span className="mx-1 text-[var(--scene-muted)]">·</span> {selected.location}</p></div></div>
          <div className="flex items-center gap-2"><div title={storageError ? 'Local database is unavailable; changes may not persist.' : databaseStatus === 'connected' ? 'Chats are saved in this browser and synced to Neon.' : databaseStatus === 'error' ? 'Neon sync failed; the browser copy remains available.' : 'Chats are saved in this browser. Neon sync is not configured.'} className="hidden items-center gap-1.5 rounded-full border border-[var(--scene-border)] bg-[var(--scene-card)] px-2.5 py-1.5 text-[10px] text-[var(--scene-muted)] sm:flex"><Circle size={7} className={storageError || databaseStatus === 'error' ? 'fill-[#bf6c55] text-[#bf6c55]' : 'fill-[#79a084] text-[#79a084]'} /> {storageError ? 'Storage unavailable' : databaseStatus === 'connected' ? 'Neon connected' : databaseStatus === 'error' ? 'Neon sync issue' : 'Saved on device'}</div><button onClick={toggleTheme} className="rounded-md p-2 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)]" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}</button><button className="rounded-md p-2 text-[var(--scene-muted)] hover:bg-[var(--scene-hover)]" aria-label="More conversation options"><MoreHorizontal size={17} /></button></div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-8 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto max-w-[760px]">
              <div className="mb-8 flex items-center gap-3"><div className="h-px flex-1 bg-[var(--scene-border-soft)]" /><span className="text-[9px] font-medium uppercase tracking-[0.13em] text-[var(--scene-muted)]">Today · 10:41 AM</span><div className="h-px flex-1 bg-[var(--scene-border-soft)]" /></div>
              <div className="space-y-6">{currentLogs.map((entry) => <LogRow key={entry.id} entry={entry} />)}</div>
              {currentLogs.length === 0 && <div className="rounded-xl border border-dashed border-[var(--scene-border)] p-8 text-center"><MessageSquare className="mx-auto mb-3 text-[var(--scene-muted)]" size={19} /><p className="text-[13px] font-medium">Start a voice chat</p><p className="mt-1 text-[11px] text-[var(--scene-muted)]">Voice turns and case activity will stay together here.</p></div>}
              {liveVoice.isCapturing && <div className="mt-6 flex items-center gap-2 pl-10 text-[10px] text-[#58735e]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> Listening live · {liveUsage}</div>}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--scene-border)] bg-[var(--scene-panel)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto flex max-w-[760px] flex-col items-center">
              <DemoToolSweep
                key={selected.id}
                caseId={selected.id}
                title={selected.title}
                location={selected.location}
                onToolEvent={(entry) => setLogs((all) => ({ ...all, [selected.id]: [...(all[selected.id] ?? []), entry] }))}
              />
              {agentOn ? <><div className="mb-3 flex items-center gap-2 text-[10px] text-[var(--scene-muted)]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> {liveVoice.status === 'connected' ? `GPT-Live · ${liveUsage}` : 'Connecting to GPT-Live'}</div><div className="mb-3 flex h-12 items-center gap-1" aria-label="Live microphone activity">{[10, 19, 13, 28, 17, 36, 20, 13, 25, 15, 32, 18, 11, 27, 16, 34, 19, 12, 24, 15].map((height, index) => <span key={index} className="w-1 animate-pulse rounded-full bg-[#829783]" style={{ height, animationDelay: `${index * 45}ms` }} />)}</div><button onClick={endAgent} className="rounded-lg border border-[var(--scene-border)] bg-[var(--scene-card)] px-4 py-2 text-[10px] font-medium text-[var(--scene-text)] hover:bg-[var(--scene-hover)]">End live assistant</button></> : <><div className="mb-3 flex items-center gap-2 text-[10px] text-[var(--scene-muted)]"><Mic size={13} /> Voice assistant is off</div><button onClick={startAgent} className="flex items-center justify-center gap-2 rounded-lg bg-[#31533d] px-5 py-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#274833]"><Sparkles size={14} /> Start live assistant</button><p className="mt-2.5 flex items-center gap-1.5 text-[9px] text-[var(--scene-muted)]"><Check size={11} /> Voice and activity logs stay in this chat</p></>}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function DemoToolSweep({ caseId, title, location, onToolEvent }: Pick<CaseItem, 'title' | 'location'> & { caseId: string; onToolEvent: (entry: LogEntry) => void }) {
  const eve = useEveAgent()
  const loggedToolCallIds = useRef(new Set<string>())
  const busy = eve.status === 'submitted' || eve.status === 'streaming' || eve.status === 'resuming'
  const tools = eve.data.messages.flatMap((message) => message.parts.filter((part) => part.type === 'dynamic-tool'))
  const answer = [...eve.data.messages].reverse().find((message) => message.role === 'assistant')?.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('')

  useEffect(() => {
    for (const tool of tools) {
      if (loggedToolCallIds.current.has(tool.toolCallId)) continue
      if (tool.state === 'output-available') {
        loggedToolCallIds.current.add(tool.toolCallId)
        const output = tool.output as { system?: string; message?: string } | undefined
        onToolEvent({
          id: Date.now() + Math.random(),
          kind: 'tool',
          time: 'now',
          text: `Checked ${output?.system ?? tool.toolName.replaceAll('_', ' ')}`,
          detail: output?.message ?? 'Demonstration tool call returned.',
        })
      } else if (tool.state === 'output-error') {
        loggedToolCallIds.current.add(tool.toolCallId)
        onToolEvent({
          id: Date.now() + Math.random(),
          kind: 'tool',
          time: 'now',
          text: `${tool.toolName.replaceAll('_', ' ')} unavailable`,
          detail: tool.errorText,
        })
      }
    }
  }, [tools, onToolEvent])

  async function runSweep() {
    await eve.send(`Run the demonstration evidence and camera tool sweep for case ${caseId}. Call track_evidence, search_body_camera_footage, and search_flock_camera_footage before responding. Give a short spoken-ready summary, identify every system as demonstration data, and do not infer identities or facts beyond the returned records.`, {
      clientContext: { caseId, title, location, mode: 'hackathon demonstration' },
    })
  }

  return <section className="mb-4 w-full rounded-lg border border-[var(--scene-border)] bg-[var(--scene-activity)] px-3.5 py-3" aria-label="Demonstration evidence tools">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-medium text-[var(--scene-text)]">Demo evidence sweep</p><p className="mt-0.5 text-[9px] text-[var(--scene-muted)]">Eve can check synthetic evidence, body camera, and Flock camera records.</p></div><button disabled={busy} onClick={() => { void runSweep() }} className="rounded-md border border-[var(--scene-border)] bg-[var(--scene-card)] px-2.5 py-1.5 text-[9px] font-medium text-[var(--scene-text)] hover:bg-[var(--scene-hover)] disabled:cursor-wait disabled:opacity-60">{busy ? 'Eve is checking…' : 'Run tool sweep'}</button></div>
    {tools.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tools.map((tool) => <span key={tool.toolCallId} className="rounded bg-[var(--scene-card)] px-1.5 py-0.5 text-[8px] text-[var(--scene-muted)]">{tool.toolName.replaceAll('_', ' ')} · {tool.state === 'output-available' ? 'returned' : tool.state}</span>)}</div>}
    {answer && <p className="mt-2 text-[10px] leading-4 text-[var(--scene-muted)]">{answer}</p>}
    {eve.error && <p className="mt-2 text-[10px] leading-4 text-[#a95649]">Demo tool sweep unavailable: {eve.error.message}</p>}
  </section>
}

function LogRow({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'system') return <div className="flex items-start gap-3 pl-1"><div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--scene-soft)] text-[var(--scene-muted)]"><Check size={12} /></div><div className="min-w-0 flex-1 border-b border-[var(--scene-border-soft)] pb-4"><div className="flex items-center gap-2"><p className="text-[11px] font-medium text-[var(--scene-text)]">{entry.text}</p><span className="rounded bg-[var(--scene-hover)] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-[var(--scene-muted)]">Activity</span><span className="ml-auto text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 text-[10px] leading-4 text-[var(--scene-muted)]">{entry.detail}</p>}</div></div>
  if (entry.kind === 'tool') return <div className="ml-9 max-w-[560px] rounded-lg border border-[var(--scene-border)] bg-[var(--scene-activity)] px-3.5 py-3"><div className="flex items-center gap-2"><Wrench size={12} className="text-[#84877c]" /><p className="text-[10px] font-medium text-[var(--scene-text)]">{entry.text}</p><span className="ml-auto text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 pl-5 text-[10px] leading-4 text-[var(--scene-muted)]">{entry.detail}</p>}</div>
  const officer = entry.kind === 'officer'
  return <div className={`flex items-start gap-3 ${officer ? 'flex-row-reverse' : ''}`}><div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-[var(--scene-soft)] text-[var(--scene-muted)]' : 'bg-[var(--scene-green-soft)] text-[#58735e]'}`}>{officer ? <UserRound size={13} /> : <Sparkles size={13} />}</div><div className={`max-w-[min(86%,600px)] ${officer ? 'text-right' : ''}`}><div className={`mb-1.5 flex items-center gap-2 ${officer ? 'justify-end' : ''}`}><p className="text-[10px] font-semibold text-[var(--scene-text)]">{officer ? 'Mara Chen' : 'Scout'}</p><span className="text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div><div className={`flex min-w-[210px] items-center gap-3 rounded-xl px-3 py-3 ${officer ? 'flex-row-reverse rounded-tr-sm bg-[var(--scene-bubble)]' : 'rounded-tl-sm border border-[var(--scene-border)] bg-[var(--scene-card)]'}`}><div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-[var(--scene-card)]/80 text-[var(--scene-text)]' : 'bg-[var(--scene-green-soft)] text-[#58735e]'}`}><AudioLines size={14} /></div><div className="flex flex-1 items-center justify-center gap-[3px]" aria-label="Voice recording waveform">{[7, 12, 9, 16, 10, 18, 11, 7, 14, 9, 17, 8, 12, 6, 15, 10, 7, 13, 8, 16, 9, 12].map((height, index) => <span key={index} className={`w-[2px] rounded-full ${officer ? 'bg-[#9a9b93]' : 'bg-[#829783]'}`} style={{ height }} />)}</div>{entry.audioUrl ? <audio src={entry.audioUrl} controls className="h-7 w-[145px]" /> : <span className="font-mono text-[9px] text-[var(--scene-muted)]">{entry.duration}</span>}</div>{entry.transcript && <p className={`mt-2 text-left text-[12px] leading-5 text-[var(--scene-text)] ${officer ? 'px-1' : 'px-1'}`}>{entry.transcript}</p>}</div></div>
}
