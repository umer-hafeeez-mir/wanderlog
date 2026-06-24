import { useState, useMemo, useRef, useEffect } from 'react'
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
const REACTIONS = ['❤️','😍','🔥','😂','😮','👏','🙌','💯']
const QUICK_REACTIONS = ['❤️','😍','🔥','😂']

const s = {
  page:      { fontFamily: 'Inter, sans-serif', background: '#f7f3ee', minHeight: '100vh', color: '#1a1612' },
  header:    { background: '#fff', borderBottom: '1px solid #ece8e2', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, position: 'sticky', top: 0, zIndex: 100 },
  logo:      { fontFamily: 'Georgia, serif', fontStyle: 'italic', color: '#b85c3a', fontSize: 18, fontWeight: 700 },
  tabs:      { background: '#fff', borderBottom: '1px solid #ece8e2', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' },
  tab:       (a) => ({ background: 'none', border: 'none', borderBottom: a ? '2px solid #b85c3a' : '2px solid transparent', color: a ? '#1a1612' : '#9a9088', padding: '12px 16px', fontSize: 13, fontWeight: a ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }),
  addTabBtn: { background: 'none', border: 'none', color: '#b85c3a', padding: '12px 14px', fontSize: 20, cursor: 'pointer', flexShrink: 0 },
  feed:      { maxWidth: 560, margin: '0 auto', padding: '16px 16px 100px' },
  dayBadge:  { width: 32, height: 32, borderRadius: '50%', background: '#b85c3a', color: '#fff', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  card:      { background: '#fff', borderRadius: 16, boxShadow: '0 1px 8px rgba(0,0,0,0.07)', marginBottom: 12, overflow: 'hidden' },
  avatar:    { width: 34, height: 34, borderRadius: '50%', background: '#b85c3a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, overflow: 'hidden' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:     { background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: 560 },
  input:     { width: '100%', border: '1.5px solid #ece8e2', borderRadius: 10, padding: '10px 12px', fontSize: 14, background: '#f7f3ee', fontFamily: 'Inter, sans-serif', outline: 'none', color: '#1a1612', resize: 'none' },
  label:     { fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b6258', marginBottom: 5, display: 'block' },
  submitBtn: { width: '100%', background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600, cursor: 'pointer', marginTop: 8 },
  fab:       { position: 'fixed', bottom: 24, right: 24, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: '50%', width: 52, height: 52, fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 16px rgba(184,92,58,0.4)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  toast:     { position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)', background: '#1a1612', color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 500, whiteSpace: 'nowrap' },
}

function Avatar({ user }) {
  const initial = user?.email?.[0]?.toUpperCase() ?? '?'
  if (user?.user_metadata?.avatar_url)
    return <img src={user.user_metadata.avatar_url} alt="" style={{ ...s.avatar, objectFit: 'cover' }} />
  return <div style={s.avatar}>{initial}</div>
}

// ── Lightbox ─────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, images.length - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✕</button>
      {images.length > 1 && (
        <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{index + 1} / {images.length}</div>
      )}
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); setIndex(i => i - 1) }} style={{ position: 'absolute', left: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
      )}
      <img onClick={e => e.stopPropagation()} src={images[index].url} alt=""
        style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }} />
      {index < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); setIndex(i => i + 1) }} style={{ position: 'absolute', right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      )}
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {images.map((_, i) => (
            <div key={i} onClick={e => { e.stopPropagation(); setIndex(i) }} style={{ width: 6, height: 6, borderRadius: '50%', background: i === index ? '#fff' : 'rgba(255,255,255,0.35)', cursor: 'pointer' }} />
          ))}
        </div>
      )}
    </div>
  )
}

