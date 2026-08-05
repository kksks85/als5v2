import { useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Download, Paperclip, Plus, StickyNote, Trash2, X } from 'lucide-react'

const toDateKey = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const formatDate = (dateKey) => new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

const monthTitle = (month) => month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export default function MyCalendarPage({ incidents, events, setEvents, currentUser }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState([])
  const [attachmentMessage, setAttachmentMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const attachmentInput = useRef(null)
  const incidentByDate = useMemo(() => incidents.reduce((grouped, incident) => {
    const dateKey = toDateKey(incident.opened)
    if (dateKey) (grouped[dateKey] ||= []).push(incident)
    return grouped
  }, {}), [incidents])
  const eventByDate = useMemo(() => events.reduce((grouped, event) => {
    if (event.date) (grouped[event.date] ||= []).push(event)
    return grouped
  }, {}), [events])
  const days = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
    const offset = (firstDay.getDay() + 6) % 7
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - offset)
    return Array.from({ length: 42 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index))
  }, [month])
  const selectedIncidents = selectedDate ? incidentByDate[selectedDate] || [] : []
  const selectedEvents = selectedDate ? eventByDate[selectedDate] || [] : []
  const today = toDateKey(new Date())
  const monthIncidents = useMemo(() => incidents.filter((incident) => {
    const date = new Date(incident.opened)
    return !Number.isNaN(date.getTime()) && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
  }).length, [incidents, month])
  const monthEvents = useMemo(() => events.filter((event) => event.date?.startsWith(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`)).length, [events, month])

  const addEvent = () => {
    if (!selectedDate || !note.trim()) return
    setSaving(true)
    setEvents((current) => [{
      id: `calendar-event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      date: selectedDate,
      note: note.trim(),
      attachments,
      createdBy: currentUser.name || currentUser.email,
      createdByUserId: currentUser.id || currentUser.email,
      createdAt: new Date().toISOString(),
    }, ...current])
    setNote('')
    setAttachments([])
    setAttachmentMessage('')
    setSaving(false)
  }
  const addAttachments = async (files) => {
    const selectedFiles = Array.from(files || [])
    const rejected = selectedFiles.filter((file) => file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip')
    const accepted = selectedFiles.filter((file) => !rejected.includes(file))
    const prepared = await Promise.all(accepted.map((file) => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: `calendar-file-${Date.now()}-${file.name}-${Math.random().toString(36).slice(2, 7)}`, name: file.name, type: file.type, size: file.size, content: reader.result })
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })))
    setAttachments((current) => [...current, ...prepared.filter(Boolean)])
    setAttachmentMessage(rejected.length ? 'ZIP files are not permitted. Select a document, image, or PDF instead.' : '')
  }

  return <section className="calendar-page">
    <header className="calendar-header">
      <div><p>Customer Support Management</p><h1>My Calendar</h1><span>Created incidents and operational follow-ups in one daily work view.</span></div>
      <div className="calendar-header-summary"><span><ClipboardList size={16} /><strong>{monthIncidents}</strong> incidents</span><span><StickyNote size={16} /><strong>{monthEvents}</strong> events</span></div>
    </header>
    <div className="calendar-workspace">
      <section className="calendar-board">
        <header className="calendar-controls"><div className="calendar-month-switcher"><button type="button" className="icon-button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={17} /></button><h2>{monthTitle(month)}</h2><button type="button" className="icon-button" onClick={() => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={17} /></button></div><button type="button" className="compact-button secondary" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button></header>
        <div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{days.map((day) => {
          const dateKey = toDateKey(day)
          const incidentsForDay = incidentByDate[dateKey] || []
          const eventsForDay = eventByDate[dateKey] || []
          const count = incidentsForDay.length + eventsForDay.length
          return <button type="button" key={dateKey} className={`calendar-day ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${dateKey === today ? 'today' : ''} ${dateKey === selectedDate ? 'selected' : ''}`} onClick={() => setSelectedDate(dateKey)}><span className="calendar-day-top"><span className="calendar-day-number">{day.getDate()}</span>{count > 0 && <b aria-label={`${count} entries`}>{count}</b>}</span>{incidentsForDay.slice(0, 2).map((incident) => <span className="calendar-incident-chip" key={incident.id}>{incident.id}</span>)}{incidentsForDay.length > 2 && <small className="calendar-more">+{incidentsForDay.length - 2} more incidents</small>}{eventsForDay.length > 0 && <small className="calendar-event-count"><StickyNote size={11} /> {eventsForDay.length} event{eventsForDay.length === 1 ? '' : 's'}</small>}</button>
        })}</div>
      </section>
      <aside className="calendar-details" aria-live="polite">{selectedDate ? <>
        <header><div><p>Selected date</p><h2>{formatDate(selectedDate)}</h2></div><button className="icon-button" onClick={() => setSelectedDate(null)} aria-label="Close date details"><X size={16} /></button></header>
        <section className="calendar-add-event"><label>Add event note<textarea value={note} onChange={(event) => setNote(event.target.value)} rows="2" placeholder="Event, follow-up, meeting, or reminder" /></label><input ref={attachmentInput} type="file" multiple hidden onChange={(event) => { addAttachments(event.target.files); event.target.value = '' }} /><div className="calendar-event-actions"><button type="button" className="compact-button secondary" onClick={() => attachmentInput.current?.click()}><Paperclip size={14} /> Add attachment</button><button type="button" className="compact-button primary" disabled={!note.trim() || saving} onClick={addEvent}><Plus size={15} /> Add event</button></div>{attachmentMessage && <small className="calendar-attachment-message">{attachmentMessage}</small>}{attachments.length > 0 && <div className="calendar-new-attachments">{attachments.map((attachment) => <span key={attachment.id}>{attachment.name}<button type="button" onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))} aria-label={`Remove ${attachment.name}`}><X size={12} /></button></span>)}</div>}</section>
        <section className="calendar-detail-list"><h3>Incidents <span>{selectedIncidents.length}</span></h3>{selectedIncidents.length ? selectedIncidents.map((incident) => <article className="calendar-incident" key={incident.id}><strong>{incident.id}</strong><span>{incident.title}</span><small>{incident.priority || 'No priority'} · {incident.status || incident.stage || incident.state}</small></article>) : <p className="calendar-empty">No incidents were created on this date.</p>}</section>
        <section className="calendar-detail-list"><h3>Events <span>{selectedEvents.length}</span></h3>{selectedEvents.length ? selectedEvents.map((event) => <article className="calendar-event" key={event.id}><p>{event.note}</p><small>{event.createdBy}</small>{event.attachments?.length > 0 && <div className="calendar-saved-attachments">{event.attachments.map((attachment) => <a key={attachment.id} href={attachment.content} download={attachment.name} title={`Download ${attachment.name}`}><Paperclip size={12} />{attachment.name}<Download size={12} /></a>)}</div>}<button type="button" className="icon-button danger" aria-label="Delete event" onClick={() => setEvents((current) => current.filter((item) => item.id !== event.id))}><Trash2 size={14} /></button></article>) : <p className="calendar-empty">No calendar events recorded for this date.</p>}</section>
      </> : <div className="calendar-empty-selection"><CalendarDays size={28} /><h2>Select a date</h2><p>Open a date to review its incidents and record an event note.</p></div>}</aside>
    </div>
  </section>
}
