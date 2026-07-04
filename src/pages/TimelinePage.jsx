import { useState, useMemo, useRef, useEffect } from 'react'
import { DayRecap } from '../components/DayRecap'
import { TripBook } from '../components/TripBook'
import { format, parseISO, isToday } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'

// ── Constants ─────────────────────────────────────────────────
const ADMIN_EMAIL = 'umemir@gmail.com'
const ADMIN_WHATSAPP = '919797014586'

const DEFAULT_TRIPS = [
  { id: '6e7696ea-b754-49a3-ac42-213bc48f459e', slug: 'today',  label: 'Today',        emoji: '📍', fixed: true },
  { id: 'd93cebae-a4c1-4f71-842c-88410af4450a', slug: 'turkey', label: 'Turkey',       emoji: '🇹🇷' },
  { id: 'ff91d8b7-516c-4a87-9bdf-5bac2b398f93', slug: 'saudi',  label: 'Saudi Arabia', emoji: '🇸🇦' },
]
const UPCOMING_TAB = { slug: 'upcoming', label: 'Upcoming', emoji: '🗓️', fixed: true }
const REACTIONS = ['❤️','😍','🔥','😂','😮','👏','🙌','💯']
const QUICK_REACTIONS = ['❤️','😍','🔥','😂']
const EMOJI_OPTIONS = ['✈️','🌍','🏔️','🏖️','🏙️','🗺️','🎒','🚂','🛳️','🏕️','🍜','☕','🎭','📸','🌅','⛩️','🕌','🏛️','🌴','❄️']

// ── Design tokens ─────────────────────────────────────────────
const C = {
  night:    '#0d1117',
  parchment:'#f2ead8',
  amber:    '#e8a838',
  rust:     '#c4603a',
  sage:     '#7a9e7e',
  ink:      '#1c2333',
  mist:     '#e8e0cc',
  ghost:    '#f8f4ec',
  dim:      '#8a8070',
}

const fonts = {
  display: "'Cormorant Garamond', Georgia, serif",
  ui:      "'DM Sans', Inter, sans-serif",
}

// ── Inject Google Fonts ───────────────────────────────────────
const fontLink = document.createElement('link')
fontLink.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap'
fontLink.rel = 'stylesheet'
document.head.appendChild(fontLink)

// ── Hooks ─────────────────────────────────────────────────────
async function loadTripCovers(trips, setTrips) {
  const ids = trips.filter(t => t.id).map(t => t.id)
  const { data } = await supabase.from('trips').select('id, cover_url').in('id', ids)
  if (!data) return
  setTrips(ts => ts.map(t => {
    const row = data.find(r => r.id === t.id)
    return row?.cover_url ? { ...t, cover: row.cover_url } : t
  }))
}