function PhotoGrid({ images, onPhotoClick }) {
  if (!images?.length) return null
  const shown = images.slice(0, 4)
  const extra = images.length - 4
  const grid = shown.length === 1 ? { gridTemplateColumns: '1fr', height: 280 }
    : shown.length === 2 ? { gridTemplateColumns: '1fr 1fr', height: 200 }
    : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 300 }
  return (
    <div style={{ display: 'grid', gap: 2, ...grid }}>
      {shown.map((img, i) => (
        <div key={img.id ?? i} onClick={() => onPhotoClick(i)} style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', ...(shown.length === 3 && i === 0 ? { gridRow: '1 / 3' } : {}) }}>
          <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {i === 3 && extra > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700 }}>+{extra}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Menu (···) ───────────────────────────────────────────────
function MomentMenu({ moment, user, onDelete, onClose }) {
  const isOwner = user?.id === moment.user_id
  const images = moment.moment_images ?? []

  async function savePhoto(url) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'wanderlog-photo.jpg'
      a.click()
      onClose()
    } catch { onClose() }
  }

  function shareWhatsApp() {
    const text = encodeURIComponent('Check out this moment on Wanderlog! ' + window.location.href)
    window.open('https://wa.me/?text=' + text, '_blank')
    onClose()
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href)
    onClose()
  }

  const menuItems = [
    { icon: '💬', label: 'Share on WhatsApp', action: shareWhatsApp },
    { icon: '🔗', label: 'Copy link', action: copyLink },
    ...(images.length > 0 ? [{ icon: '💾', label: 'Save photo to phone', action: () => savePhoto(images[0].url) }] : []),
    ...(isOwner ? [{ icon: '🗑️', label: 'Delete moment', action: () => { onDelete(moment); onClose() }, danger: true }] : []),
  ]

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, paddingBottom: 32, overflow: 'hidden' }}>
        <div style={{ width: 36, height: 4, background: '#ece8e2', borderRadius: 2, margin: '12px auto 4px' }} />
        {menuItems.map(item => (
          <button key={item.label} onClick={item.action} style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid #f5f0eb', padding: '16px 20px', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, color: item.danger ? '#cc4444' : '#1a1612', textAlign: 'left' }}>
            <span style={{ fontSize: 20 }}>{item.icon}</span> {item.label}
          </button>
        ))}
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', borderTop: '1px solid #f5f0eb', padding: '16px 20px', fontSize: 15, cursor: 'pointer', color: '#9a9088', textAlign: 'center' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Comments ─────────────────────────────────────────────────
function Comments({ momentId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('comments').select('*').eq('moment_id', momentId).order('created_at').then(({ data }) => setComments(data ?? []))
  }, [momentId])

  async function submit() {
    if (!text.trim() || !user) return
    setLoading(true)
    const { data } = await supabase.from('comments').insert({ moment_id: momentId, user_id: user.id, text: text.trim(), user_name: user.user_metadata?.full_name ?? user.email }).select().single()
    if (data) { setComments(c => [...c, data]); setText('') }
    setLoading(false)
  }

  return (
    <div style={{ padding: '0 14px 12px', borderTop: '1px solid #f5f0eb' }}>
      {comments.length > 0 && (
        <div style={{ marginBottom: 10, marginTop: 10 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#e8e2d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#6b6258', flexShrink: 0 }}>
                {c.user_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ background: '#f7f3ee', borderRadius: 10, padding: '6px 10px', flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 12, color: '#1a1612' }}>{c.user_name?.split(' ')[0] ?? 'User'} </span>
                <span style={{ fontSize: 13, color: '#2a2420' }}>{c.text}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {user ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <Avatar user={user} />
          <input value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Add a comment…"
            style={{ flex: 1, border: '1.5px solid #ece8e2', borderRadius: 100, padding: '7px 14px', fontSize: 13, background: '#f7f3ee', outline: 'none', fontFamily: 'Inter, sans-serif' }} />
          {text.trim() && (
            <button onClick={submit} disabled={loading} style={{ background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 100, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Post
            </button>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#c8c0b8', marginTop: 8, fontStyle: 'italic' }}>Sign in to react or comment</div>
      )}
    </div>
  )
}

// ── Reaction Bar ──────────────────────────────────────────────
function ReactionBar({ moment, user, onReact }) {
  const [showPicker, setShowPicker] = useState(false)
  const reactions = moment.reactions ?? []

  // Group existing reactions by emoji with counts
  const grouped = REACTIONS.reduce((acc, emoji) => {
    const count = reactions.filter(r => r.emoji === emoji).length
    const mine = reactions.some(r => r.emoji === emoji && r.user_id === user?.id)
    if (count > 0) acc.push({ emoji, count, mine })
    return acc
  }, [])

  return (
    <div style={{ padding: '8px 14px', borderTop: '1px solid #f5f0eb', position: 'relative' }}>
      {/* Quick reaction buttons — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {QUICK_REACTIONS.map(emoji => {
          const existing = grouped.find(r => r.emoji === emoji)
          const mine = existing?.mine ?? false
          const count = existing?.count ?? 0
          return (
            <button key={emoji} onClick={() => user && onReact(moment.id, emoji)}
              disabled={!user}
              title={!user ? 'Sign in to react' : ''}
              style={{ background: mine ? '#fef3ee' : '#f7f3ee', border: `1px solid ${mine ? '#b85c3a' : '#ece8e2'}`, borderRadius: 100, padding: '5px 11px', fontSize: 15, cursor: user ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, color: mine ? '#b85c3a' : user ? '#6b6258' : '#c8c0b8', transition: 'all 0.15s', opacity: user ? 1 : 0.5 }}>
              {emoji}{count > 0 && <span style={{ fontSize: 12, fontWeight: 600 }}>{count}</span>}
            </button>
          )
        })}

        {/* More reactions picker — signed in only */}
        {user && (
          <div style={{ position: 'relative', marginLeft: 2 }}>
            <button onClick={() => setShowPicker(p => !p)} style={{ background: '#f7f3ee', border: '1px solid #ece8e2', borderRadius: 100, padding: '5px 10px', fontSize: 14, cursor: 'pointer', color: '#9a9088' }}>
              ＋
            </button>
            {showPicker && (
              <div style={{ position: 'absolute', bottom: 36, left: 0, background: '#fff', borderRadius: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 10, display: 'flex', gap: 4, flexWrap: 'wrap', width: 220, zIndex: 200 }}>
                {REACTIONS.map(emoji => (
                  <button key={emoji} onClick={() => { onReact(moment.id, emoji); setShowPicker(false) }}
                    style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', borderRadius: 8, padding: 4, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Any extra reactions not in QUICK_REACTIONS */}
        {grouped.filter(r => !QUICK_REACTIONS.includes(r.emoji)).map(r => (
          <button key={r.emoji} onClick={() => user && onReact(moment.id, r.emoji)}
            style={{ background: r.mine ? '#fef3ee' : '#f7f3ee', border: `1px solid ${r.mine ? '#b85c3a' : '#ece8e2'}`, borderRadius: 100, padding: '5px 11px', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: r.mine ? '#b85c3a' : '#6b6258' }}>
            {r.emoji} <span style={{ fontSize: 12, fontWeight: 600 }}>{r.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Moment Card ───────────────────────────────────────────────
function MomentCard({ moment, user, onReact, onMenuOpen }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const time = format(parseISO(moment.created_at), 'h:mm a')
  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Traveller'
  const images = moment.moment_images ?? []

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px 0' }}>
        <Avatar user={user} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
          <div style={{ fontSize: 11, color: '#9a9088' }}>{time}</div>
        </div>
        {user && (
          <button onClick={() => onMenuOpen(moment)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9a9088', padding: '4px 8px', borderRadius: 8, lineHeight: 1 }}>
            •••
          </button>
        )}
      </div>

      {/* Caption */}
      {moment.caption && <div style={{ padding: '8px 14px 10px', fontSize: 14, lineHeight: 1.55, color: '#2a2420' }}>{moment.caption}</div>}

      {/* Location */}
      {moment.location && <div style={{ padding: '0 14px 10px', fontSize: 12, color: '#9a9088', display: 'flex', alignItems: 'center', gap: 4 }}>📍 {moment.location}</div>}

      {/* Photos */}
      <PhotoGrid images={images} onPhotoClick={setLightboxIndex} />
      {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}

      {/* Reactions */}
      <ReactionBar moment={moment} user={user} onReact={onReact} />

      {/* Comments */}
      <Comments momentId={moment.id} user={user} />
    </div>
  )
}

// ── Add Moment Modal ──────────────────────────────────────────
function AddMomentModal({ onClose, onAdd, loading }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const fileRef = useRef()

  function handleFiles(e) {
    Array.from(e.target.files).forEach(file => {
      setFiles(f => [...f, file])
      const r = new FileReader()
      r.onload = ev => setPreviews(p => [...p, ev.target.result])
      r.readAsDataURL(file)
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
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Caption</label>
          <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="What happened?" style={s.input} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={s.label}>Location</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Riyadh, Saudi Arabia" style={{ ...s.input, resize: 'none' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Photos</label>
          <div onClick={() => fileRef.current.click()} style={{ border: '2px dashed #c8a882', borderRadius: 10, padding: 18, textAlign: 'center', cursor: 'pointer', color: '#9a9088', fontSize: 13, background: '#f7f3ee' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>📷</div>Tap to upload photos
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {previews.map((src, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={src} alt="" style={{ width: 68, height: 68, borderRadius: 8, objectFit: 'cover', border: '2px solid #ece8e2' }} />
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

// ── Add Trip Modal ────────────────────────────────────────────
function AddTripModal({ onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('✈️')
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={s.overlay}>
      <div style={s.modal}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          New Trip <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9a9088' }}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={s.label}>Trip Name</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Japan 2026" style={{ ...s.input, resize: 'none' }} autoFocus />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={s.label}>Pick an emoji</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{ background: emoji === e ? '#fef3ee' : '#f7f3ee', border: `2px solid ${emoji === e ? '#b85c3a' : 'transparent'}`, borderRadius: 8, width: 40, height: 40, fontSize: 20, cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { if (label.trim()) { onAdd({ label: label.trim(), emoji }); onClose() } }}
          disabled={!label.trim()} style={{ ...s.submitBtn, opacity: label.trim() ? 1 : 0.5 }}>
          Add Trip
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteConfirmModal({ onClose, onConfirm, loading }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ ...s.overlay, zIndex: 450 }}>
      <div style={{ ...s.modal, padding: '28px 24px 36px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 8 }}>Delete this moment?</div>
        <div style={{ fontSize: 14, color: '#6b6258', marginBottom: 24 }}>This will permanently remove the moment and all its photos.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: '#f7f3ee', border: '1px solid #ece8e2', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, background: '#cc4444', color: '#fff', border: 'none', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [trips, setTrips] = useState(DEFAULT_TRIPS)
  const [activeSlug, setActiveSlug] = useState('today')
  const [showAddMoment, setShowAddMoment] = useState(false)
  const [showAddTrip, setShowAddTrip] = useState(false)
  const [menuMoment, setMenuMoment] = useState(null)
  const [deleteMoment, setDeleteMoment] = useState(null)
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const activeTrip = trips.find(t => t.slug === activeSlug)
  const { moments, loading, addMoment, refetch } = useMoments(activeTrip?.id ?? null)

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

  async function handleReact(momentId, emoji) {
    if (!user) return
    const m = moments.find(x => x.id === momentId)
    const existing = m?.reactions?.find(r => r.user_id === user.id && r.emoji === emoji)
    if (existing) {
      await supabase.from('reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('reactions').insert({ moment_id: momentId, user_id: user.id, emoji })
    }
    await refetch()
  }

  async function handleAddMoment(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id })
      setShowAddMoment(false)
      showToast('Moment posted! ✨')
    } catch(e) { showToast('Error: ' + e.message) }
    finally { setPosting(false) }
  }

  async function handleAddTrip({ label, emoji }) {
    const { data, error } = await supabase.from('trips').insert({ user_id: user.id, name: label, is_public: true }).select().single()
    if (error) { showToast('Failed to create trip'); return }
    const slug = label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    setTrips(t => [...t, { id: data.id, slug, label, emoji }])
    setActiveSlug(slug)
    showToast(`${emoji} ${label} added!`)
  }

  async function handleDelete() {
    if (!deleteMoment) return
    setDeleting(true)
    try {
      for (const img of deleteMoment.moment_images ?? []) {
        const path = img.url.split('/moment-images/')[1]
        if (path) await supabase.storage.from('moment-images').remove([decodeURIComponent(path)])
      }
      await supabase.from('moments').delete().eq('id', deleteMoment.id)
      setDeleteMoment(null)
      await refetch()
      showToast('Moment deleted')
    } catch(e) { showToast('Delete failed') }
    finally { setDeleting(false) }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  return (
    <div style={s.page}>
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

      <div style={s.tabs}>
        {[...trips, UPCOMING_TAB].map(tab => (
          <button key={tab.slug} onClick={() => setActiveSlug(tab.slug)} style={s.tab(activeSlug === tab.slug)}>
            {tab.emoji} {tab.label}
          </button>
        ))}
        {user && <button onClick={() => setShowAddTrip(true)} style={s.addTabBtn} title="Add trip">＋</button>}
      </div>

      {activeSlug === 'upcoming' ? (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginBottom: 8 }}>More trips coming</div>
          <div style={{ color: '#9a9088', fontSize: 14, marginBottom: 32 }}>Future adventures will appear here.</div>
          {user && <button onClick={() => setShowAddTrip(true)} style={{ background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>+ Add a Trip</button>}
        </div>
      ) : (
        <div style={s.feed}>
          {/* Trip Hero */}
          {activeSlug === 'today' ? (
            <div style={{ textAlign: 'center', padding: '20px 0 8px' }}>
              <div style={{ fontSize: 12, color: '#9a9088', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{format(new Date(), 'EEEE, MMMM d')}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, marginTop: 4 }}>Today's Moments</div>
            </div>
          ) : activeTrip?.cover ? (
            <div style={{ position: 'relative', height: 180, overflow: 'hidden', marginBottom: 8 }}>
              <img src={activeTrip.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6))', display: 'flex', alignItems: 'flex-end', padding: 16 }}>
                <div style={{ color: '#fff' }}>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700 }}>{activeTrip.emoji} {activeTrip.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{visibleMoments.length} moments</div>
                </div>
                {user && (
                  <label style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#fff', cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
                    📷 Change cover
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => setTrips(ts => ts.map(t => t.slug === activeSlug ? { ...t, cover: ev.target.result } : t))
                      reader.readAsDataURL(file)
                    }} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 22 }}>{activeTrip?.emoji} {activeTrip?.label}</div>
              {user && (
                <label style={{ background: '#f7f3ee', border: '1px solid #ece8e2', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#6b6258', cursor: 'pointer' }}>
                  📷 Add cover
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
                    const file = e.target.files[0]
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = ev => setTrips(ts => ts.map(t => t.slug === activeSlug ? { ...t, cover: ev.target.result } : t))
                    reader.readAsDataURL(file)
                  }} />
                </label>
              )}
            </div>
          )}
          {loading ? (
            <div style={{ textAlign: 'center', color: '#9a9088', padding: 60 }}>Loading…</div>
          ) : visibleMoments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>{activeTrip?.emoji ?? '✈️'}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 18, marginBottom: 6 }}>{activeSlug === 'today' ? 'Nothing posted today yet' : 'No moments yet'}</div>
              <div style={{ color: '#9a9088', fontSize: 13 }}>{user ? 'Tap + to post your first moment' : 'Sign in to start posting'}</div>
              {!user && <button onClick={signInWithGoogle} style={{ marginTop: 16, background: '#b85c3a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Sign in with Google</button>}
            </div>
          ) : (
            days.map(day => (
              <div key={day}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '24px 0 12px' }}>
                  <div style={s.dayBadge}>{day.split(' ')[1]}</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 11, color: '#9a9088', marginLeft: 'auto' }}>{grouped[day].length} moment{grouped[day].length !== 1 ? 's' : ''}</div>
                </div>
                {grouped[day].map(m => (
                  <MomentCard key={m.id} moment={m} user={user} onReact={handleReact} onMenuOpen={setMenuMoment} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {user && activeSlug !== 'upcoming' && (
        <button onClick={() => setShowAddMoment(true)} style={s.fab}>＋</button>
      )}

      {showAddMoment && <AddMomentModal onClose={() => setShowAddMoment(false)} onAdd={handleAddMoment} loading={posting} />}
      {showAddTrip && <AddTripModal onClose={() => setShowAddTrip(false)} onAdd={handleAddTrip} />}
      {menuMoment && (
        <MomentMenu moment={menuMoment} user={user}
          onDelete={m => { setMenuMoment(null); setDeleteMoment(m) }}
          onClose={() => setMenuMoment(null)} />
      )}
      {deleteMoment && <DeleteConfirmModal onClose={() => setDeleteMoment(null)} onConfirm={handleDelete} loading={deleting} />}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  )
}
