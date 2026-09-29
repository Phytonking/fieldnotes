'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, AudioLines, Check, ChevronDown, Circle, Menu, MessageSquare, Mic, Moon, MoreHorizontal, Plus, Search, Shield, Sparkles, Sun, UserRound, Wrench, X } from 'lucide-react'
import { useEveAgent } from 'eve/react'
import { loadChatSnapshot, saveChatSnapshot, type StoredLogEntry } from '@/lib/chat-store'

type LogEntry = StoredLogEntry
type SpeechResult = { 0: { transcript: string }; isFinal: boolean }
type SpeechRecognizer = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<SpeechResult>; resultIndex?: number }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void }
type CaseItem = { id: string; title: string; location: string; status: 'LIVE' | 'STANDBY' | 'CLOSED'; time: string; unread?: boolean }

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
  const [recording, setRecording] = useState(false)
  const [search, setSearch] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [databaseStatus, setDatabaseStatus] = useState<'checking' | 'local' | 'connected' | 'error'>('checking')
  const streamRef = useRef<MediaStream | null>(null)
  const recordingChatId = useRef('')
  const speechRef = useRef<SpeechRecognizer | null>(null)
  const lastFinalResultRef = useRef(0)
  const turnQueueRef = useRef<Promise<void>>(Promise.resolve())
  const sessionActiveRef = useRef(false)
  const assistantSpeakingRef = useRef(false)
  const pendingAssistantRef = useRef<{ chatId: string; id: number; transcript: string } | null>(null)
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0]
  const currentLogs = logs[selectedId] ?? []
  const scoutAgent = useEveAgent({
    onEvent(event) {
      if (event.type !== 'message.appended') return
      const pending = pendingAssistantRef.current
      if (!pending) return
      pending.transcript += event.data.messageDelta
      const transcript = pending.transcript
      setLogs((all) => ({ ...all, [pending.chatId]: (all[pending.chatId] ?? []).map((entry) => entry.id === pending.id ? { ...entry, transcript, duration: 'live' } : entry) }))
    },
    onFinish(snapshot) {
      const pending = pendingAssistantRef.current
      if (!pending) return
      const assistantMessage = [...snapshot.data.messages].reverse().find((message) => message.role === 'assistant')
      const transcript = assistantMessage?.parts.filter((part) => part.type === 'text').map((part) => part.text).join(' ').trim() || pending.transcript
      setLogs((all) => ({ ...all, [pending.chatId]: (all[pending.chatId] ?? []).map((entry) => entry.id === pending.id ? { ...entry, transcript, duration: 'done' } : entry) }))
      pendingAssistantRef.current = null
      if (transcript && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        assistantSpeakingRef.current = true
        speechRef.current?.stop()
        const spokenReply = new SpeechSynthesisUtterance(transcript)
        const resumeRecognition = () => {
          assistantSpeakingRef.current = false
          if (sessionActiveRef.current && speechRef.current) {
            try { speechRef.current.start() } catch { /* Recognition restarts from its onend callback if needed. */ }
          }
        }
        spokenReply.onend = resumeRecognition
        spokenReply.onerror = resumeRecognition
        window.speechSynthesis.speak(spokenReply)
      }
    },
    onError(error) {
      const pending = pendingAssistantRef.current
      if (!pending) return
      setLogs((all) => ({ ...all, [pending.chatId]: (all[pending.chatId] ?? []).map((entry) => entry.id === pending.id ? { ...entry, transcript: error.message || 'Scout could not respond.', duration: 'error' } : entry) }))
      pendingAssistantRef.current = null
    },
  })

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

  function selectCase(item: CaseItem) {
    if (scoutAgent.status === 'streaming' || scoutAgent.status === 'submitted') void scoutAgent.cancel().catch(() => {})
    scoutAgent.reset()
    speechRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    sessionActiveRef.current = false
    assistantSpeakingRef.current = false
    window.speechSynthesis?.cancel()
    setSelectedId(item.id)
    setMobileRail(false)
    setAgentOn(false)
    setRecording(false)
  }

  function newChat() {
    if (scoutAgent.status === 'streaming' || scoutAgent.status === 'submitted') void scoutAgent.cancel().catch(() => {})
    scoutAgent.reset()
    sessionActiveRef.current = false
    speechRef.current?.stop()
    speechRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    window.speechSynthesis?.cancel()
    const id = `CP-${String(1100 + cases.length)}`
    const fresh = { id, title: 'New scene chat', location: 'Unassigned', status: 'STANDBY' as const, time: 'now' }
    setCases((all) => [fresh, ...all])
    setLogs((all) => ({ ...all, [id]: [{ id: Date.now(), kind: 'system', time: 'now', text: 'New voice chat created', detail: 'Voice turns and case activity will stay together here.' }] }))
    setSelectedId(id)
    setAgentOn(false)
    setRecording(false)
    setMobileRail(false)
  }

  async function startAgent() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      recordingChatId.current = selectedId
      lastFinalResultRef.current = 0
      const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }
      const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
      if (!SpeechRecognition) {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live transcription unavailable', detail: 'Use a browser that supports speech recognition to talk with Scout.' }] }))
        return
      }
      const speech = new SpeechRecognition()
      speech.continuous = true
      speech.interimResults = true
      speech.lang = 'en-US'
      speech.onresult = (event) => {
        const results = Array.from(event.results)
        const startIndex = Math.max(event.resultIndex ?? 0, lastFinalResultRef.current)
        const finalized: string[] = []
        for (let index = startIndex; index < results.length; index += 1) {
          if (results[index].isFinal) {
            const phrase = results[index][0]?.transcript?.trim()
            if (phrase) finalized.push(phrase)
            lastFinalResultRef.current = index + 1
          }
        }
        if (finalized.length) {
          const transcript = finalized.join(' ')
          turnQueueRef.current = turnQueueRef.current.then(() => sendOfficerTurn(transcript))
        }
      }
      speech.onerror = () => {
        setLogs((all) => ({ ...all, [recordingChatId.current]: [...(all[recordingChatId.current] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Speech recognition interrupted', detail: 'Check microphone access and restart the live assistant.' }] }))
      }
      speech.onend = () => {
        if (sessionActiveRef.current && !assistantSpeakingRef.current) {
          try { speech.start() } catch { /* The browser may still be closing the recognition session. */ }
        }
      }
      speechRef.current = speech
      speech.start()
      sessionActiveRef.current = true
      setAgentOn(true)
      setRecording(true)
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live assistant started', detail: 'Microphone active · case context loaded' }] }))
    } catch {
      sessionActiveRef.current = false
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Microphone unavailable', detail: 'Allow microphone access to start the live voice session.' }] }))
    }
  }

  async function sendOfficerTurn(transcript: string) {
    const chatId = recordingChatId.current
    const caseItem = cases.find((item) => item.id === chatId)
    const assistantId = Date.now() + Math.random()
    pendingAssistantRef.current = { chatId, id: assistantId, transcript: '' }
    setLogs((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), { id: assistantId - 0.25, memoryId: crypto.randomUUID(), kind: 'officer', time: 'now', transcript, duration: 'done' }] }))
    setLogs((all) => ({ ...all, [chatId]: [...(all[chatId] ?? []), { id: assistantId, memoryId: `${assistantId}:assistant`, kind: 'assistant', time: 'now', transcript: '', duration: '…' }] }))

    try {
      await scoutAgent.send(transcript, {
        clientContext: { caseId: chatId, caseTitle: caseItem?.title ?? 'Unknown case', location: caseItem?.location ?? 'Unknown' },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Scout could not respond. Check the Scout connection.'
      setLogs((all) => ({ ...all, [chatId]: (all[chatId] ?? []).map((entry) => entry.id === assistantId || entry.id === assistantId - 0.25 ? { ...entry, duration: 'error', ...(entry.id === assistantId ? { transcript: message } : {}) } : entry) }))
      pendingAssistantRef.current = null
    }
  }

  function endAgent() {
    if (scoutAgent.status === 'streaming' || scoutAgent.status === 'submitted') void scoutAgent.cancel().catch(() => {})
    sessionActiveRef.current = false
    assistantSpeakingRef.current = false
    speechRef.current?.stop()
    speechRef.current = null
    setAgentOn(false)
    setRecording(false)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    window.speechSynthesis?.cancel()
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
              {recording && <div className="mt-6 flex items-center gap-2 pl-10 text-[10px] text-[#58735e]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> Listening to your voice</div>}
            </div>
          </div>

          <div className="shrink-0 border-t border-[var(--scene-border)] bg-[var(--scene-panel)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto flex max-w-[760px] flex-col items-center">
              {agentOn ? <><div className="mb-3 flex items-center gap-2 text-[10px] text-[var(--scene-muted)]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> Listening live</div><div className="mb-3 flex h-12 items-center gap-1" aria-label="Live microphone activity">{[10, 19, 13, 28, 17, 36, 20, 13, 25, 15, 32, 18, 11, 27, 16, 34, 19, 12, 24, 15].map((height, index) => <span key={index} className="w-1 animate-pulse rounded-full bg-[#829783]" style={{ height, animationDelay: `${index * 45}ms` }} />)}</div><button onClick={endAgent} className="rounded-lg border border-[var(--scene-border)] bg-[var(--scene-card)] px-4 py-2 text-[10px] font-medium text-[var(--scene-text)] hover:bg-[var(--scene-hover)]">End live assistant</button></> : <><div className="mb-3 flex items-center gap-2 text-[10px] text-[var(--scene-muted)]"><Mic size={13} /> Voice assistant is off</div><button onClick={startAgent} className="flex items-center justify-center gap-2 rounded-lg bg-[#31533d] px-5 py-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#274833]"><Sparkles size={14} /> Start live assistant</button><p className="mt-2.5 flex items-center gap-1.5 text-[9px] text-[var(--scene-muted)]"><Check size={11} /> Voice and activity logs stay in this chat</p></>}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'system') return <div className="flex items-start gap-3 pl-1"><div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--scene-soft)] text-[var(--scene-muted)]"><Check size={12} /></div><div className="min-w-0 flex-1 border-b border-[var(--scene-border-soft)] pb-4"><div className="flex items-center gap-2"><p className="text-[11px] font-medium text-[var(--scene-text)]">{entry.text}</p><span className="rounded bg-[var(--scene-hover)] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-[var(--scene-muted)]">Activity</span><span className="ml-auto text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 text-[10px] leading-4 text-[var(--scene-muted)]">{entry.detail}</p>}</div></div>
  if (entry.kind === 'tool') return <div className="ml-9 max-w-[560px] rounded-lg border border-[var(--scene-border)] bg-[var(--scene-activity)] px-3.5 py-3"><div className="flex items-center gap-2"><Wrench size={12} className="text-[#84877c]" /><p className="text-[10px] font-medium text-[var(--scene-text)]">{entry.text}</p><span className="ml-auto text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 pl-5 text-[10px] leading-4 text-[var(--scene-muted)]">{entry.detail}</p>}</div>
  const officer = entry.kind === 'officer'
  return <div className={`flex items-start gap-3 ${officer ? 'flex-row-reverse' : ''}`}><div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-[var(--scene-soft)] text-[var(--scene-muted)]' : 'bg-[var(--scene-green-soft)] text-[#58735e]'}`}>{officer ? <UserRound size={13} /> : <Sparkles size={13} />}</div><div className={`max-w-[min(86%,600px)] ${officer ? 'text-right' : ''}`}><div className={`mb-1.5 flex items-center gap-2 ${officer ? 'justify-end' : ''}`}><p className="text-[10px] font-semibold text-[var(--scene-text)]">{officer ? 'Mara Chen' : 'Scout'}</p><span className="text-[9px] text-[var(--scene-muted)]">{entry.time}</span></div><div className={`flex min-w-[210px] items-center gap-3 rounded-xl px-3 py-3 ${officer ? 'flex-row-reverse rounded-tr-sm bg-[var(--scene-bubble)]' : 'rounded-tl-sm border border-[var(--scene-border)] bg-[var(--scene-card)]'}`}><div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-[var(--scene-card)]/80 text-[var(--scene-text)]' : 'bg-[var(--scene-green-soft)] text-[#58735e]'}`}><AudioLines size={14} /></div><div className="flex flex-1 items-center justify-center gap-[3px]" aria-label="Voice recording waveform">{[7, 12, 9, 16, 10, 18, 11, 7, 14, 9, 17, 8, 12, 6, 15, 10, 7, 13, 8, 16, 9, 12].map((height, index) => <span key={index} className={`w-[2px] rounded-full ${officer ? 'bg-[#9a9b93]' : 'bg-[#829783]'}`} style={{ height }} />)}</div>{entry.audioUrl ? <audio src={entry.audioUrl} controls className="h-7 w-[145px]" /> : <span className="font-mono text-[9px] text-[var(--scene-muted)]">{entry.duration}</span>}</div>{entry.transcript && <p className={`mt-2 text-left text-[12px] leading-5 text-[var(--scene-text)] ${officer ? 'px-1' : 'px-1'}`}>{entry.transcript}</p>}</div></div>
}
