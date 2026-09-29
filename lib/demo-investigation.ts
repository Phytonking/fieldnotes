export type DemoEvidenceRecord = {
  id: string
  caseId: string
  item: string
  status: 'logged' | 'submitted' | 'pending review'
  location: string
  collectedAt: string
  note: string
}

export type DemoBodyCameraRecord = {
  id: string
  caseId: string
  officer: string
  startedAt: string
  endedAt: string
  status: 'available' | 'uploading'
  location: string
  note: string
}

export type DemoFlockCameraRecord = {
  id: string
  caseId: string
  camera: string
  capturedAt: string
  location: string
  status: 'available' | 'queued for export'
  observation: string
}

const evidence: DemoEvidenceRecord[] = [
  {
    id: 'EV-1048-01',
    caseId: 'CP-1048',
    item: 'Access card recovered near the north entrance',
    status: 'logged',
    location: 'North Harbor · north entrance',
    collectedAt: '2026-09-29T10:38:00-07:00',
    note: 'Bag 21. Barcode scan is recorded in the demonstration ledger.',
  },
  {
    id: 'EV-1048-02',
    caseId: 'CP-1048',
    item: 'Black knit cap from the loading-dock walkway',
    status: 'pending review',
    location: 'North Harbor · loading dock',
    collectedAt: '2026-09-29T10:40:00-07:00',
    note: 'Bag 22. The demo record has no laboratory result.',
  },
]

const bodyCameraFootage: DemoBodyCameraRecord[] = [
  {
    id: 'BWC-1048-07',
    caseId: 'CP-1048',
    officer: 'Officer Kim',
    startedAt: '2026-09-29T10:31:00-07:00',
    endedAt: '2026-09-29T10:46:00-07:00',
    status: 'available',
    location: 'North Harbor · north entrance',
    note: 'Demo clip index marks an officer arrival and a perimeter update. Review the video before relying on the index.',
  },
  {
    id: 'BWC-1048-12',
    caseId: 'CP-1048',
    officer: 'Officer Patel',
    startedAt: '2026-09-29T10:37:00-07:00',
    endedAt: '2026-09-29T10:51:00-07:00',
    status: 'uploading',
    location: 'North Harbor · loading dock',
    note: 'Demo upload is incomplete; no clip is available to review yet.',
  },
]

const flockCameraFootage: DemoFlockCameraRecord[] = [
  {
    id: 'FLOCK-1048-04',
    caseId: 'CP-1048',
    camera: 'NH-04',
    capturedAt: '2026-09-29T10:27:00-07:00',
    location: 'Harbor Avenue and 8th Street',
    status: 'available',
    observation: 'Demo index: a light-colored sedan traveled southbound. No plate or identity match is asserted.',
  },
  {
    id: 'FLOCK-1048-06',
    caseId: 'CP-1048',
    camera: 'NH-06',
    capturedAt: '2026-09-29T10:34:00-07:00',
    location: 'North Harbor service road',
    status: 'queued for export',
    observation: 'Demo index: motion event queued for export. The footage has not been reviewed.',
  },
]

type DemoSearchInput = { caseId: string; query?: string; id?: string; officer?: string; location?: string }

function matches(record: Record<string, string>, terms: Array<string | undefined>) {
  const haystack = Object.values(record).join(' ').toLowerCase()
  return terms.filter(Boolean).every((term) => haystack.includes(term!.toLowerCase()))
}

function result<T>(system: string, records: T[]) {
  return {
    demo: true,
    system,
    checkedAt: new Date().toISOString(),
    records,
    message: records.length
      ? `${records.length} demonstration record${records.length === 1 ? '' : 's'} returned.`
      : 'No demonstration records matched. This does not establish that no real-world record exists.',
  }
}

export function trackDemoEvidence({ caseId, query, id }: DemoSearchInput) {
  return result('On Scene demonstration evidence ledger', evidence.filter((record) => record.caseId === caseId && matches(record, [query, id])))
}

export function findDemoBodyCameraFootage({ caseId, query, officer, id }: DemoSearchInput) {
  return result('On Scene demonstration body-worn camera index', bodyCameraFootage.filter((record) => record.caseId === caseId && matches(record, [query, officer, id])))
}

export function findDemoFlockCameraFootage({ caseId, query, location, id }: DemoSearchInput) {
  return result('On Scene demonstration Flock camera index', flockCameraFootage.filter((record) => record.caseId === caseId && matches(record, [query, location, id])))
}