function useJoinRequest(trips, user, showToast) {
  const [joinState, setJoinState] = useState(null)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('join')
    if (!token || !user) return
    async function handleJoin() {
      const { data: trip } = await supabase.from('trips').select('id, name, invite_token').eq('invite_token', token).single()
      if (!trip) { showToast('Invalid invite link'); return }
      const { data: existing } = await supabase.from('trip_members').select('status').eq('trip_id', trip.id).eq('user_id', user.id).single()
      if (existing) { setJoinState({ trip, status: existing.status }); return }
      const allTripIds = DEFAULT_TRIPS.filter(t => !t.fixed).map(t => t.id)
      await supabase.from('trip_members').upsert(
        allTripIds.map(tripId => ({
          trip_id: tripId, user_id: user.id,
          user_name: user.user_metadata?.full_name ?? user.email,
          user_avatar: user.user_metadata?.avatar_url ?? null,
          user_email: user.email, status: 'pending'
        })), { onConflict: 'trip_id,user_id' }
      )
      try {
        const { data: notifData } = await supabase.functions.invoke('notify-join-request', {
          body: { tripName: trip.name, requesterName: user.user_metadata?.full_name ?? user.email, requesterEmail: user.email, adminEmail: ADMIN_EMAIL }
        })
        if (notifData && !notifData.emailOk) {
          const waText = encodeURIComponent(`📸 Wanderlog: ${user.user_metadata?.full_name ?? user.email} (${user.email}) wants to join your *${trip.name}* trip. Open the app to approve: https://wanderlog-one.vercel.app`)
          window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${waText}`, '_blank')
        }
      } catch {}
      setJoinState({ trip, status: 'pending' })
      window.history.replaceState({}, '', '/')
    }
    handleJoin()
  }, [user])
  return joinState
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [index, setIndex] = useState(startIndex)
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, images.length - 1))
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [images.length, onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.97)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      {images.length > 1 && <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: fonts.ui, letterSpacing: '0.1em' }}>{index + 1} / {images.length}</div>}
      {index > 0 && <button onClick={e => { e.stopPropagation(); setIndex(i => i - 1) }} style={{ position: 'absolute', left: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
      <img onClick={e => e.stopPropagation()} src={images[index].url} alt="" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 4 }} />
      {index < images.length - 1 && <button onClick={e => { e.stopPropagation(); setIndex(i => i + 1) }} style={{ position: 'absolute', right: 20, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
      {images.length > 1 && (
        <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
          {images.map((_, i) => <div key={i} onClick={e => { e.stopPropagation(); setIndex(i) }} style={{ width: i === index ? 20 : 6, height: 6, borderRadius: 3, background: i === index ? C.amber : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'all 0.2s' }} />)}
        </div>
      )}
    </div>
  )
}

// ── Photo Grid ────────────────────────────────────────────────
function isVideo(url) {
  return url && /\.(mp4|mov|webm|ogg|avi)$/i.test(url.split('?')[0])
}

function PhotoGrid({ images, onPhotoClick }) {
  if (!images?.length) return null
  const shown = images.slice(0, 4)
  const extra = images.length - 4
  const grid = shown.length === 1 ? { gridTemplateColumns: '1fr', height: 300 }
    : shown.length === 2 ? { gridTemplateColumns: '1fr 1fr', height: 220 }
    : { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 320 }
  return (
    <div style={{ display: 'grid', gap: 2, margin: '0 -20px', ...grid }}>
      {shown.map((img, i) => (
        <div key={img.id ?? i} onClick={() => onPhotoClick(i)}
          style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', ...(shown.length === 3 && i === 0 ? { gridRow: '1 / 3' } : {}) }}>
          {isVideo(img.url) ? (
            <video src={img.url} muted playsInline loop
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.4s ease' }}
              onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
              onMouseLeave={e => e.target.style.transform = 'scale(1)'} />
          )}
          {isVideo(img.url) && (
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.55)', borderRadius: 8, padding: '3px 8px', fontSize: 11, color: '#fff', fontFamily: fonts.ui, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              ▶ VIDEO
            </div>
          )}
          {i === 3 && extra > 0 && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,17,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontFamily: fonts.display, fontWeight: 600 }}>+{extra}</div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ src, name, size = 32 }) {
  if (src) return <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg, ${C.rust}, ${C.amber})`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.38, fontWeight: 600, fontFamily: fonts.ui, flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

// ── Reaction Bar ──────────────────────────────────────────────
function ReactionBar({ moment, user, onReact }) {
  const [showPicker, setShowPicker] = useState(false)
  const reactions = moment.reactions ?? []
  const grouped = REACTIONS.reduce((acc, emoji) => {
    const count = reactions.filter(r => r.emoji === emoji).length
    const mine = reactions.some(r => r.emoji === emoji && r.user_id === user?.id)
    if (count > 0) acc.push({ emoji, count, mine })
    return acc
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
      {QUICK_REACTIONS.map(emoji => {
        const existing = grouped.find(r => r.emoji === emoji)
        const mine = existing?.mine ?? false
        const count = existing?.count ?? 0
        return (
          <button key={emoji} onClick={() => user && onReact(moment.id, emoji)} disabled={!user}
            style={{ background: mine ? `${C.amber}22` : C.ghost, border: `1.5px solid ${mine ? C.amber : C.mist}`, borderRadius: 100, padding: '4px 10px', fontSize: 14, cursor: user ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s', opacity: user ? 1 : 0.45 }}>
            {emoji}{count > 0 && <span style={{ fontSize: 11, fontWeight: 600, fontFamily: fonts.ui, color: mine ? C.rust : C.dim }}>{count}</span>}
          </button>
        )
      })}
      {user && (
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowPicker(p => !p)} style={{ background: C.ghost, border: `1.5px solid ${C.mist}`, borderRadius: 100, padding: '4px 10px', fontSize: 14, cursor: 'pointer', color: C.dim }}>＋</button>
          {showPicker && (
            <div style={{ position: 'absolute', bottom: 36, left: 0, background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', padding: 10, display: 'flex', gap: 4, flexWrap: 'wrap', width: 220, zIndex: 200 }}>
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => { onReact(moment.id, emoji); setShowPicker(false) }}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', borderRadius: 8, padding: 4, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.target.style.background = C.ghost}
                  onMouseLeave={e => e.target.style.background = 'none'}>
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {grouped.filter(r => !QUICK_REACTIONS.includes(r.emoji)).map(r => (
        <button key={r.emoji} onClick={() => user && onReact(moment.id, r.emoji)}
          style={{ background: r.mine ? `${C.amber}22` : C.ghost, border: `1.5px solid ${r.mine ? C.amber : C.mist}`, borderRadius: 100, padding: '4px 10px', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          {r.emoji}<span style={{ fontSize: 11, fontWeight: 600, fontFamily: fonts.ui, color: C.dim }}>{r.count}</span>
        </button>
      ))}
    </div>
  )
}

// ── Comments ──────────────────────────────────────────────────
function Comments({ momentId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    supabase.from('comments').select('*').eq('moment_id', momentId).order('created_at').then(({ data }) => setComments(data ?? []))
  }, [momentId])

  async function submit() {
    if (!text.trim() || !user) return
    setLoading(true)
    const { data } = await supabase.from('comments').insert({ moment_id: momentId, user_id: user.id, text: text.trim(), user_name: user.user_metadata?.full_name ?? user.email }).select().single()
    if (data) { setComments(c => [...c, data]); setText(''); setExpanded(true) }
    setLoading(false)
  }

  const visible = expanded ? comments : comments.slice(-1)

  return (
    <div>
      {comments.length > 1 && !expanded && (
        <button onClick={() => setExpanded(true)} style={{ background: 'none', border: 'none', fontSize: 12, fontFamily: fonts.ui, color: C.dim, cursor: 'pointer', padding: '0 0 6px', textDecoration: 'underline' }}>
          View all {comments.length} comments
        </button>
      )}
      {visible.map(c => (
        <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `linear-gradient(135deg, ${C.sage}, ${C.amber})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0, fontFamily: fonts.ui }}>
            {c.user_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 12, fontFamily: fonts.ui, color: C.ink }}>{c.user_name?.split(' ')[0] ?? 'User'} </span>
            <span style={{ fontSize: 13, fontFamily: fonts.ui, color: '#3a3530' }}>{c.text}</span>
          </div>
        </div>
      ))}
      {user ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Avatar src={user.user_metadata?.avatar_url} name={user.email} size={24} />
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Add a comment…"
            style={{ flex: 1, border: 'none', borderBottom: `1.5px solid ${C.mist}`, background: 'transparent', padding: '5px 0', fontSize: 13, fontFamily: fonts.ui, outline: 'none', color: C.ink }} />
          {text.trim() && (
            <button onClick={submit} disabled={loading} style={{ background: 'none', border: 'none', color: C.rust, fontWeight: 600, fontSize: 13, fontFamily: fonts.ui, cursor: 'pointer' }}>Post</button>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, fontFamily: fonts.ui, color: C.dim, fontStyle: 'italic', margin: '4px 0 0' }}>Sign in to comment</p>
      )}
    </div>
  )
}

// ── Moment Card ───────────────────────────────────────────────
function MomentCard({ moment, user, onReact, onMenuOpen }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const time = format(parseISO(moment.created_at), 'h:mm a')
  const displayName = moment.user_name ?? 'Traveller'
  const images = moment.moment_images ?? []

  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 2px 20px rgba(28,35,51,0.07), 0 0 0 1px rgba(28,35,51,0.04)', marginBottom: 16, overflow: 'hidden', position: 'relative' }}>
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px 0' }}>
        <Avatar src={moment.user_avatar} name={displayName} size={34} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: fonts.ui, color: C.ink, letterSpacing: '-0.01em' }}>{displayName}</div>
          <div style={{ fontSize: 11, fontFamily: fonts.ui, color: C.dim, marginTop: 1 }}>{time}</div>
        </div>
        {user && (
          <button onClick={() => onMenuOpen(moment)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.dim, padding: '4px 8px', borderRadius: 8, fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center' }}>
            •••
          </button>
        )}
      </div>

      {/* Caption */}
      {moment.caption && (
        <p style={{ margin: '10px 20px 12px', fontSize: 15, lineHeight: 1.6, fontFamily: fonts.display, fontStyle: 'italic', color: '#2a2420', fontWeight: 400 }}>
          {moment.caption}
        </p>
      )}

      {/* Location */}
      {moment.location && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: moment.caption ? '-4px 20px 12px' : '10px 20px 12px', fontSize: 11, fontFamily: fonts.ui, color: C.dim, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          <span style={{ fontSize: 13 }}>📍</span> {moment.location}
        </div>
      )}

      {/* Photos */}
      <PhotoGrid images={images} onPhotoClick={setLightboxIndex} />
      {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />}

      {/* Reactions + Comments */}
      <div style={{ padding: '12px 20px 16px' }}>
        <ReactionBar moment={moment} user={user} onReact={onReact} />
        <div style={{ height: 1, background: C.mist, margin: '12px 0' }} />
        <Comments momentId={moment.id} user={user} />
      </div>
    </div>
  )
}

// ── Moment Menu ───────────────────────────────────────────────
function MomentMenu({ moment, user, onDelete, onClose }) {
  const isOwner = user?.id === moment.user_id
  const images = moment.moment_images ?? []
  const [copied, setCopied] = useState(false)

  async function savePhoto() {
    try {
      const res = await fetch(images[0].url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'wanderlog.jpg'
      a.click()
    } catch {}
    onClose()
  }

  function shareWhatsApp() {
    const text = encodeURIComponent('Check out my trip on Wanderlog! ' + window.location.href)
    window.open('https://wa.me/?text=' + text, '_blank')
    onClose()
  }

  async function copyLink() {
    await navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(onClose, 800)
  }

  const items = [
    { label: 'WhatsApp', icon: '↗', action: shareWhatsApp },
    { label: copied ? 'Copied!' : 'Copy link', icon: copied ? '✓' : '⌘', action: copyLink },
    ...(images.length > 0 ? [{ label: 'Save photo', icon: '↓', action: savePhoto }] : []),
    ...(isOwner ? [{ label: 'Delete', icon: '×', action: () => { onDelete(moment); onClose() }, danger: true }] : []),
  ]

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 32px' }}>
      <div style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Action pills */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {items.map(item => (
            <button key={item.label} onClick={item.action}
              style={{
                background: item.danger ? '#e53e3e' : 'rgba(255,255,255,0.96)',
                color: item.danger ? '#fff' : C.ink,
                border: 'none', borderRadius: 100,
                padding: '10px 20px',
                fontSize: 13, fontFamily: fonts.ui, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(12px)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}>
              <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        {/* Cancel */}
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.85)', color: C.dim, border: 'none', borderRadius: 100, padding: '11px', fontSize: 13, fontFamily: fonts.ui, fontWeight: 500, cursor: 'pointer', backdropFilter: 'blur(12px)', boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Add Moment Modal ──────────────────────────────────────────
function AddMomentModal({ onClose, onAdd, loading, initialFiles = [] }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([]) // [{ type: 'image'|'video', src: string }]
  const fileRef = useRef()

  // Load initialFiles passed from camera/gallery FAB
  useEffect(() => {
    if (!initialFiles.length) return
    const newFiles = []
    const newPreviews = []
    let loaded = 0
    initialFiles.forEach((file, i) => {
      newFiles.push(file)
      if (file.type.startsWith('video/')) {
        newPreviews[i] = { type: 'video', src: URL.createObjectURL(file) }
        loaded++
        if (loaded === initialFiles.length) {
          setFiles(newFiles)
          setPreviews(newPreviews)
        }
      } else {
        const r = new FileReader()
        r.onload = ev => {
          newPreviews[i] = { type: 'image', src: ev.target.result }
          loaded++
          if (loaded === initialFiles.length) {
            setFiles(newFiles)
            setPreviews([...newPreviews])
          }
        }
        r.readAsDataURL(file)
      }
    })
  }, [])

  // Auto-GPS on open
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json())
        .then(d => {
          const city = d.address?.city || d.address?.town || d.address?.village || ''
          const country = d.address?.country || ''
          if (city || country) setLocation([city, country].filter(Boolean).join(', '))
        }).catch(() => {})
    }, () => {})
  }, [])

  function addFiles(fileList) {
    Array.from(fileList).forEach(file => {
      setFiles(f => [...f, file])
      if (file.type.startsWith('video/')) {
        setPreviews(p => [...p, { type: 'video', src: URL.createObjectURL(file) }])
      } else {
        const r = new FileReader()
        r.onload = ev => setPreviews(p => [...p, { type: 'image', src: ev.target.result }])
        r.readAsDataURL(file)
      }
    })
  }

  function removeFile(i) {
    setFiles(f => f.filter((_, idx) => idx !== i))
    setPreviews(p => p.filter((_, idx) => idx !== i))
  }

  function getLocation() {
    setGpsLoading(true)
    navigator.geolocation?.getCurrentPosition(pos => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
        .then(r => r.json())
        .then(d => {
          const city = d.address?.city || d.address?.town || d.address?.village || ''
          const country = d.address?.country || ''
          if (city || country) setLocation([city, country].filter(Boolean).join(', '))
        }).catch(() => {}).finally(() => setGpsLoading(false))
    }, () => setGpsLoading(false))
  }

  function handlePost() {
    onAdd({ caption: caption.trim(), location: location.trim(), latitude: coords?.lat, longitude: coords?.lng, imageFiles: files })
  }

  const fieldStyle = { width: '100%', background: 'transparent', border: 'none', borderBottom: `2px solid ${C.mist}`, padding: '8px 0', fontSize: 15, fontFamily: fonts.ui, color: C.ink, outline: 'none', resize: 'none' }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.7)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.parchment, borderRadius: '28px 28px 0 0', width: '100%', maxWidth: 560, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Handle */}
        <div style={{ width: 40, height: 4, background: C.mist, borderRadius: 2, margin: '14px auto 12px', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px 12px', flexShrink: 0 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 20, fontStyle: 'italic', color: C.ink }}>New moment</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.dim }}>✕</button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>

          {/* Photo/video previews */}
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {previews.map((item, i) => (
                <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                  {item.type === 'video'
                    ? <video src={item.src} muted playsInline style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover', display: 'block', background: '#000' }} />
                    : <img src={item.src} alt="" style={{ width: 100, height: 100, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
                  }
                  {item.type === 'video' && (
                    <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '2px 5px', fontSize: 9, color: '#fff', fontFamily: fonts.ui, fontWeight: 700 }}>▶</div>
                  )}
                  <button onClick={() => removeFile(i)} style={{ position: 'absolute', top: -6, right: -6, background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✕</button>
                </div>
              ))}
              {/* Add more */}
              <label style={{ width: 100, height: 100, borderRadius: 12, border: `2px dashed ${C.mist}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: C.dim, fontSize: 24, background: 'rgba(255,255,255,0.4)' }}>
                ＋
                <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
              </label>
            </div>
          )}

          {/* Caption */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, display: 'block', marginBottom: 4 }}>Caption</label>
            <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)} placeholder="What happened?" style={fieldStyle} />
          </div>

          {/* Location */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, display: 'block', marginBottom: 4 }}>Location</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Where are you?" style={{ ...fieldStyle, flex: 1 }} />
              <button onClick={getLocation} disabled={gpsLoading}
                style={{ background: coords ? `${C.sage}22` : 'none', border: `1px solid ${coords ? C.sage : C.mist}`, borderRadius: 8, padding: '5px 10px', fontSize: 11, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer', color: coords ? C.sage : C.dim, flexShrink: 0 }}>
                {gpsLoading ? '…' : coords ? '✓ GPS' : 'Auto'}
              </button>
            </div>
          </div>

          {/* Upload zone — only shown when no previews */}
          {previews.length === 0 && (
            <div onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${C.mist}`, borderRadius: 16, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📎</div>
              <div style={{ fontSize: 13, fontFamily: fonts.ui, color: C.dim }}>Add photos or videos</div>
            </div>
          )}
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display: 'none' }} onChange={e => addFiles(e.target.files)} />
        </div>

        {/* Post button — fixed at bottom */}
        <div style={{ padding: '12px 20px 36px', flexShrink: 0, borderTop: `1px solid ${C.mist}` }}>
          <button onClick={handlePost} disabled={loading}
            style={{ width: '100%', background: loading ? C.dim : C.night, color: loading ? 'rgba(255,255,255,0.5)' : C.amber, border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 700, fontFamily: fonts.ui, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.01em' }}>
            {loading ? 'Posting…' : 'Post moment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Trip Modal ────────────────────────────────────────────
function AddTripModal({ onClose, onAdd }) {
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('✈️')
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.parchment, borderRadius: '28px 28px 0 0', padding: '20px 20px 36px', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.mist, borderRadius: 2, margin: '-14px auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 22, fontStyle: 'italic', color: C.ink }}>New trip</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.dim }}>✕</button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, display: 'block', marginBottom: 4 }}>Trip name</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Japan 2026" autoFocus
            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: `2px solid ${C.mist}`, padding: '8px 0', fontSize: 15, fontFamily: fonts.ui, color: C.ink, outline: 'none' }} />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, display: 'block', marginBottom: 8 }}>Vibe</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {EMOJI_OPTIONS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{ background: emoji === e ? C.night : 'rgba(255,255,255,0.6)', border: `2px solid ${emoji === e ? C.night : 'transparent'}`, borderRadius: 12, width: 42, height: 42, fontSize: 20, cursor: 'pointer', transition: 'all 0.15s' }}>
                {e}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { if (label.trim()) { onAdd({ label: label.trim(), emoji }); onClose() } }}
          disabled={!label.trim()}
          style={{ width: '100%', background: label.trim() ? C.night : C.dim, color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 15, fontWeight: 600, fontFamily: fonts.ui, cursor: label.trim() ? 'pointer' : 'not-allowed' }}>
          Create trip
        </button>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteConfirmModal({ onClose, onConfirm, loading }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.6)', zIndex: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <div style={{ fontFamily: fonts.display, fontSize: 22, fontStyle: 'italic', marginBottom: 8, color: C.ink }}>Delete this moment?</div>
        <div style={{ fontSize: 14, fontFamily: fonts.ui, color: C.dim, lineHeight: 1.6, marginBottom: 28 }}>This permanently removes the moment and all its photos.</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: C.ghost, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 500, fontFamily: fonts.ui, cursor: 'pointer', color: C.ink }}>Keep it</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 600, fontFamily: fonts.ui, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Members Panel ─────────────────────────────────────────────
function MembersPanel({ trips, user, onClose }) {
  const [members, setMembers] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(trips.filter(t => !t.fixed)[0]?.id ?? null)
  const [loading, setLoading] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    if (!selectedTrip) return
    supabase.from('trip_members').select('*').eq('trip_id', selectedTrip).order('requested_at').then(({ data }) => setMembers(data ?? []))
  }, [selectedTrip])

  async function updateStatus(memberId, status) {
    setLoading(true)
    const member = members.find(m => m.id === memberId)
    if (member) {
      await supabase.from('trip_members').update({ status }).eq('user_id', member.user_id)
      setMembers(ms => ms.map(m => m.user_id === member.user_id ? { ...m, status } : m))
    }
    setLoading(false)
  }

  async function copyInviteLink(tripId) {
    const { data } = await supabase.from('trips').select('invite_token').eq('id', tripId).single()
    if (data?.invite_token) {
      const link = `${window.location.origin}?join=${data.invite_token}`
      try {
        await navigator.clipboard.writeText(link)
        setCopyMsg('Copied! Send this link to invite someone.')
      } catch {
        setCopyMsg(link)
      }
    }
  }

  const pending  = members.filter(m => m.status === 'pending')
  const approved = members.filter(m => m.status === 'approved')

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.parchment, borderRadius: '28px 28px 0 0', padding: '24px 24px 40px', width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: C.mist, borderRadius: 2, margin: '-10px auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 22, fontStyle: 'italic', color: C.ink }}>Trip members</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.dim }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto' }}>
          {trips.filter(t => !t.fixed).map(t => (
            <button key={t.id} onClick={() => { setSelectedTrip(t.id); setCopyMsg('') }}
              style={{ background: selectedTrip === t.id ? C.night : 'rgba(255,255,255,0.6)', color: selectedTrip === t.id ? '#fff' : C.ink, border: 'none', borderRadius: 100, padding: '7px 16px', fontSize: 13, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {selectedTrip && (
          <>
            <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: '14px 18px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontFamily: fonts.ui, fontWeight: 600, color: C.ink, marginBottom: 3 }}>Invite link</div>
              <div style={{ fontSize: 12, fontFamily: fonts.ui, color: C.dim, marginBottom: 12 }}>Anyone with this link can request to join. You approve or reject.</div>
              <button onClick={() => copyInviteLink(selectedTrip)}
                style={{ background: C.night, color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer' }}>
                Copy invite link 🔗
              </button>
              {copyMsg && <div style={{ marginTop: 10, fontSize: 12, fontFamily: fonts.ui, color: C.sage, fontWeight: 500, wordBreak: 'break-all' }}>{copyMsg}</div>}
            </div>

            {pending.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 10 }}>Pending ({pending.length})</div>
                {pending.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.mist}` }}>
                    <Avatar src={m.user_avatar} name={m.user_name} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontFamily: fonts.ui, fontWeight: 600, color: C.ink }}>{m.user_name}</div>
                      <div style={{ fontSize: 11, fontFamily: fonts.ui, color: C.dim }}>{m.user_email}</div>
                    </div>
                    <button onClick={() => updateStatus(m.id, 'approved')} disabled={loading}
                      style={{ background: C.sage, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer', marginRight: 6 }}>
                      Approve
                    </button>
                    <button onClick={() => updateStatus(m.id, 'rejected')} disabled={loading}
                      style={{ background: 'rgba(229,62,62,0.1)', color: '#e53e3e', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer' }}>
                      Reject
                    </button>
                  </div>
                ))}
              </div>
            )}

            {approved.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.dim, marginBottom: 10 }}>Members ({approved.length})</div>
                {approved.map(m => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: `1px solid ${C.mist}` }}>
                    <Avatar src={m.user_avatar} name={m.user_name} size={38} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontFamily: fonts.ui, fontWeight: 600, color: C.ink }}>{m.user_name}</div>
                      <div style={{ fontSize: 11, fontFamily: fonts.ui, color: C.dim }}>{m.user_email}</div>
                    </div>
                    <div style={{ fontSize: 11, fontFamily: fonts.ui, background: `${C.sage}22`, color: C.sage, borderRadius: 100, padding: '4px 12px', fontWeight: 600 }}>✓ Member</div>
                  </div>
                ))}
              </div>
            )}

            {pending.length === 0 && approved.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: C.dim, fontSize: 14, fontFamily: fonts.ui, fontStyle: 'italic' }}>
                No members yet — share the invite link!
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Join Banner ───────────────────────────────────────────────
function JoinBanner({ joinState, onClose }) {
  if (!joinState) return null
  const config = {
    pending:  { icon: '⏳', title: 'Request sent!', sub: `Your request to join "${joinState.trip.name}" is pending. You can post once approved.` },
    approved: { icon: '✅', title: "You're in!", sub: `You can now post to "${joinState.trip.name}".` },
    rejected: { icon: '❌', title: 'Not approved', sub: `Your request to join "${joinState.trip.name}" was not approved.` },
  }
  const c = config[joinState.status] ?? config.pending
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.6)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', width: '100%', maxWidth: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>{c.icon}</div>
        <div style={{ fontFamily: fonts.display, fontSize: 26, fontStyle: 'italic', marginBottom: 10, color: C.ink }}>{c.title}</div>
        <div style={{ fontSize: 14, fontFamily: fonts.ui, color: C.dim, lineHeight: 1.6, marginBottom: 28 }}>{c.sub}</div>
        <button onClick={onClose} style={{ background: C.night, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 14, fontWeight: 600, fontFamily: fonts.ui, cursor: 'pointer' }}>Got it</button>
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
  const [showMembers, setShowMembers] = useState(false)
  const [menuMoment, setMenuMoment] = useState(null)
  const [deleteMoment, setDeleteMoment] = useState(null)
  const [posting, setPosting] = useState(false)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [recapDay, setRecapDay] = useState(null)
  const [showTripBook, setShowTripBook] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const joinState = useJoinRequest(trips, user, showToast)

  useEffect(() => { loadTripCovers(trips, setTrips) }, [])

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
    if (existing) await supabase.from('reactions').delete().eq('id', existing.id)
    else await supabase.from('reactions').insert({ moment_id: momentId, user_id: user.id, emoji })
    await refetch()
  }

  async function handleAddMoment(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id, userName: user.user_metadata?.full_name ?? user.email, userAvatar: user.user_metadata?.avatar_url ?? null, latitude: payload.latitude, longitude: payload.longitude })
      setShowAddMoment(false)
      showToast('Moment posted ✨')
    } catch(e) { console.error(e); showToast('Failed: ' + e.message) }
    finally { setPosting(false) }
  }

  async function handleAddTrip({ label, emoji }) {
    const { data, error } = await supabase.from('trips').insert({ user_id: user.id, name: label, is_public: true }).select().single()
    if (error) { showToast('Failed to create trip'); return }
    const slug = label.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    setTrips(t => [...t, { id: data.id, slug, label, emoji }])
    setActiveSlug(slug)
    showToast(`${emoji} ${label} created!`)
  }

  async function handleCoverUpload(e, slug) {
    const file = e.target.files[0]
    if (!file || !user) return
    const trip = trips.find(t => t.slug === slug)
    if (!trip) return
    const ext = file.name.split('.').pop()
    const path = `covers/${trip.id}.${ext}`
    const { error } = await supabase.storage.from('moment-images').upload(path, file, { upsert: true })
    if (error) { showToast('Cover upload failed'); return }
    const { data: { publicUrl } } = supabase.storage.from('moment-images').getPublicUrl(path)
    await supabase.from('trips').update({ cover_url: publicUrl }).eq('id', trip.id)
    setTrips(ts => ts.map(t => t.slug === slug ? { ...t, cover: publicUrl } : t))
    showToast('Cover updated 🖼️')
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
    } catch { showToast('Delete failed') }
    finally { setDeleting(false) }
  }

  const allTabs = [...trips, UPCOMING_TAB]

  return (
    <div style={{ fontFamily: fonts.ui, background: C.parchment, minHeight: '100vh', color: C.ink }}>

      {/* ── Header ── */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: C.night, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontFamily: fonts.display, fontStyle: 'italic', fontSize: 22, color: C.amber, letterSpacing: '-0.01em' }}>wanderlog</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {user ? (
            <>
              {user.email === ADMIN_EMAIL && (
                <button onClick={() => setShowMembers(true)}
                  style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontFamily: fonts.ui, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  👥 Members
                </button>
              )}
              <div onClick={() => {}} style={{ cursor: 'pointer' }}>
                <Avatar src={user.user_metadata?.avatar_url} name={user.email} size={30} />
              </div>
              <button onClick={signOut} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.5)', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontFamily: fonts.ui, cursor: 'pointer' }}>Out</button>
            </>
          ) : (
            <button onClick={signInWithGoogle} style={{ background: C.amber, color: C.night, border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontFamily: fonts.ui, fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em' }}>Sign in</button>
          )}
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ background: C.night, borderBottom: `1px solid rgba(255,255,255,0.06)`, display: 'flex', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}>
        {allTabs.map(tab => (
          <button key={tab.slug} onClick={() => setActiveSlug(tab.slug)}
            style={{ background: 'none', border: 'none', borderBottom: activeSlug === tab.slug ? `2px solid ${C.amber}` : '2px solid transparent', color: activeSlug === tab.slug ? '#fff' : 'rgba(255,255,255,0.4)', padding: '13px 18px', fontSize: 13, fontFamily: fonts.ui, fontWeight: activeSlug === tab.slug ? 600 : 400, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, letterSpacing: '-0.01em', transition: 'color 0.15s' }}>
            {tab.emoji} {tab.label}
          </button>
        ))}
        {user && (
          <button onClick={() => setShowAddTrip(true)}
            style={{ background: 'none', border: 'none', color: C.amber, padding: '13px 16px', fontSize: 18, cursor: 'pointer', flexShrink: 0, opacity: 0.8 }}>
            ＋
          </button>
        )}
      </div>

      {/* ── Upcoming ── */}
      {activeSlug === 'upcoming' && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '52px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🗺️</div>
          <div style={{ fontFamily: fonts.display, fontSize: 28, fontStyle: 'italic', marginBottom: 10, color: C.ink }}>More trips coming</div>
          <div style={{ fontSize: 14, fontFamily: fonts.ui, color: C.dim, lineHeight: 1.7, marginBottom: 36 }}>Future adventures will appear here.</div>
          {[{ name: 'Turkey', emoji: '🇹🇷' }, { name: 'Saudi Arabia', emoji: '🇸🇦' }].map(t => (
            <div key={t.name} style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', marginBottom: 10 }}>
              <span style={{ fontSize: 26 }}>{t.emoji}</span>
              <span style={{ fontWeight: 600, fontFamily: fonts.ui, fontSize: 15 }}>{t.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: fonts.ui, background: `${C.amber}22`, color: C.rust, borderRadius: 100, padding: '4px 12px', fontWeight: 600 }}>Soon</span>
            </div>
          ))}
          {user && <button onClick={() => setShowAddTrip(true)} style={{ marginTop: 24, background: C.night, color: '#fff', border: 'none', borderRadius: 14, padding: '13px 32px', fontSize: 14, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer' }}>+ Add a trip</button>}
        </div>
      )}

      {/* ── Feed ── */}
      {activeSlug !== 'upcoming' && (
        <div
          style={{ maxWidth: 560, margin: '0 auto', padding: '0 16px 100px' }}
          onTouchStart={e => { window._swipeX = e.touches[0].clientX }}
          onTouchEnd={e => {
            const diff = window._swipeX - e.changedTouches[0].clientX
            const allTabs = [...trips.map(t => t.slug), 'upcoming']
            const idx = allTabs.indexOf(activeSlug)
            if (diff > 60 && idx < allTabs.length - 1) setActiveSlug(allTabs[idx + 1])
            if (diff < -60 && idx > 0) setActiveSlug(allTabs[idx - 1])
          }}>

          {/* Trip Hero */}
          {activeSlug === 'today' ? (
            <div style={{ padding: '28px 4px 16px', borderBottom: `1px solid ${C.mist}`, marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.dim, marginBottom: 4 }}>{format(new Date(), 'EEEE, MMMM d')}</div>
              <div style={{ fontFamily: fonts.display, fontSize: 32, fontStyle: 'italic', color: C.ink, letterSpacing: '-0.01em' }}>Today's Moments</div>
            </div>
          ) : activeTrip?.cover ? (
            <div style={{ position: 'relative', height: 200, overflow: 'hidden', margin: '0 -16px 0', borderBottom: `1px solid ${C.mist}` }}>
              <img src={activeTrip.cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 30%, rgba(13,17,23,0.75))' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: fonts.display, fontSize: 28, fontStyle: 'italic', color: '#fff', letterSpacing: '-0.01em' }}>{activeTrip.emoji} {activeTrip.label}</div>
                  <div style={{ fontSize: 12, fontFamily: fonts.ui, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{visibleMoments.length} moments</div>
                </div>
                {user && (
                  <label style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontFamily: fonts.ui, color: '#fff', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
                    📷 Change
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(e, activeSlug)} />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '24px 4px 16px', borderBottom: `1px solid ${C.mist}`, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: fonts.display, fontSize: 30, fontStyle: 'italic', color: C.ink }}>{activeTrip?.emoji} {activeTrip?.label}</div>
              {user && (
                <label style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.mist}`, borderRadius: 10, padding: '7px 14px', fontSize: 12, fontFamily: fonts.ui, color: C.dim, cursor: 'pointer' }}>
                  📷 Add cover
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleCoverUpload(e, activeSlug)} />
                </label>
              )}
            </div>
          )}

          {/* Trip actions bar */}
          {activeSlug !== 'today' && visibleMoments.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 0', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {[
                { label: '📄 Trip book', action: () => setShowTripBook(true) },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action}
                  style={{ background: 'rgba(255,255,255,0.7)', border: `1px solid ${C.mist}`, borderRadius: 100, padding: '7px 16px', fontSize: 12, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', color: C.ink, flexShrink: 0 }}>
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          {/* Moments */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: C.dim, fontFamily: fonts.ui, fontStyle: 'italic' }}>Loading…</div>
          ) : visibleMoments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{activeTrip?.emoji ?? '✈️'}</div>
              <div style={{ fontFamily: fonts.display, fontSize: 26, fontStyle: 'italic', color: C.ink, marginBottom: 8 }}>
                {activeSlug === 'today' ? 'Nothing yet today' : 'No moments yet'}
              </div>
              <div style={{ fontSize: 14, fontFamily: fonts.ui, color: C.dim, lineHeight: 1.6 }}>
                {user ? 'Tap + to capture your first moment' : 'Sign in to start posting'}
              </div>
              {!user && <button onClick={signInWithGoogle} style={{ marginTop: 20, background: C.night, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontSize: 14, fontFamily: fonts.ui, fontWeight: 600, cursor: 'pointer' }}>Sign in with Google</button>}
            </div>
          ) : (
            days.map(day => (
              <div key={day} style={{ marginBottom: 8 }}>
                {/* Day stamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0 14px' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: C.night, color: C.amber, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.ui, lineHeight: 1 }}>{day.split(' ')[1]}</div>
                    <div style={{ fontSize: 8, fontFamily: fonts.ui, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7, marginTop: 2 }}>{day.split(' ')[0]}</div>
                  </div>
                  <div style={{ flex: 1, height: 1, background: C.mist }} />
                  <button onClick={() => setRecapDay(day)}
                    style={{ fontSize: 11, fontFamily: fonts.ui, color: C.rust, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 0', whiteSpace: 'nowrap' }}>
                    {grouped[day].length} moment{grouped[day].length !== 1 ? 's' : ''} · Recap ↗
                  </button>
                </div>
                {grouped[day].map(m => (
                  <MomentCard key={m.id} moment={m} user={user} onReact={handleReact} onMenuOpen={setMenuMoment} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── FAB — camera + gallery ── */}
      {user && activeSlug !== 'upcoming' && (
        <div style={{ position: 'fixed', bottom: 32, right: 24, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <label title="Gallery" style={{ width: 42, height: 42, borderRadius: '50%', background: C.night, border: `1.5px solid rgba(232,168,56,0.4)`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill={C.amber} stroke="none"/><polyline points="21 15 16 10 5 21"/>
            </svg>
            <input type="file" multiple accept="image/*,video/*" style={{ display: 'none' }}
              onChange={e => { const picked = Array.from(e.target.files); if (!picked.length) return; setGalleryFiles(picked); setShowAddMoment(true) }} />
          </label>
          <label title="Camera" style={{ width: 62, height: 62, borderRadius: '50%', background: C.night, border: `2px solid ${C.amber}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: `0 4px 28px rgba(0,0,0,0.4), 0 0 0 5px ${C.parchment}` }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
            <input type="file" accept="image/*,video/*" capture="environment" style={{ display: 'none' }}
              onChange={e => { const picked = Array.from(e.target.files); if (!picked.length) return; setGalleryFiles(picked); setShowAddMoment(true) }} />
          </label>
        </div>
      )}

      {/* ── Modals ── */}
      {showAddMoment && <AddMomentModal onClose={() => { setShowAddMoment(false); setGalleryFiles([]) }} onAdd={handleAddMoment} loading={posting} initialFiles={galleryFiles} key={galleryFiles.length + '-' + showAddMoment} />}
      {showAddTrip && <AddTripModal onClose={() => setShowAddTrip(false)} onAdd={handleAddTrip} />}
      {showMembers && <MembersPanel trips={trips} user={user} onClose={() => setShowMembers(false)} />}
      {menuMoment && <MomentMenu moment={menuMoment} user={user} onDelete={m => { setMenuMoment(null); setDeleteMoment(m) }} onClose={() => setMenuMoment(null)} />}
      {deleteMoment && <DeleteConfirmModal onClose={() => setDeleteMoment(null)} onConfirm={handleDelete} loading={deleting} />}
      {recapDay && (
        <DayRecap
          day={recapDay}
          moments={grouped[recapDay] ?? []}
          tripName={activeTrip?.label ?? 'Trip'}
          tripEmoji={activeTrip?.emoji ?? '✈️'}
          onClose={() => setRecapDay(null)}
        />
      )}
      {showTripBook && (
        <TripBook
          moments={visibleMoments}
          tripName={activeTrip?.label ?? 'Trip'}
          tripEmoji={activeTrip?.emoji ?? '✈️'}
          onClose={() => setShowTripBook(false)}
        />
      )}
      {joinState && <JoinBanner joinState={joinState} onClose={() => window.location.reload()} />}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position: 'fixed', top: 68, left: '50%', transform: 'translateX(-50%)', background: C.night, color: '#fff', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontFamily: fonts.ui, fontWeight: 500, zIndex: 500, whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', border: `1px solid rgba(255,255,255,0.08)` }}>
          {toast}
        </div>
      )}
    </div>
  )
}
