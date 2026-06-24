import { useState, useMemo } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { MomentCard } from '../components/MomentCard'
import { AddMomentModal } from '../components/AddMomentModal'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'

const TRIPS = {
  turkey:       { id: 'trip-turkey',   name: 'Turkey',       dateRange: 'Dates TBC', emoji: '🇹🇷' },
  saudi:        { id: 'trip-saudi',    name: 'Saudi Arabia', dateRange: 'Dates TBC', emoji: '🇸🇦' },
}

const TABS = [
  { id: 'today',    label: 'Today',        emoji: '📍' },
  { id: 'turkey',   label: 'Turkey',       emoji: '🇹🇷' },
  { id: 'saudi',    label: 'Saudi Arabia', emoji: '🇸🇦' },
  { id: 'upcoming', label: 'Upcoming',     emoji: '🗓️' },
]

export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState('today')
  const [showModal, setShowModal] = useState(false)
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState('')

  const tripId = activeTab === 'today' ? 'trip-today'
               : activeTab === 'turkey' ? TRIPS.turkey.id
               : activeTab === 'saudi' ? TRIPS.saudi.id
               : null

  const { moments, loading, addMoment, toggleReaction } = useMoments(tripId)

  // For Today tab — only show moments from today
  const visibleMoments = useMemo(() => {
    if (activeTab !== 'today') return moments
    return moments.filter(m => isToday(parseISO(m.created_at)))
  }, [moments, activeTab])

  // Group by calendar day
  const grouped = useMemo(() => {
    return visibleMoments.reduce((acc, m) => {
      const day = format(parseISO(m.created_at), 'EEE d')
      if (!acc[day]) acc[day] = []
      acc[day].push(m)
      return acc
    }, {})
  }, [visibleMoments])

  const days = Object.keys(grouped)
  const [activeDay, setActiveDay] = useState(null)
  const visibleDays = activeDay ? [activeDay] : days

  const currentTrip = TRIPS[activeTab]

  async function handleAdd(payload) {
    if (!user) return
    setPosting(true)
    try {
      await addMoment({ ...payload, userId: user.id })
      setShowModal(false)
      showToastMsg('Moment posted! ✨')
    } catch {
      showToastMsg('Upload failed — try again')
    } finally {
      setPosting(false)
    }
  }

  function showToastMsg(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  function copyLink() {
    navigator.clipboard?.writeText(window.location.href).catch(() => {})
    showToastMsg('Link copied! 🔗')
  }

  const canPost = user && activeTab !== 'upcoming'

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
              Sign in
            </button>
          )}
        </div>
      </header>

      {/* Top tabs */}
      <div style={{ background: 'var(--ink)', borderBottom: '1px solid #2a2520', display: 'flex', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setActiveDay(null) }}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--rust)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--white)' : '#6b6258',
              padding: '14px 20px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* UPCOMING tab */}
      {activeTab === 'upcoming' && (
        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🗺️</div>
          <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 24, marginBottom: 12 }}>More trips coming</div>
          <div style={{ color: '#9a9088', fontSize: 14, lineHeight: 1.6 }}>
            Future adventures will appear here.<br/>Check back soon.
          </div>
          <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { name: 'Turkey', emoji: '🇹🇷', dates: 'Dates TBC' },
              { name: 'Saudi Arabia', emoji: '🇸🇦', dates: 'Dates TBC' },
            ].map(trip => (
              <div key={trip.name} style={{ background: 'var(--white)', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 8px var(--shadow)' }}>
                <div style={{ fontSize: 28 }}>{trip.emoji}</div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{trip.name}</div>
                  <div style={{ fontSize: 12, color: '#9a9088', marginTop: 2 }}>{trip.dates}</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, background: 'var(--mist)', color: '#6b6258', borderRadius: 100, padding: '4px 10px', fontWeight: 600 }}>
                  Soon
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODAY / TURKEY / SAUDI tabs */}
      {activeTab !== 'upcoming' && (
        <>
          {/* Hero */}
          <div style={{ background: 'var(--ink)', padding: '28px 24px 44px', textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--dusk)', marginBottom: 8 }}>
              {activeTab === 'today' ? format(new Date(), 'EEEE, MMMM d') : 'Travel Timeline'}
            </div>
            <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 30, color: 'var(--white)', lineHeight: 1.2, marginBottom: 8 }}>
              {activeTab === 'today' ? "Today's Moments" : `${currentTrip?.emoji} ${currentTrip?.name}`}
            </div>
            {activeTab !== 'today' && (
              <div style={{ fontSize: 13, color: '#8a8078' }}>
                📅 {currentTrip?.dateRange} &nbsp;·&nbsp; 📸 {visibleMoments.length} moments
              </div>
            )}
            {activeTab === 'today' && (
              <div style={{ fontSize: 13, color: '#8a8078' }}>
                📸 {visibleMoments.length} moment{visibleMoments.length !== 1 ? 's' : ''} today
              </div>
            )}
            <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 32, background: 'var(--sand)', clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
          </div>

          {/* Day filter pills — only for trip tabs */}
          {activeTab !== 'today' && days.length > 0 && (
            <div style={{ display: 'flex', gap: 8, padding: '16px 24px 4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              <DayPill label="All" count={visibleMoments.length} active={!activeDay} onClick={() => setActiveDay(null)} />
              {days.map(day => (
                <DayPill key={day} label={day} count={grouped[day].length} active={activeDay === day} onClick={() => setActiveDay(day === activeDay ? null : day)} />
              ))}
            </div>
          )}

          {/* Timeline */}
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 100px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', color: '#9a9088', padding: 60 }}>Loading…</div>
            ) : visibleMoments.length === 0 ? (
              <EmptyState tab={activeTab} user={user} onSignIn={signInWithGoogle} />
            ) : (
              visibleDays.map(day => (
                <div key={day} style={{ marginBottom: 40 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--rust)', color: 'white', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {day.split(' ')[1]}
                    </div>
                    <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 18, fontWeight: 700 }}>{day}</div>
                    <div style={{ fontSize: 12, color: '#9a9088', marginLeft: 'auto' }}>{grouped[day].length} moment{grouped[day].length !== 1 ? 's' : ''}</div>
                  </div>
                  {grouped[day].map(m => (
                    <MomentCard key={m.id} moment={m} currentUserId={user?.id} onReact={id => toggleReaction(id, user.id)} />
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* FAB */}
      {canPost && (
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

function EmptyState({ tab, user, onSignIn }) {
  const config = {
    today:  { emoji: '☀️', title: "Nothing posted today yet", sub: user ? 'Tap + to post your first moment' : 'Sign in to start posting' },
    turkey: { emoji: '🇹🇷', title: 'Turkey trip coming soon', sub: 'Moments will appear here once the trip starts' },
    saudi:  { emoji: '🇸🇦', title: 'Saudi Arabia trip coming soon', sub: 'Moments will appear here once the trip starts' },
  }
  const c = config[tab] ?? config.today
  return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{c.emoji}</div>
      <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, marginBottom: 8 }}>{c.title}</div>
      <div style={{ color: '#9a9088', fontSize: 14 }}>{c.sub}</div>
      {!user && tab === 'today' && (
        <button onClick={onSignIn} style={{ marginTop: 20, background: 'var(--rust)', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          Sign in with Google
        </button>
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
