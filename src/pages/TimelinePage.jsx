import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { MomentCard } from '../components/MomentCard'
import { AddMomentModal } from '../components/AddMomentModal'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'

// Hard-coded trip for MVP — replace with DB-driven trip lookup later
const TRIP = {
  id: import.meta.env.VITE_TRIP_ID ?? 'demo-trip',
  name: 'Southeast Asia, 2025',
  dateRange: 'Jul 13 – Jul 17',
}

export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const { moments, loading, addMoment, toggleReaction } = useMoments(TRIP.id)
  const [showModal, setShowModal] = useState(false)
  const [posting, setPosting] = useState(false)
  const [activeDay, setActiveDay] = useState(null)
  const [toast, setToast] = useState('')

  // Group moments by calendar day
  const grouped = moments.reduce((acc, m) => {
    const day = format(parseISO(m.created_at), 'EEE d')
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})
  const days = Object.keys(grouped)
  const visibleDays = activeDay ? [activeDay] : days

  async function handleAdd(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id })
      setShowModal(false)
      showToast('Moment posted! ✨')
    } catch (e) {
      showToast('Upload failed — try again')
    } finally {
      setPosting(false)
    }
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    showToast('Link copied! 🔗')
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', background: 'var(--sand)', minHeight: '100vh', color: 'var(--ink)' }}>

      {/* Header */}
      <header style={{ background: 'var(--ink)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontStyle: 'italic', color: 'var(--dusk)', fontSize: 20 }}>wanderlog</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={copyLink} style={{ background: 'none', border: '1px solid #3a3530', color: '#9a9088', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            🔗 Share
          </button>
          {user ? (
            <button onClick={signOut} style={{ background: 'var(--rust)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Sign out
            </button>
          ) : (
            <button onClick={signInWithGoogle} style={{ background: 'var(--rust)', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: 'var(--ink)', padding: '36px 24px 52px', textAlign: 'center', position: 'relative' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--dusk)', marginBottom: 10 }}>
          Travel Timeline
        </div>
        <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34, color: 'var(--white)', lineHeight: 1.15, marginBottom: 10 }}>
          {TRIP.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, fontSize: 13, color: '#8a8078' }}>
          <span>📍 {TRIP.dateRange}</span>
          <span>📸 {moments.length} moments</span>
        </div>
        <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 32, background: 'var(--sand)', clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </div>

      {/* Day nav */}
      <div style={{ display: 'flex', gap: 8, padding: '20px 24px 4px', overflowX: 'auto' }}>
        <DayPill label="All" count={moments.length} active={!activeDay} onClick={() => setActiveDay(null)} />
        {days.map(day => (
          <DayPill key={day} label={day} count={grouped[day].length} active={activeDay === day} onClick={() => setActiveDay(day === activeDay ? null : day)} />
        ))}
      </div>

      {/* Timeline */}
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#9a9088', padding: 60 }}>Loading moments…</div>
        ) : moments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✈️</div>
            <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, marginBottom: 8 }}>No moments yet</div>
            <div style={{ color: '#9a9088', fontSize: 14 }}>{user ? 'Tap + to post your first moment' : 'Sign in to start posting'}</div>
          </div>
        ) : (
          visibleDays.map(day => {
            const dayMoments = grouped[day] ?? []
            return (
              <div key={day} style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rust)', color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {day.split(' ')[1]}
                  </div>
                  <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700 }}>{day}</div>
                  <div style={{ fontSize: 12, color: '#9a9088', marginLeft: 'auto' }}>{dayMoments.length} moment{dayMoments.length !== 1 ? 's' : ''}</div>
                </div>
                {dayMoments.map(m => (
                  <MomentCard key={m.id} moment={m} currentUserId={user?.id} onReact={id => toggleReaction(id, user.id)} />
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* FAB — only if signed in */}
      {user && (
        <button onClick={() => setShowModal(true)} style={{
          position: 'fixed', bottom: 24, right: 24, background: 'var(--rust)',
          color: 'white', border: 'none', borderRadius: '50%', width: 56, height: 56,
          fontSize: 26, cursor: 'pointer', boxShadow: '0 4px 20px rgba(184,92,58,0.45)',
          zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>＋</button>
      )}

      {showModal && <AddMomentModal onClose={() => setShowModal(false)} onAdd={handleAdd} loading={posting} />}

      {toast && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: 'var(--white)', padding: '10px 20px', borderRadius: 100, fontSize: 13, fontWeight: 500, zIndex: 400, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function DayPill({ label, count, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: active ? 'var(--ink)' : 'var(--mist)',
      color: active ? 'var(--white)' : '#6b6258',
      border: '1.5px solid transparent', borderRadius: 100,
      padding: '6px 14px', fontSize: 12, fontWeight: 600,
      cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6
    }}>
      {label}
      <span style={{ background: active ? 'var(--rust)' : 'var(--dusk)', color: 'white', borderRadius: 100, padding: '1px 6px', fontSize: 10 }}>
        {count}
      </span>
    </button>
  )
}
