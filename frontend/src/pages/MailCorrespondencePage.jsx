import { useMemo, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { createWorker } from 'tesseract.js'
import { CheckCircle2, Download, FileSpreadsheet, Inbox, Mail, Paperclip, Pencil, Plus, Search, Send, Trash2, Upload, X } from 'lucide-react'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const columns = [
  ['mailReferenceNumber', 'Mail reference number'], ['dated', 'Dated'], ['subject', 'Subject'], ['bucketFileNumber', 'Bucket / File number'], ['priority', 'Priority'], ['assignedTo', 'Assigned to'], ['createdBy', 'Created by'], ['createdDate', 'Created date'], ['dueDate', 'Due date'], ['label', 'Label'], ['status', 'Status'], ['mailSummary', 'Mail summary'],
]

const bucketFileNumbers = [
  'General Correspondence {TASL/ALS/IAF/GC-001/}', 'PDI & JRI {TASL/ALS/IAF/JRI-002/}', 'Budgetary Quotations {TASL/ALS/IAF/BQ-003/}', 'MoM {TASL/ALS/IAF/MoM-004/}', 'Manuals & Publications {TASL/ALS/IAF/MP-005/}', 'Contract {TASL/ALS/IAF/CT-006/}', 'Software Upgrades {TASL/ALS/IAF/SW-101/}', 'Operator Bulletin {TASL/ALS/IAF/OB-102/}', 'Aircraft Maintenance {TASL/ALS/IAF/MAT-201/}', 'Quality Claims {TASL/ALS/IAF/QC-202/}', 'Service Bulletin {TASL/ALS/IAF/SB-203/}', 'Spares {TASL/ALS/IAF/SPR-204/}', 'TMV {TASL/ALS/IAF/TMV-205/}', 'GCS & Radio {TASL/ALS/IAF/GR-206/}', 'Training & Courses {TASL/ALS/IAF/TC-301/}', 'Work Done Report {TASL/ALS/IAF/WDR-401/}', 'Analysis Report {TASL/ALS/IAF/AR-402/}', 'Annual Maintenance Contract {TASL/ALS/IAF/AMC-501/}',
]

const blankMail = (user) => ({ id: '', mailReferenceNumber: '', dated: new Date().toISOString().slice(0, 10), subject: '', bucketFileNumber: '', priority: 'Medium', assignedTo: '', createdBy: user.name, createdDate: new Date().toISOString().slice(0, 10), dueDate: '', label: 'Mail In', status: 'Pending', mailSummary: '', attachments: [] })
const normalise = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const displayDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB') : '--'
const cleanLetterText = (value) => String(value ?? '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
const referenceNumberPattern = /\b[A-Z0-9]{2,}(?:\s*\/\s*[A-Z0-9()._-]{1,}){2,}\s*\/?/i
const airHqReferencePattern = /\bAIR\s*H?Q\s*(?:\/\s*)?S\s*(\d{4,})\s*\/\s*([A-Z0-9]+)\s*\/\s*([A-Z]{2,})\b/i

const normalizeReferenceNumber = (value) => String(value || '').replace(/\s*\/\s*/g, '/').replace(/\s+/g, '').replace(/[.,;:]+$/, '').replace(/\/$/, '')
const extractReferenceNumber = (value) => {
  const text = String(value || '')
  const airHqMatch = text.match(airHqReferencePattern)
  if (airHqMatch) return `AIRHQ/S ${airHqMatch[1]}/${airHqMatch[2].toUpperCase()}/${airHqMatch[3].toUpperCase()}`
  const candidates = [...text.matchAll(new RegExp(referenceNumberPattern.source, 'gi'))].map((match) => match[0])
  const bestCandidate = candidates.sort((first, second) => {
    const score = (candidate) => (candidate.match(/\//g) || []).length * 10 + (candidate.match(/\d/g) || []).length - (/fax|hard|harid/i.test(candidate) ? 100 : 0)
    return score(second) - score(first)
  })[0]
  return normalizeReferenceNumber(bestCandidate)
}
const isReliableReferenceNumber = (value) => Boolean(value) && !/\b(?:fax|hard|harid)\b/i.test(value) && (value.match(/\//g) || []).length >= 2
const normalizeLetterDate = (value) => {
  const parsed = String(value || '').trim().replace(/,/g, ' ')
  const numeric = parsed.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/)
  if (numeric) {
    const [, day, month, rawYear] = numeric
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const named = Date.parse(parsed)
  return Number.isNaN(named) ? '' : new Date(named).toISOString().slice(0, 10)
}
const dateFromFileName = (fileName) => normalizeLetterDate(String(fileName || '').match(/(?:dated?|dtd)\s*[-_. ]*([0-3]?\d\s*[A-Za-z]{3,9}\s*\d{2,4}|[0-3]?\d[-_. ][0-1]?\d[-_. ]\d{2,4})/i)?.[1])
const preprocessForOcr = (canvas) => {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < image.data.length; index += 4) {
    const luminance = image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114
    const value = luminance > 172 ? 255 : 0
    image.data[index] = value
    image.data[index + 1] = value
    image.data[index + 2] = value
  }
  context.putImageData(image, 0, 0)
}

const readAttachment = (file) => new Promise((resolve) => {
  const reader = new FileReader()
  reader.onload = () => resolve({ id: `${Date.now()}-${file.name}`, name: file.name, type: file.type, size: file.size, content: reader.result })
  reader.readAsDataURL(file)
})

const extractScannedPdfText = async (pdfDocument, onProgress) => {
  const worker = await createWorker('eng', 1, {
    logger: ({ status, progress }) => onProgress?.(`OCR: ${status}${progress ? ` (${Math.round(progress * 100)}%)` : ''}`),
  })
  try {
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
    const pages = []
    const headerZones = []
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      onProgress?.(`OCR reading page ${pageNumber} of ${pdfDocument.numPages}...`)
      const page = await pdfDocument.getPage(pageNumber)
      const viewport = page.getViewport({ scale: 4 })
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
      preprocessForOcr(canvas)
      const bodyResult = await worker.recognize(canvas.toDataURL('image/png'))
      const headerTop = Math.floor(canvas.height * 0.24)
      const headerHeight = Math.ceil(canvas.height * 0.16)
      const referenceZone = document.createElement('canvas')
      referenceZone.width = Math.ceil(canvas.width * 0.58)
      referenceZone.height = headerHeight
      referenceZone.getContext('2d').drawImage(canvas, 0, headerTop, referenceZone.width, headerHeight, 0, 0, referenceZone.width, headerHeight)
      const dateZone = document.createElement('canvas')
      dateZone.width = Math.ceil(canvas.width * 0.4)
      dateZone.height = headerHeight
      dateZone.getContext('2d').drawImage(canvas, Math.floor(canvas.width * 0.6), headerTop, dateZone.width, headerHeight, 0, 0, dateZone.width, headerHeight)
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
      const referenceResult = await worker.recognize(referenceZone.toDataURL('image/png'))
      const dateResult = await worker.recognize(dateZone.toDataURL('image/png'))
      headerZones.push(`Reference zone: ${cleanLetterText(referenceResult.data.text)}\nDate zone: ${cleanLetterText(dateResult.data.text)}`)
      const header = document.createElement('canvas')
      header.width = canvas.width
      header.height = Math.ceil(canvas.height * 0.38)
      header.getContext('2d').drawImage(canvas, 0, 0, canvas.width, header.height, 0, 0, header.width, header.height)
      await worker.setParameters({ tessedit_pageseg_mode: '11', preserve_interword_spaces: '1' })
      const headerResult = await worker.recognize(header.toDataURL('image/png'))
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' })
      pages.push(`Reference: ${referenceResult.data.text}\nDated: ${dateResult.data.text}\n${headerResult.data.text}\n${bodyResult.data.text}`)
    }
    return { text: cleanLetterText(pages.join('\n')), headerText: cleanLetterText(headerZones.join('\n')) }
  } finally {
    await worker.terminate()
  }
}

const extractAttachmentText = async (file, onProgress) => {
  const fileName = file.name.toLowerCase()
  if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
    const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const pages = await Promise.all(Array.from({ length: pdfDocument.numPages }, async (_, index) => {
      const content = await (await pdfDocument.getPage(index + 1)).getTextContent()
      return content.items.map((item) => item.str).join(' ')
    }))
    const embeddedText = cleanLetterText(pages.join('\n'))
    const scannedText = await extractScannedPdfText(pdfDocument, onProgress)
    return { text: cleanLetterText([scannedText.text, embeddedText].filter(Boolean).join('\n')), headerText: scannedText.headerText }
  }
  if (file.type.startsWith('text/') || /\.(txt|csv|html?|eml)$/i.test(file.name)) return { text: cleanLetterText(await file.text()), headerText: '' }
  return { text: '', headerText: '' }
}

const deriveMailFields = (text, fileName = '') => {
  const fullText = cleanLetterText(text)
  const lines = fullText.split('\n').map((line) => line.trim()).filter(Boolean)
  const referenceMatch = fullText.match(/(?:reference|ref\.?\s*(?:no\.?|number)?|letter\s*no\.?)\s*[:#-]?\s*([^\n]{3,100})/i)
  const datedMatch = fullText.match(/\bdated\s*[:.-]?\s*([^\n]{4,40})/i)
  const headerDateMatch = fullText.match(/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4})\b/i)
  const dated = dateFromFileName(fileName) || normalizeLetterDate(headerDateMatch?.[1]) || normalizeLetterDate(datedMatch?.[1]?.match(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}/)?.[0])
  const subjectLine = lines.find((line) => /^(?:subject|sub|re)\s*[:.-]/i.test(line)) || ''
  const inlineSubject = text.match(/(?:subject|sub|re)\s*[:.-]\s*(.+?)(?=\s+(?:dear|to whom|regards|sincerely|yours faithfully)\b|$)/i)?.[1]?.trim() || ''
  const subject = subjectLine.replace(/^(?:subject|sub|re)\s*[:.-]\s*/i, '').trim() || inlineSubject || lines.find((line) => line.length > 20 && !/^(?:date|from|to|dear|reference|ref)/i.test(line)) || ''
  const letterBody = (fullText.match(/(?:dear\s+(?:sir|madam)[^,]*,?|to whom it may concern[:,]?)\s*([\s\S]+)/i)?.[1] || fullText)
    .replace(/\s+(?:yours faithfully|sincerely|regards)[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  const sentences = letterBody.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((sentence) => sentence.trim()).filter(Boolean) || []
  const actionSentence = letterBody.match(/(?:you are requested|kindly|please|we request)\b[\s\S]*?(?=[.!?](?:\s|$)|$)/i)?.[0]?.trim()
    || sentences.find((sentence) => /\b(?:requested|request|kindly|please|submit|provide|respond|complete)\b/i.test(sentence))
  const readableSentences = sentences.filter((sentence) => {
    const letters = (sentence.match(/[A-Za-z]/g) || []).length
    const noise = (sentence.match(/[^A-Za-z0-9 ,.'()&/:;-]/g) || []).length
    const words = sentence.split(/\s+/).filter((word) => /^[A-Za-z][A-Za-z'-]*$/.test(word))
    return letters >= 30 && words.length >= 6 && noise <= Math.max(3, letters * 0.04)
  })
  const cleanActionSentence = actionSentence && readableSentences.includes(actionSentence) ? actionSentence : ''
  const summarySentences = [...readableSentences.slice(0, 2), cleanActionSentence].filter((sentence, index, values) => sentence && values.indexOf(sentence) === index)
  const summaryText = summarySentences.join(' ').slice(0, 700)
  const reference = extractReferenceNumber(`${referenceMatch?.[1] || ''}\n${fullText}`)
  const cleanSubject = subject.slice(0, 240)
  const fallbackSummary = cleanSubject ? `Correspondence regarding: ${cleanSubject}. Review the attached letter and complete the required action.` : 'Review the attached letter and complete the required action.'
  return {
    reference,
    dated,
    subject: cleanSubject,
    summary: `${reference ? `Reference: ${reference}\n` : ''}${dated ? `Dated: ${dated}\n` : ''}${summaryText || fallbackSummary}`.trim(),
    needsReferenceReview: !isReliableReferenceNumber(reference),
  }
}

export default function MailCorrespondencePage({ correspondence, setCorrespondence, users, currentUser }) {
  const [search, setSearch] = useState('')
  const [labelFilter, setLabelFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [bucketFilter, setBucketFilter] = useState('All')
  const [editing, setEditing] = useState(null)
  const [importMessage, setImportMessage] = useState('')
  const importInput = useRef(null)
  const bucketOptions = useMemo(() => [...new Set(correspondence.map((record) => record.bucketFileNumber).filter(Boolean))].sort((first, second) => first.localeCompare(second)), [correspondence])
  const filtered = useMemo(() => correspondence.filter((record) => (labelFilter === 'All' || record.label === labelFilter) && (statusFilter === 'All' || record.status === statusFilter) && (bucketFilter === 'All' || record.bucketFileNumber === bucketFilter) && (!search || [record.mailReferenceNumber, record.subject, record.bucketFileNumber, record.assignedTo, record.mailSummary].some((value) => String(value || '').toLowerCase().includes(search.toLowerCase())))), [bucketFilter, correspondence, labelFilter, search, statusFilter])

  const save = (record) => {
    const next = { ...record, id: record.id || `mail-${Date.now()}`, createdBy: record.createdBy || currentUser.name, createdDate: record.createdDate || new Date().toISOString().slice(0, 10) }
    setCorrespondence((current) => record.id ? current.map((item) => item.id === record.id ? next : item) : [next, ...current])
    setEditing(null)
  }

  const importLegacy = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false })
      const imported = rows.map((row, index) => {
        const get = (...aliases) => row[Object.keys(row).find((header) => aliases.includes(normalise(header)))] || ''
        const label = get('label', 'mailtype', 'direction')
        return {
          id: `mail-import-${Date.now()}-${index}`,
          mailReferenceNumber: get('mailreferencenumber', 'referencenumber', 'reference'),
          dated: get('dated', 'maildate', 'date'), subject: get('subject'), bucketFileNumber: get('bucketfilenumber', 'filenumber', 'bucketnumber'),
          priority: get('priority') || 'Medium', assignedTo: get('assignedto', 'assignee'), createdBy: get('createdby') || 'Legacy import',
          createdDate: get('createddate') || new Date().toISOString().slice(0, 10), dueDate: get('duedate'),
          label: /out/i.test(label) ? 'Mail Out' : 'Mail In', status: /complete/i.test(get('status')) ? 'Completed' : 'Pending', mailSummary: get('mailsummary', 'summary', 'description'), attachments: [],
        }
      }).filter((record) => record.mailReferenceNumber || record.subject)
      setCorrespondence((current) => [...imported, ...current])
      setImportMessage(`${imported.length} legacy correspondence record(s) imported from ${file.name}.`)
    } catch {
      setImportMessage('The selected workbook could not be imported. Use the downloaded template or a workbook with matching column headers.')
    }
    event.target.value = ''
  }

  const downloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([Object.fromEntries(columns.map(([, label]) => [label, '']))])
    const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, worksheet, 'Mail Correspondence'); XLSX.writeFile(workbook, 'mail-correspondence-import-template.xlsx')
  }

  if (editing) return <AttachmentAwareMailForm record={editing} users={users} onCancel={() => setEditing(null)} onSave={save} />
  return <section className="mail-page">
    <header className="mail-header"><div><p>Communication register</p><h1>Mail Correspondence</h1><span>Manage incoming and outgoing letters in one accountable register.</span></div><div className="mail-header-actions"><input ref={importInput} type="file" accept=".xlsx,.xls" hidden onChange={importLegacy} /><button className="compact-button secondary" onClick={downloadTemplate}><Download size={15} /> Import template</button><button className="compact-button secondary" onClick={() => importInput.current?.click()}><Upload size={15} /> Import old correspondence</button><button className="compact-button primary" onClick={() => setEditing(blankMail(currentUser))}><Plus size={15} /> Create mail</button></div></header>
    <div className="mail-metrics"><Metric label="Total correspondence" value={correspondence.length} icon={Mail} /><Metric label="Mail In pending" value={correspondence.filter((item) => item.label === 'Mail In' && item.status === 'Pending').length} icon={Inbox} /><Metric label="Mail Out pending" value={correspondence.filter((item) => item.label === 'Mail Out' && item.status === 'Pending').length} icon={Send} /></div>
    <div className="mail-toolbar"><label><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reference, subject, file or assignee..." /></label><select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)} aria-label="Filter by Bucket or File number"><option value="All">All buckets</option>{bucketOptions.map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>)}</select><select value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} aria-label="Filter by Mail label"><option>All</option><option>Mail In</option><option>Mail Out</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by Status"><option>All</option><option>Pending</option><option>Completed</option></select><span>{filtered.length} record{filtered.length === 1 ? '' : 's'}</span></div>
    {importMessage && <div className="mail-message"><CheckCircle2 size={15} /> {importMessage}<button onClick={() => setImportMessage('')} aria-label="Dismiss import message"><X size={14} /></button></div>}
    <div className="mail-table-frame"><table className="mail-table"><thead><tr><th>Reference / dated</th><th>Subject / summary</th><th>Bucket / file</th><th>Priority</th><th>Assigned to</th><th>Due date</th><th>Label</th><th>Status</th><th>Files</th><th /></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td><strong>{record.mailReferenceNumber || '--'}</strong><small>{displayDate(record.dated)}</small></td><td><strong>{record.subject || '--'}</strong><small>{record.mailSummary || '--'}</small></td><td>{record.bucketFileNumber || '--'}</td><td><span className={`mail-priority ${record.priority.toLowerCase()}`}>{record.priority}</span></td><td>{record.assignedTo || '--'}<small>By {record.createdBy || '--'}</small></td><td>{displayDate(record.dueDate)}</td><td><span className={`mail-label ${record.label === 'Mail Out' ? 'out' : 'in'}`}>{record.label}</span></td><td><span className={`mail-status ${record.status.toLowerCase()}`}>{record.status}</span></td><td>{record.attachments?.length || 0}</td><td className="mail-actions"><button className="action-btn" title="Edit correspondence" onClick={() => setEditing(record)}><Pencil size={15} /></button><button className="action-btn delete" title="Delete correspondence" onClick={() => setCorrespondence((current) => current.filter((item) => item.id !== record.id))}><Trash2 size={15} /></button></td></tr>)}{!filtered.length && <tr><td colSpan="10" className="empty-row">No mail correspondence matches the selected filters.</td></tr>}</tbody></table></div>
  </section>
}

function Metric({ label, value, icon: Icon }) { return <article><span><Icon size={17} /></span><div><strong>{value}</strong><small>{label}</small></div></article> }

function AttachmentAwareMailForm({ record, users, onCancel, onSave }) {
  const [form, setForm] = useState(record)
  const [addingCustomBucket, setAddingCustomBucket] = useState(Boolean(form.bucketFileNumber) && !bucketFileNumbers.includes(form.bucketFileNumber))
  const [readMessage, setReadMessage] = useState('')
  const [isReadingAttachment, setIsReadingAttachment] = useState(false)
  const fileInput = useRef(null)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const addAttachments = async (files) => {
    setIsReadingAttachment(true)
    setReadMessage('Reading attachment. Scanned PDFs may take a moment while OCR runs.')
    try {
      const prepared = await Promise.all(Array.from(files).map(async (file) => {
        const [attachment, extraction] = await Promise.all([
          readAttachment(file),
          extractAttachmentText(file, setReadMessage)
            .then(({ text: extractedText, headerText: ocrHeaderText }) => ({ extractedText, ocrHeaderText }))
            .catch((error) => ({ extractedText: '', ocrHeaderText: '', extractionError: error?.message || 'The PDF reader could not open this file.' })),
        ])
        return { ...attachment, ...extraction }
      }))
      setForm((current) => ({ ...current, attachments: [...(current.attachments || []), ...prepared] }))
      const extractionError = prepared.find((attachment) => attachment.extractionError)?.extractionError
      setReadMessage(prepared.some((attachment) => attachment.extractedText) ? 'Attachment ready. Select Read and fill mail fields to prepare the correspondence.' : extractionError ? `The attachment could not be read: ${extractionError}` : 'Attachment saved. OCR could not detect readable text.')
    } finally {
      setIsReadingAttachment(false)
    }
  }
  const fillMailFields = () => {
    const sourceAttachment = form.attachments?.find((attachment) => attachment.extractedText)
    if (!sourceAttachment) {
      setReadMessage('No readable text was found in the attached files. Use a text-based PDF, email, or text file.')
      return
    }
    const fields = deriveMailFields(sourceAttachment.extractedText, sourceAttachment.name)
    setForm((current) => ({
      ...current,
      mailReferenceNumber: isReliableReferenceNumber(fields.reference) ? fields.reference : current.mailReferenceNumber,
      dated: fields.dated || current.dated,
      subject: fields.subject || current.subject,
      extractedLetterContent: sourceAttachment.extractedText,
      mailSummary: fields.summary ? `${fields.summary}\n\n${(current.attachments || []).map((attachment) => `Enclosure : ${attachment.name}`).join('\n')}` : current.mailSummary,
    }))
    setReadMessage(fields.needsReferenceReview
      ? 'OCR could not verify a reliable mail reference, so no reference was inserted. Review and enter the reference from the original letter before saving.'
      : 'Mail Reference Number, Dated, Subject Line, and full-letter summary were filled from the attachment.')
  }
  const selectBucket = (value) => {
    if (value === '__custom__') {
      setAddingCustomBucket(true)
      update('bucketFileNumber', '')
      return
    }
    setAddingCustomBucket(false)
    update('bucketFileNumber', value)
  }
  const selectValue = addingCustomBucket ? '__custom__' : form.bucketFileNumber

  return <form className="mail-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}>
    <header className="mail-header"><div><p>Mail correspondence</p><h1>{form.id ? 'Edit mail' : 'Create mail'}</h1><span>Capture the correspondence, ownership, due date, and source documents.</span></div><div className="mail-header-actions"><button type="button" className="compact-button secondary" onClick={onCancel}>Cancel</button><button className="compact-button primary" disabled={!form.mailReferenceNumber.trim() || !form.subject.trim()}>Save mail</button></div></header>
    <section className="mail-attachments mail-attachment-first">
      <div><h2><Paperclip size={16} /> Attachments</h2><p>Add the original letter, email export, acknowledgement, or supporting file before completing the correspondence.</p>{readMessage && <p className="mail-attachment-message">{readMessage}</p>}</div>
      <input ref={fileInput} type="file" multiple hidden onChange={(event) => addAttachments(event.target.files)} />
      <button type="button" className="compact-button secondary" disabled={isReadingAttachment} onClick={() => fileInput.current?.click()}><Paperclip size={15} /> Add files</button>
      <button type="button" className="compact-button primary" disabled={isReadingAttachment || !form.attachments?.some((attachment) => attachment.extractedText)} onClick={fillMailFields}><FileSpreadsheet size={15} /> Read and fill mail fields</button>
      {form.attachments?.map((attachment) => <div className="mail-file" key={attachment.id}><span>{attachment.name}</span><button type="button" onClick={() => setForm((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id) }))} aria-label={`Remove ${attachment.name}`}><X size={14} /></button>{attachment.ocrHeaderText && <small className="mail-ocr-review">Local OCR header review: {attachment.ocrHeaderText.replace(/\n/g, ' | ')}</small>}</div>)}
    </section>
    <section className="mail-form-sheet">
      <label>Mail reference number *<input value={form.mailReferenceNumber} onChange={(event) => update('mailReferenceNumber', event.target.value)} required /></label>
      <label>Dated<input type="date" value={form.dated} onChange={(event) => update('dated', event.target.value)} /></label>
      <label className="mail-bucket-field">Bucket / File number<select value={selectValue} onChange={(event) => selectBucket(event.target.value)}><option value="">Select bucket / file number</option>{bucketFileNumbers.map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>)}<option value="__custom__">Custom file number...</option></select>{addingCustomBucket && <input className="mail-custom-bucket" value={form.bucketFileNumber} onChange={(event) => update('bucketFileNumber', event.target.value)} placeholder="Enter a new file number" autoFocus />}{!addingCustomBucket && <button type="button" className="mail-add-bucket" onClick={() => selectBucket('__custom__')}><Plus size={13} /> Add new file number</button>}</label>
      <label>Priority<select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
      <label>Assigned to<select value={form.assignedTo} onChange={(event) => update('assignedTo', event.target.value)}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}</select></label>
      <label>Created by<input value={form.createdBy} onChange={(event) => update('createdBy', event.target.value)} /></label>
      <label>Created date<input type="date" value={form.createdDate} onChange={(event) => update('createdDate', event.target.value)} /></label>
      <label>Due date<input type="date" value={form.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label>
      <label>Label<select value={form.label} onChange={(event) => update('label', event.target.value)}><option>Mail In</option><option>Mail Out</option></select></label>
      <label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Pending</option><option>Completed</option></select></label>
      <label className="wide">Subject Line *<input value={form.subject} onChange={(event) => update('subject', event.target.value)} required /></label>
      <label className="wide">Body of the email<textarea rows="5" value={form.mailSummary} onChange={(event) => update('mailSummary', event.target.value)} /></label>
    </section>
  </form>
}

