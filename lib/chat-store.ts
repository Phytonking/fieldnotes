export type StoredCase = {
  id: string
  title: string
  location: string
  status: 'LIVE' | 'STANDBY' | 'CLOSED'
  time: string
  unread?: boolean
}

export type StoredLogEntry = {
  id: number
  kind: 'officer' | 'assistant' | 'tool' | 'system'
  time: string
  text?: string
  transcript?: string
  detail?: string
  duration?: string
  audioBlob?: Blob
  audioUrl?: string
}

export type ChatSnapshot = { cases: StoredCase[]; logs: Record<string, StoredLogEntry[]>; selectedId?: string }

const DATABASE = 'fieldnote-chat'
const VERSION = 1
const STORE = 'workspace'
const SNAPSHOT_KEY = 'snapshot'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, VERSION)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open local chat database'))
  })
}

export async function loadChatSnapshot(): Promise<ChatSnapshot | null> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(SNAPSHOT_KEY)
    request.onsuccess = () => {
      database.close()
      resolve((request.result as ChatSnapshot | undefined) ?? null)
    }
    request.onerror = () => {
      database.close()
      reject(request.error ?? new Error('Could not read local chat database'))
    }
  })
}

export async function saveChatSnapshot(snapshot: ChatSnapshot): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readwrite')
    const logs = Object.fromEntries(Object.entries(snapshot.logs).map(([caseId, entries]) => [
      caseId,
      entries.map(({ audioUrl: _temporaryUrl, ...entry }) => entry),
    ]))
    transaction.objectStore(STORE).put({ cases: snapshot.cases, logs, selectedId: snapshot.selectedId } satisfies ChatSnapshot, SNAPSHOT_KEY)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error ?? new Error('Could not save local chat database')) }
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error('Local chat database write was aborted')) }
  })
}
