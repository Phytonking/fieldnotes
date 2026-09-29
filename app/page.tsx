'use client'

import { useRef, useState } from 'react'
import { Archive, AudioLines, Check, ChevronDown, Circle, Menu, MessageSquare, Mic, MoreHorizontal, Plus, Search, Shield, Sparkles, UserRound, Wrench, X } from 'lucide-react'

type LogEntry = { id: number; kind: 'officer' | 'assistant' | 'tool' | 'system'; time: string; text?: string; transcript?: string; detail?: string; duration?: string; audioUrl?: string }
type SpeechResult = { 0: { transcript: string } }
type SpeechRecognizer = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: { results: ArrayLike<SpeechResult> }) => void) | null; start: () => void; stop: () => void }
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
  const [selectedId, setSelectedId] = useState('CP-1048')
  const [cases, setCases] = useState(initialCases)
  const [logs, setLogs] = useState<Record<string, LogEntry[]>>({ 'CP-1048': firstLog })
  const [agentOn, setAgentOn] = useState(false)
  const [mobileRail, setMobileRail] = useState(false)
  const [recording, setRecording] = useState(false)
  const [search, setSearch] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingStartedAt = useRef(0)
  const recordingChatId = useRef('')
  const transcriptRef = useRef('')
  const speechRef = useRef<SpeechRecognizer | null>(null)
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0]
  const currentLogs = logs[selectedId] ?? []

  function selectCase(item: CaseItem) {
    speechRef.current?.stop()
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setSelectedId(item.id)
    setMobileRail(false)
    setAgentOn(false)
    setRecording(false)
  }

  function newChat() {
    const id = `CP-${String(1100 + cases.length)}`
    const fresh = { id, title: 'New field note', location: 'Unassigned', status: 'STANDBY' as const, time: 'now' }
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
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      streamRef.current = stream
      recorderRef.current = recorder
      recordingChatId.current = selectedId
      recordingStartedAt.current = Date.now()
      transcriptRef.current = ''
      const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechRecognizer; webkitSpeechRecognition?: new () => SpeechRecognizer }
      const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
      if (SpeechRecognition) {
        const speech = new SpeechRecognition()
        speech.continuous = true
        speech.interimResults = true
        speech.lang = 'en-US'
        speech.onresult = (event) => { transcriptRef.current = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join(' ').trim() }
        speechRef.current = speech
        speech.start()
      }
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      recorder.onstop = () => {
        speechRef.current?.stop()
        speechRef.current = null
        const audioUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt.current) / 1000))
        const duration = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
        setLogs((all) => ({ ...all, [recordingChatId.current]: [...(all[recordingChatId.current] ?? []), { id: Date.now(), kind: 'officer', time: 'now', duration, audioUrl, transcript: transcriptRef.current }] }))
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
      }
      recorder.start()
      setAgentOn(true)
      setRecording(true)
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live assistant started', detail: 'Microphone active · case context loaded' }] }))
    } catch {
      setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Microphone unavailable', detail: 'Allow microphone access to start the live voice session.' }] }))
    }
  }

  function endAgent() {
    speechRef.current?.stop()
    setAgentOn(false)
    setRecording(false)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    setLogs((all) => ({ ...all, [selectedId]: [...(all[selectedId] ?? []), { id: Date.now(), kind: 'system', time: 'now', text: 'Live assistant ended', detail: 'Activity saved to this chat.' }] }))
  }

  const visibleCases = cases.filter((item) => `${item.title} ${item.location} ${item.id}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <main className="flex h-[100dvh] min-h-[560px] overflow-hidden bg-[#f7f7f5] text-[#20211f]">
      {mobileRail && <button onClick={() => setMobileRail(false)} className="fixed inset-0 z-30 bg-black/20 md:hidden" aria-label="Close chat rail" />}
      <aside className={`${mobileRail ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-[286px] shrink-0 flex-col border-r border-[#e7e7e3] bg-[#fbfbfa] transition-transform md:relative md:translate-x-0`}>
        <div className="flex h-[68px] items-center justify-between border-b border-[#ecece8] px-5">
          <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-[10px] bg-[#20211f] text-white"><Shield size={15} strokeWidth={1.8} /></div><div><p className="text-[13px] font-semibold tracking-[-0.02em]">Fieldnote</p><p className="mt-0.5 text-[10px] text-[#969791]">Officer workspace</p></div></div>
          <button onClick={() => setMobileRail(false)} className="rounded-md p-1.5 text-[#8c8d87] hover:bg-[#f0f0ed] md:hidden" aria-label="Close sidebar"><X size={17} /></button>
          <button className="hidden rounded-md p-1.5 text-[#8c8d87] hover:bg-[#f0f0ed] md:block" aria-label="Workspace options"><MoreHorizontal size={17} /></button>
        </div>
        <div className="px-3 pt-5">
          <div className="mb-2 flex items-center justify-between px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a29b]">Your chats <span className="ml-1 font-normal">{cases.length}</span></p><button onClick={newChat} className="rounded-md p-1.5 text-[#8f9089] hover:bg-[#f0f0ed] hover:text-[#262723]" aria-label="New chat"><Plus size={15} /></button></div>
          <label className="mb-3 flex items-center gap-2 rounded-lg border border-[#ecece8] bg-white px-2.5 py-2"><Search size={13} className="shrink-0 text-[#a6a69f]" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#b2b3ad]" placeholder="Search chats" /></label>
          <div className="space-y-1">{visibleCases.map((item) => <button key={item.id} onClick={() => selectCase(item)} className={`group w-full rounded-lg px-2.5 py-2.5 text-left transition ${item.id === selectedId ? 'bg-[#efefec]' : 'hover:bg-[#f4f4f1]'}`}><div className="flex items-start gap-2.5"><div className={`mt-[3px] flex size-7 shrink-0 items-center justify-center rounded-[8px] ${item.id === selectedId ? 'bg-white text-[#42433d]' : 'bg-[#f0f0ed] text-[#85867e]'}`}><MessageSquare size={13} strokeWidth={1.8} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-[12px] font-medium text-[#32332f]">{item.title}</p><span className="shrink-0 text-[9px] text-[#a4a59e]">{item.time}</span></div><div className="mt-1 flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${item.status === 'LIVE' ? 'bg-[#6ca17c]' : item.status === 'CLOSED' ? 'bg-[#c7c7c1]' : 'bg-[#d4aa61]'}`} /><p className="truncate text-[10px] text-[#969791]">{item.id} · {item.location}</p>{item.unread && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-[#587963]" />}</div></div></div></button>)}</div>
        </div>
        <div className="mt-auto border-t border-[#ecece8] p-3"><button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[11px] text-[#777871] hover:bg-[#f1f1ee]"><Archive size={14} /><span>Archived chats</span><ChevronDown className="ml-auto rotate-[-90deg]" size={13} /></button><div className="mt-2 flex items-center gap-2.5 rounded-lg px-2.5 py-2"><div className="flex size-7 items-center justify-center rounded-full bg-[#e9e9e5] text-[#6f706a]"><UserRound size={14} /></div><div className="min-w-0"><p className="text-[11px] font-medium">Mara Chen</p><p className="text-[10px] text-[#a0a19a]">Field officer</p></div><MoreHorizontal className="ml-auto text-[#a3a39d]" size={15} /></div></div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-[#e9e9e5] bg-[#fbfbfa] px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3"><button onClick={() => setMobileRail(true)} className="rounded-md p-1.5 text-[#777871] hover:bg-[#f0f0ed] md:hidden" aria-label="Open chats"><Menu size={17} /></button><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-[14px] font-semibold tracking-[-0.02em]">{selected.title}</h1><ChevronDown size={13} className="shrink-0 text-[#aaa9a2]" /></div><p className="mt-0.5 truncate text-[10px] text-[#999a93]">{selected.id} <span className="mx-1 text-[#d0d0ca]">·</span> {selected.location}</p></div></div>
          <div className="flex items-center gap-2"><div className="hidden items-center gap-1.5 rounded-full border border-[#e8e9e4] bg-white px-2.5 py-1.5 text-[10px] text-[#81827b] sm:flex"><Circle size={7} className="fill-[#79a084] text-[#79a084]" /> Secure workspace</div><button className="rounded-md p-2 text-[#91928b] hover:bg-[#f0f0ed]" aria-label="More conversation options"><MoreHorizontal size={17} /></button></div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-8 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto max-w-[760px]">
              <div className="mb-8 flex items-center gap-3"><div className="h-px flex-1 bg-[#e9e9e5]" /><span className="text-[9px] font-medium uppercase tracking-[0.13em] text-[#a5a69f]">Today · 10:41 AM</span><div className="h-px flex-1 bg-[#e9e9e5]" /></div>
              <div className="space-y-6">{currentLogs.map((entry) => <LogRow key={entry.id} entry={entry} />)}</div>
              {currentLogs.length === 0 && <div className="rounded-xl border border-dashed border-[#ddded8] p-8 text-center"><MessageSquare className="mx-auto mb-3 text-[#aaaba4]" size={19} /><p className="text-[13px] font-medium">Start a voice chat</p><p className="mt-1 text-[11px] text-[#92938c]">Voice turns and case activity will stay together here.</p></div>}
              {recording && <div className="mt-6 flex items-center gap-2 pl-10 text-[10px] text-[#58735e]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> Listening to your voice</div>}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#e9e9e5] bg-[#fbfbfa] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 sm:px-8 md:px-12 lg:px-16">
            <div className="mx-auto flex max-w-[760px] flex-col items-center">
              {agentOn ? <><div className="mb-3 flex items-center gap-2 text-[10px] text-[#81837b]"><span className="size-1.5 animate-pulse rounded-full bg-[#6e9877]" /> Listening live</div><div className="mb-3 flex h-12 items-center gap-1" aria-label="Live microphone activity">{[10, 19, 13, 28, 17, 36, 20, 13, 25, 15, 32, 18, 11, 27, 16, 34, 19, 12, 24, 15].map((height, index) => <span key={index} className="w-1 animate-pulse rounded-full bg-[#829783]" style={{ height, animationDelay: `${index * 45}ms` }} />)}</div><button onClick={endAgent} className="rounded-lg border border-[#e4e5df] bg-white px-4 py-2 text-[10px] font-medium text-[#73746e] hover:bg-[#f3f3f0]">End live assistant</button></> : <><div className="mb-3 flex items-center gap-2 text-[10px] text-[#9a9b94]"><Mic size={13} /> Voice assistant is off</div><button onClick={startAgent} className="flex items-center justify-center gap-2 rounded-lg bg-[#31533d] px-5 py-3 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#274833]"><Sparkles size={14} /> Start live assistant</button><p className="mt-2.5 flex items-center gap-1.5 text-[9px] text-[#a1a29b]"><Check size={11} /> Voice and activity logs stay in this chat</p></>}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function LogRow({ entry }: { entry: LogEntry }) {
  if (entry.kind === 'system') return <div className="flex items-start gap-3 pl-1"><div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#efefeb] text-[#85867f]"><Check size={12} /></div><div className="min-w-0 flex-1 border-b border-[#eeefea] pb-4"><div className="flex items-center gap-2"><p className="text-[11px] font-medium text-[#555650]">{entry.text}</p><span className="rounded bg-[#f0f0ed] px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-[#90918a]">Activity</span><span className="ml-auto text-[9px] text-[#aaaba5]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 text-[10px] leading-4 text-[#8d8e87]">{entry.detail}</p>}</div></div>
  if (entry.kind === 'tool') return <div className="ml-9 max-w-[560px] rounded-lg border border-[#e7e8e2] bg-[#f2f3ef] px-3.5 py-3"><div className="flex items-center gap-2"><Wrench size={12} className="text-[#84877c]" /><p className="text-[10px] font-medium text-[#5b5d55]">{entry.text}</p><span className="ml-auto text-[9px] text-[#a6a79f]">{entry.time}</span></div>{entry.detail && <p className="mt-1.5 pl-5 text-[10px] leading-4 text-[#8e9088]">{entry.detail}</p>}</div>
  const officer = entry.kind === 'officer'
  return <div className={`flex items-start gap-3 ${officer ? 'flex-row-reverse' : ''}`}><div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-[#e7e7e2] text-[#777870]' : 'bg-[#e9efe9] text-[#58735e]'}`}>{officer ? <UserRound size={13} /> : <Sparkles size={13} />}</div><div className={`max-w-[min(86%,600px)] ${officer ? 'text-right' : ''}`}><div className={`mb-1.5 flex items-center gap-2 ${officer ? 'justify-end' : ''}`}><p className="text-[10px] font-semibold text-[#6a6b64]">{officer ? 'Mara Chen' : 'eve'}</p><span className="text-[9px] text-[#aaaba5]">{entry.time}</span></div><div className={`flex min-w-[210px] items-center gap-3 rounded-xl px-3 py-3 ${officer ? 'flex-row-reverse rounded-tr-sm bg-[#eeefeb]' : 'rounded-tl-sm border border-[#e9eae5] bg-white'}`}><div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${officer ? 'bg-white/80 text-[#6e7068]' : 'bg-[#e9efe9] text-[#58735e]'}`}><AudioLines size={14} /></div><div className="flex flex-1 items-center justify-center gap-[3px]" aria-label="Voice recording waveform">{[7, 12, 9, 16, 10, 18, 11, 7, 14, 9, 17, 8, 12, 6, 15, 10, 7, 13, 8, 16, 9, 12].map((height, index) => <span key={index} className={`w-[2px] rounded-full ${officer ? 'bg-[#9a9b93]' : 'bg-[#829783]'}`} style={{ height }} />)}</div>{entry.audioUrl ? <audio src={entry.audioUrl} controls className="h-7 w-[145px]" /> : <span className="font-mono text-[9px] text-[#92938c]">{entry.duration}</span>}</div>{entry.transcript && <p className={`mt-2 text-left text-[12px] leading-5 text-[#696a63] ${officer ? 'px-1' : 'px-1'}`}>{entry.transcript}</p>}</div></div>
}