export function LegacyMailForm({ record, users, onCancel, onSave }) {
  const [form, setForm] = useState(record)
  const [addingCustomBucket, setAddingCustomBucket] = useState(Boolean(form.bucketFileNumber) && !bucketFileNumbers.includes(form.bucketFileNumber))
  const fileInput = useRef(null)
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const addAttachments = async (files) => {
    const prepared = await Promise.all(Array.from(files).map(async (file) => {
      const [attachment, extraction] = await Promise.all([readAttachment(file), extractAttachmentText(file).catch(() => ({ text: '', headerText: '' }))])
      return { attachment, text: extraction.text }
    }))
    const extracted = prepared.map((item) => item.text).find(Boolean)
    const fields = extracted ? deriveMailFields(extracted) : null
    setForm((current) => ({
      ...current,
      attachments: [...(current.attachments || []), ...prepared.map((item) => item.attachment)],
      mailReferenceNumber: current.mailReferenceNumber || fields?.reference || '',
      subject: current.subject || fields?.subject || '',
      mailSummary: current.mailSummary || fields?.summary || '',
    }))
  }
  const selectValue = addingCustomBucket ? '__custom__' : form.bucketFileNumber
  const selectBucket = (value) => {
    if (value === '__custom__') {
      setAddingCustomBucket(true)
      update('bucketFileNumber', '')
      return
    }
    setAddingCustomBucket(false)
    update('bucketFileNumber', value)
  }
  return <form className="mail-form" onSubmit={(event) => { event.preventDefault(); onSave(form) }}><header className="mail-header"><div><p>Mail correspondence</p><h1>{form.id ? 'Edit mail' : 'Create mail'}</h1><span>Capture the correspondence, ownership, due date, and source documents.</span></div><div className="mail-header-actions"><button type="button" className="compact-button secondary" onClick={onCancel}>Cancel</button><button className="compact-button primary" disabled={!form.mailReferenceNumber.trim() || !form.subject.trim()}>Save mail</button></div></header><section className="mail-form-sheet"><label>Mail reference number *<input value={form.mailReferenceNumber} onChange={(event) => update('mailReferenceNumber', event.target.value)} required /></label><label>Dated<input type="date" value={form.dated} onChange={(event) => update('dated', event.target.value)} /></label><label className="mail-bucket-field">Bucket / File number<select value={selectValue} onChange={(event) => selectBucket(event.target.value)}><option value="">Select bucket / file number</option>{bucketFileNumbers.map((bucket) => <option key={bucket} value={bucket}>{bucket}</option>)}<option value="__custom__">Custom file number...</option></select>{addingCustomBucket && <input className="mail-custom-bucket" value={form.bucketFileNumber} onChange={(event) => update('bucketFileNumber', event.target.value)} placeholder="Enter a new file number" autoFocus />}{!addingCustomBucket && <button type="button" className="mail-add-bucket" onClick={() => selectBucket('__custom__')}><Plus size={13} /> Add new file number</button>}</label><label>Priority<select value={form.priority} onChange={(event) => update('priority', event.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label>Assigned to<select value={form.assignedTo} onChange={(event) => update('assignedTo', event.target.value)}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}</select></label><label>Created by<input value={form.createdBy} onChange={(event) => update('createdBy', event.target.value)} /></label><label>Created date<input type="date" value={form.createdDate} onChange={(event) => update('createdDate', event.target.value)} /></label><label>Due date<input type="date" value={form.dueDate} onChange={(event) => update('dueDate', event.target.value)} /></label><label>Label<select value={form.label} onChange={(event) => update('label', event.target.value)}><option>Mail In</option><option>Mail Out</option></select></label><label>Status<select value={form.status} onChange={(event) => update('status', event.target.value)}><option>Pending</option><option>Completed</option></select></label><label className="wide">Subject *<input value={form.subject} onChange={(event) => update('subject', event.target.value)} required /></label><label className="wide">Mail summary<textarea rows="5" value={form.mailSummary} onChange={(event) => update('mailSummary', event.target.value)} /></label><section className="mail-attachments wide"><div><h2><Paperclip size={16} /> Attachments</h2><p>Add the original letter, email export, acknowledgement, or supporting file.</p></div><input ref={fileInput} type="file" multiple hidden onChange={(event) => addAttachments(event.target.files)} /><button type="button" className="compact-button secondary" onClick={() => fileInput.current?.click()}><Paperclip size={15} /> Add files</button>{form.attachments?.map((attachment) => <div className="mail-file" key={attachment.id}><span>{attachment.name}</span><button type="button" onClick={() => setForm((current) => ({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id) }))} aria-label={`Remove ${attachment.name}`}><X size={14} /></button></div>)}</section></section></form>
}