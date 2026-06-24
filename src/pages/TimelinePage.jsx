import { useState, useMemo, useRef } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'

const DEFAULT_TRIPS = [
  { id: '6e7696ea-b754-49a3-ac42-213bc48f459e', slug: 'today',  label: 'Today',        emoji: '📍', fixed: true },
  { id: 'd93cebae-a4c1-4f71-842c-88410af4450a', slug: 'turkey', label: 'Turkey',       emoji: '🇹🇷' },
  { id: 'ff91d8b7-516c-4a87-9bdf-5bac2b398f93', slug: 'saudi',  label: 'Saudi Arabia', emoji: '🇸🇦' },
]

const UPCOMING_TAB = { slug: 'upcoming', label: 'Upcoming', emoji: '🗓️', fixed: true }

const EMOJI_OPTIONS = ['✈️','🌍','🏔️','🏖️','🏙️','🗺️','🎒','🚂','🛳️','🏕️','🍜','☕','🎭','📸','🌅','⛩️','🕌','🏛️','🌴','❄️']

const s = {
  page:       { fontFamily: 'Inter, sans-serif', background: '#f7f3ee', minHeight: '100vh', color: '#1a1612' },
  header:     { background: '#fff', borderBottom: '1px solid #ece8e2', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  logo:       { fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#b85c3a', fontSize: 18, fontWeight: 700 },
  tabs:       { background: '#fff', borderBottom: '1px solid #ece8e2', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' },
  tab:        (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid #b85c3a' : '2px solid transparent', color: active ? '#1a1612' : '#9a9088', padding: '12px 16px', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }),
  addTabBtn:  { background: 'none', border: 'none', color: '#b85c3a', padding: '12px 14px', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 },
  feed:       { maxWidth: 560, margin: '0 auto', padding: '16px 16px 100px' },
  dayHeader:  { display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px' },
  dayBadge:   { width: 32, height: 32, borderRadius: '50%', background: '#b85c3a', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card:       { background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 12, overflow: 'hidden' },
  cardTop:    { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0' },
  avatar:     { width: 34, height: 34, borderRadius: '50%', background: '#b85c3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' },
  cardText:   { padding: '8px 14px 10px', fontSize: 14, lineHeight: 1.55, color: '#2a2420' },
  cardFooter: { padding: '8px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0ece6' },
  reactBtn:   (r) => ({ background: r ? '#fef3ee' : 'none', border: `1px solid ${r ? '#b85c3a' : '#ece8e2'}`, borderRadius: 100, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: r ? '#b85c3a' : '#6b6258', display: 'flex', alignItems: 'center', gap: 4 }),
  deleteBtn:  { background: 'none', border: '1px solid #ece8e2', borderRadius: 100, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#cc4444' },
  fab:        { position: 'fixed', bottom: 24, right: 24, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(184,92,58,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlay:    { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:      { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 560 },
  label:      { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6258', marginBottom: 5, display: 'block' },
  input:      { width: '100%', border: '1.5px solid #ece8e2', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#f7f3ee', fontFamily: 'Inter, sans-serif', outline: 'none', color: '#1a1612', resize: 'none' },
  submitBtn:  { width: '100%', background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  toast:      { position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', background: '#1a1612', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 400, whiteSpace: 'nowrap' },
}

function Avatar({ user }) {
  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  if (user?.user_metadata?.avatar_url)
    return <img src={user.user_metadata.avatar_url} alt="" style={{ ...s.avatar, objectFit: 'cover' }} />
  return <div style={s.avatar}>{initial}</div>
}

function PhotoGrid({ images }) {
  if (!images?.length) return null
  const shown = images.slice(0, 4)
  const extra = images.length - 4
  const grid = shown.length === 1 ? { gridTemplateColumns: '1fr', height: 280 }
    : shown.length === 2 ? { gridTemplateColumns: '1fr 1fr', height: 200 }
    : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 300 }
  return (
    <div style={{ display: 'grid', gap: 2, ...grid }}>
      {shown.map((img, i) => (
        <div key={img.id ?? i} style={{ position: 'relative', overflow: 'hidden', ...(shown.length === 3 && i === 0 ? { gridRow: '1 / 3' } : {}) }}>
          <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {i === 3 && extra > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>+{extra}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function MomentCard({ moment, user, onReact, onDelete }) {
  const images = moment.moment_images ?? []
  const reactions = moment.reactions ?? []
  const myReaction = reactions.find(r => r.user_id === user?.id && r.emoji === '🫶')
  const reactionCount = reactions.filter(r => r.emoji === '🫶').length
  const time = format(parseISO(moment.created_at), 'h:mm a')
  const isOwner = user?.id === moment.user_id
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Traveller'

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <Avatar user={user} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
          <div style={{ fontSize: 11, color: '#9a9088' }}>{time}</div>
        </div>
        {isOwner && (
          <button onClick={() => onDelete(moment)} style={s.deleteBtn}>Delete</button>
        )}
      </div>
      {moment.caption && <div style={s.cardText}>{moment.caption}</div>}
      <PhotoGrid images={images} />
      <div style={s.cardFooter}>
        <button style={s.reactBtn(!!myReaction)} onClick={() => user && onReact(moment.id)}>
          🫶 {reactionCount}
        </button>
        {moment.location && <div style={{ fontSize: 11, color: '#9a9088' }}>📍 {moment.location}</div>}
      </div>
    </div>
  )
}

function AddMomentModal({ onClose, onAdd, loading }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const fileRef = useRef()

  function handleFiles(e) {
    const picked = Array.from(e.target.files)
    setFiles(f => [...f, ...picked])
    picked.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => setPreviews(p => [...p, ev.target.result])
      reader.readAsDataURL(file)
    })
  }

  function removePreview(i) {
    setFiles(f => f.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={s.overlay}>
      <div style={s.modal}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add a moment
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9a9088' }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Caption</label>
          <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="What happened?" style={s.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Riyadh, Saudi Arabia" style={{ ...s.input, resize: undefined }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Photos</label>
          <div onClick={() => fileRef.current.click()} style={{ border: '2px dashed #c8a882', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', color: '#9a9088', fontSize: 13, background: '#f7f3ee' }}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>Tap to upload photos
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {previews.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt="" style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', border: '2px solid #ece8e2', display: 'block' }} />
                  <button onClick={() => removePreview(i)} style={{ position: 'absolute', top: -6, right: -6, background: '#cc4444', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => onAdd({ caption: caption.trim(), location: location.trim(), imageFiles: files })}
          disabled={loading} style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Posting…' : 'Post Moment'}
        </button>
      </div>
    </div>
  )
}

function AddTripModal({ onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('✈️')

  function submit() {
    if (!label.trim()) return
    onAdd({ label: label.trim(), emoji })
    onClose()
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={s.overlay}>
      <div style={s.modal}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          New Trip
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9a9088' }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Trip Name</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Japan 2025" style={{ ...s.input, resize: undefined }} autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={s.label}>Pick an emoji</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{ background: emoji === e ? '#fef3ee' : '#f7f3ee', border: `2px solid ${emoji === e ? '#b85c3a' : 'transparent'}`, borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={submit} disabled={!label.trim()} style={{ ...s.submitBtn, opacity: label.trim() ? 1 : 0.5 }}>
          Add Trip
        </button>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ moment, onClose, onConfirm, loading }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={s.overlay}>
      <div style={{ ...s.modal, padding: '28px 24px 36px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 10 }}>Delete this moment?</div>
        <div style={{ fontSize: 14, color: '#6b6258', marginBottom: 24 }}>This will permanently delete the moment and all its photos. This can't be undone.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f7f3ee', color: '#1a1612', border: '1px solid #ece8e2', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, background: '#cc4444', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [trips, setTrips] = useState(DEFAULT_TRIPS)
  const [activeSlug, setActiveSlug] = useState('today')
  const [showAddMoment, setShowAddMoment] = useState(false)
  const [showAddTrip, setShowAddTrip] = useState(false)
  const [momentToDelete, setMomentToDelete] = useState(null)
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const activeTrip = trips.find(t => t.slug === activeSlug)
  const tripId = activeTrip?.id ?? null
  const { moments, loading, addMoment, toggleReaction, refetch } = useMoments(tripId)

  const visibleMoments = useMemo(() => {
    if (activeSlug !== 'today') return moments
    return moments.filter(m => isToday(parseISO(m.created_at)))
  }, [moments, activeSlug])

  const grouped = useMemo(() =>
    visibleMoments.reduce((acc, m) => {
      const day = format(parseISO(m.created_at), 'EEE d')
      if (!acc[day]) acc[day] = []
      acc[day].push(m)
      return acc
    }, {}), [visibleMoments])

  const days = Object.keys(grouped)

  async function handleAddMoment(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id })
      setShowAddMoment(false)
      showToast('Moment posted! ✨')
    } catch(e) {
      showToast('Error: ' + e.message)
    } finally {
      setPosting(false)
    }
  }

  async function handleAddTrip({ label, emoji }) {
    // Insert into DB
    const { data, error } = await supabase
      .from('trips')
      .insert({ user_id: user.id, name: label, is_public: true })
      .select().single()
    if (error) { showToast('Failed to create trip'); return }
    const slug = label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    setTrips(t => [...t, { id: data.id, slug, label, emoji }])
    setActiveSlug(slug)
    showToast(`${emoji} ${label} added!`)
  }

  async function handleDeleteMoment() {
    if (!momentToDelete) return
    setDeleting(true)
    try {
      // Delete images from storage
      const images = momentToDelete.moment_images ?? []
      for (const img of images) {
        const path = img.url.split('/moment-images/')[1]
        if (path) await supabase.storage.from('moment-images').remove([decodeURIComponent(path)])
      }
      // Delete moment (cascades to moment_images + reactions)
      await supabase.from('moments').delete().eq('id', momentToDelete.id)
      setMomentToDelete(null)
      await refetch()
      showToast('Moment deleted')
    } catch(e) {
      showToast('Delete failed: ' + e.message)
    } finally {
      setDeleting(false)
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const allTabs = [...trips, UPCOMING_TAB]

  return (
    <div style={s.page}>
      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>wanderlog</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <>
              <Avatar user={user} />
              <button onClick={signOut} style={{ background: 'none', border: '1px solid #ece8e2', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: '#6b6258' }}>Sign out</button>
            </>
          ) : (
            <button onClick={signInWithGoogle} style={{ background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Sign in</button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div style={s.tabs}>
        {allTabs.map(tab => (
          <button key={tab.slug} onClick={() => setActiveSlug(tab.slug)} style={s.tab(activeSlug === tab.slug)}>
            {tab.emoji} {tab.label}
          </button>
        ))}
        {user && (
          <button onClick={() => setShowAddTrip(true)} style={s.addTabBtn} title="Add a trip">＋</button>
        )}
      </div>

      {/* Upcoming */}
      {activeSlug === 'upcoming' && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 8 }}>More trips coming</div>
          <div style={{ color: '#9a9088', fontSize: 14, marginBottom: 32 }}>Future adventures will appear here.</div>
          {user && (
            <button onClick={() => setShowAddTrip(true)} style={{ background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              + Add a Trip
            </button>
          )}
        </div>
      )}

      {/* Feed */}
      {activeSlug !== 'upcoming' && (
        <div style={s.feed}>
          {activeSlug === 'today' && (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{ fontSize: 12, color: '#9a9088', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{format(new Date(), 'EEEE, MMMM d')}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginTop: 4 }}>Today's Moments</div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9a9088', padding: 60 }}>Loading…</div>
          ) : visibleMoments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{activeTrip?.emoji ?? '✈️'}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 6 }}>
                {activeSlug === 'today' ? 'Nothing posted today yet' : 'No moments yet'}
              </div>
              <div style={{ color: '#9a9088', fontSize: 13 }}>
                {user ? 'Tap + to post your first moment' : 'Sign in to start posting'}
              </div>
              {!user && <button onClick={signInWithGoogle} style={{ marginTop: 16, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign in with Google</button>}
            </div>
          ) : (
            days.map(day => (
              <div key={day}>
                <div style={s.dayHeader}>
                  <div style={s.dayBadge}>{day.split(' ')[1]}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 11, color: '#9a9088', marginLeft: 'auto' }}>{grouped[day].length} moment{grouped[day].length !== 1 ? 's' : ''}</div>
                </div>
                {grouped[day].map(m => (
                  <MomentCard key={m.id} moment={m} user={user} onReact={id => user && toggleReaction(id, user.id)} onDelete={setMomentToDelete} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB */}
      {user && activeSlug !== 'upcoming' && (
        <button onClick={() => setShowAddMoment(true)} style={s.fab}>＋</button>
      )}

      {showAddMoment && <AddMomentModal onClose={() => setShowAddMoment(false)} onAdd={handleAddMoment} loading={posting} />}
      {showAddTrip && <AddTripModal onClose={() => setShowAddTrip(false)} onAdd={handleAddTrip} />}
      {momentToDelete && <DeleteConfirmModal moment={momentToDelete} onClose={() => setMomentToDelete(null)} onConfirm={handleDeleteMoment} loading={deleting} />}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}
