import { useState, useMemo, useRef } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'

const TRIPS = {
  today:  { id: '6e7696ea-b754-49a3-ac42-213bc48f459e', name: 'Today',        emoji: '📍' },
  turkey: { id: 'd93cebae-a4c1-4f71-842c-88410af4450a', name: 'Turkey',       emoji: '🇹🇷' },
  saudi:  { id: 'ff91d8b7-516c-4a87-9bdf-5bac2b398f93', name: 'Saudi Arabia', emoji: '🇸🇦' },
}

const TABS = [
  { id: 'today',    label: 'Today',        emoji: '📍' },
  { id: 'turkey',   label: 'Turkey',       emoji: '🇹🇷' },
  { id: 'saudi',    label: 'Saudi Arabia', emoji: '🇸🇦' },
  { id: 'upcoming', label: 'Upcoming',     emoji: '🗓️' },
]

const s = {
  page:        { fontFamily: 'Inter, sans-serif', background: '#f7f3ee', minHeight: '100vh', color: '#1a1612' },
  header:      { background: '#fff', borderBottom: '1px solid #ece8e2', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  logo:        { fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#b85c3a', fontSize: 18, fontWeight: 700 },
  tabs:        { background: '#fff', borderBottom: '1px solid #ece8e2', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' },
  tab:         (active) => ({ background: 'none', border: 'none', borderBottom: active ? '2px solid #b85c3a' : '2px solid transparent', color: active ? '#1a1612' : '#9a9088', padding: '12px 18px', fontSize: 13, fontWeight: active ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }),
  feed:        { maxWidth: 560, margin: '0 auto', padding: '16px 16px 100px' },
  dayHeader:   { display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px' },
  dayBadge:    { width: 32, height: 32, borderRadius: '50%', background: '#b85c3a', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  dayLabel:    { fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700 },
  dayCount:    { fontSize: 11, color: '#9a9088', marginLeft: 'auto' },
  card:        { background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 12, overflow: 'hidden' },
  cardTop:     { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0' },
  avatar:      { width: 34, height: 34, borderRadius: '50%', background: '#b85c3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' },
  cardMeta:    { flex: 1 },
  cardName:    { fontSize: 13, fontWeight: 600 },
  cardTime:    { fontSize: 11, color: '#9a9088' },
  cardText:    { padding: '8px 14px 10px', fontSize: 14, lineHeight: 1.55, color: '#2a2420' },
  cardFooter:  { padding: '8px 14px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f0ece6' },
  reactBtn:    (reacted) => ({ background: reacted ? '#fef3ee' : 'none', border: `1px solid ${reacted ? '#b85c3a' : '#ece8e2'}`, borderRadius: 100, padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: reacted ? '#b85c3a' : '#6b6258', display: 'flex', alignItems: 'center', gap: 4 }),
  location:    { fontSize: 11, color: '#9a9088', display: 'flex', alignItems: 'center', gap: 3 },
  fab:         { position: 'fixed', bottom: 24, right: 24, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(184,92,58,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:       { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 560 },
  modalTitle:  { fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label:       { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6258', marginBottom: 5, display: 'block' },
  input:       { width: '100%', border: '1.5px solid #ece8e2', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#f7f3ee', fontFamily: 'Inter, sans-serif', outline: 'none', color: '#1a1612', resize: 'none' },
  uploadZone:  { border: '2px dashed #c8a882', borderRadius: 10, padding: 20, textAlign: 'center', cursor: 'pointer', color: '#9a9088', fontSize: 13, background: '#f7f3ee' },
  submitBtn:   { width: '100%', background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  toast:       { position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', background: '#1a1612', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 400, whiteSpace: 'nowrap' },
  empty:       { textAlign: 'center', padding: '60px 20px' },
  signInBtn:   { marginTop: 16, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
}

function Avatar({ user }) {
  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  if (user?.user_metadata?.avatar_url) {
    return <img src={user.user_metadata.avatar_url} alt="" style={{ ...s.avatar, objectFit: 'cover' }} />
  }
  return <div style={s.avatar}>{initial}</div>
}

function PhotoGrid({ images }) {
  if (!images?.length) return null
  const shown = images.slice(0, 4)
  const extra = images.length - 4

  const grid = shown.length === 1
    ? { gridTemplateColumns: '1fr', height: 280 }
    : shown.length === 2
    ? { gridTemplateColumns: '1fr 1fr', height: 200 }
    : shown.length === 3
    ? { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 300 }
    : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 300 }

  return (
    <div style={{ display: 'grid', gap: 2, ...grid, position: 'relative' }}>
      {shown.map((img, i) => (
        <div key={img.id ?? i} style={{ position: 'relative', overflow: 'hidden', ...(shown.length === 3 && i === 0 ? { gridRow: '1 / 3' } : {}) }}>
          <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {i === 3 && extra > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MomentCard({ moment, user, onReact }) {
  const images = moment.moment_images ?? []
  const reactions = moment.reactions ?? []
  const myReaction = reactions.find(r => r.user_id === user?.id && r.emoji === '🫶')
  const reactionCount = reactions.filter(r => r.emoji === '🫶').length
  const time = format(parseISO(moment.created_at), 'h:mm a')
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Traveller'

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <Avatar user={user} />
        <div style={s.cardMeta}>
          <div style={s.cardName}>{displayName}</div>
          <div style={s.cardTime}>{time}</div>
        </div>
      </div>
      {moment.caption && <div style={s.cardText}>{moment.caption}</div>}
      <PhotoGrid images={images} />
      <div style={s.cardFooter}>
        <button style={s.reactBtn(!!myReaction)} onClick={() => user && onReact(moment.id)}>
          🫶 {reactionCount}
        </button>
        {moment.location && <div style={s.location}>📍 {moment.location}</div>}
      </div>
    </div>
  )
}

function AddModal({ user, onClose, onAdd, loading }) {
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

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={s.overlay}>
      <div style={s.modal}>
        <div style={s.modalTitle}>
          Add a moment
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9a9088' }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Caption</label>
          <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="What happened?" style={s.input} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Riyadh, Saudi Arabia" style={{ ...s.input, resize: undefined }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Photos</label>
          <div onClick={() => fileRef.current.click()} style={s.uploadZone}>
            <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
            Tap to upload photos
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', border: '2px solid #ece8e2' }} />
              ))}
            </div>
          )}
        </div>

        <button onClick={() => caption.trim() && onAdd({ caption: caption.trim(), location: location.trim(), imageFiles: files })}
          disabled={loading || !caption.trim()} style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Posting…' : 'Post Moment'}
        </button>
      </div>
    </div>
  )
}

export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('today')
  const [showModal, setShowModal] = useState(false)
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState('')

  const tripId = TRIPS[activeTab]?.id ?? null
  const { moments, loading, addMoment, toggleReaction } = useMoments(tripId)

  const visibleMoments = useMemo(() => {
    if (activeTab !== 'today') return moments
    return moments.filter(m => isToday(parseISO(m.created_at)))
  }, [moments, activeTab])

  const grouped = useMemo(() =>
    visibleMoments.reduce((acc, m) => {
      const day = format(parseISO(m.created_at), 'EEE d')
      if (!acc[day]) acc[day] = []
      acc[day].push(m)
      return acc
    }, {}), [visibleMoments])

  const days = Object.keys(grouped)

  async function handleAdd(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id })
      setShowModal(false)
      showToast('Moment posted! ✨')
    } catch(e) {
      console.error(e)
      showToast('Failed: ' + e.message)
    } finally {
      setPosting(false)
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

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
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={s.tab(activeTab === tab.id)}>
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      {activeTab === 'upcoming' && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 8 }}>More trips coming</div>
          <div style={{ color: '#9a9088', fontSize: 14 }}>Future adventures will appear here.</div>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[{ name: 'Turkey', emoji: '🇹🇷' }, { name: 'Saudi Arabia', emoji: '🇸🇦' }].map(t => (
              <div key={t.name} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: 24 }}>{t.emoji}</span>
                <span style={{ fontWeight: 600 }}>{t.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, background: '#f0ece6', color: '#6b6258', borderRadius: 100, padding: '3px 10px', fontWeight: 600 }}>Soon</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed */}
      {activeTab !== 'upcoming' && (
        <div style={s.feed}>
          {/* Day header for Today */}
          {activeTab === 'today' && (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{ fontSize: 12, color: '#9a9088', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{format(new Date(), 'EEEE, MMMM d')}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginTop: 4 }}>Today's Moments</div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', color: '#9a9088', padding: 60 }}>Loading…</div>
          ) : visibleMoments.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{TRIPS[activeTab]?.emoji ?? '✈️'}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 6 }}>
                {activeTab === 'today' ? 'Nothing posted today yet' : `No moments yet`}
              </div>
              <div style={{ color: '#9a9088', fontSize: 13 }}>
                {user ? 'Tap + to post your first moment' : 'Sign in to start posting'}
              </div>
              {!user && <button onClick={signInWithGoogle} style={s.signInBtn}>Sign in with Google</button>}
            </div>
          ) : (
            days.map(day => (
              <div key={day}>
                <div style={s.dayHeader}>
                  <div style={s.dayBadge}>{day.split(' ')[1]}</div>
                  <div style={s.dayLabel}>{day}</div>
                  <div style={s.dayCount}>{grouped[day].length} moment{grouped[day].length !== 1 ? 's' : ''}</div>
                </div>
                {grouped[day].map(m => (
                  <MomentCard key={m.id} moment={m} user={user} onReact={id => user && toggleReaction(id, user.id)} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* FAB */}
      {user && activeTab !== 'upcoming' && (
        <button onClick={() => setShowModal(true)} style={s.fab}>＋</button>
      )}

      {showModal && <AddModal user={user} onClose={() => setShowModal(false)} onAdd={handleAdd} loading={posting} />}

      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}
