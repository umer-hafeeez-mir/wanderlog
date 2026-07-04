import { useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import html2canvas from 'html2canvas'

const C = {
  night:    '#0d1117',
  parchment:'#f2ead8',
  amber:    '#e8a838',
  rust:     '#c4603a',
  dim:      '#8a8070',
}

export function DayRecap({ day, moments, tripName, tripEmoji, onClose }) {
  const cardRef = useRef()
  const [saving, setSaving] = useState(false)

  const photos = moments.flatMap(m => m.moment_images ?? [])
  const locations = [...new Set(moments.map(m => m.location).filter(Boolean))]
  const dayNum = moments[0] ? format(parseISO(moments[0].created_at), 'd') : '?'
  const dayName = moments[0] ? format(parseISO(moments[0].created_at), 'EEEE') : ''
  const monthYear = moments[0] ? format(parseISO(moments[0].created_at), 'MMMM yyyy') : ''
  const coverPhoto = photos[0]?.url

  async function saveAsImage() {
    setSaving(true)
    try {
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2, backgroundColor: null })
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `wanderlog-day-${dayNum}.png`
      a.click()
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  async function shareToWhatsApp() {
    setSaving(true)
    try {
      const canvas = await html2canvas(cardRef.current, { useCORS: true, scale: 2, backgroundColor: null })
      canvas.toBlob(async blob => {
        const file = new File([blob], 'wanderlog-recap.png', { type: 'image/png' })
        if (navigator.share && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `Day ${dayNum} — ${tripName}` })
        } else {
          // Fallback: open WhatsApp with text
          const text = encodeURIComponent(`Day ${dayNum} on ${tripEmoji} ${tripName} — ${moments.length} moments, ${photos.length} photos${locations.length ? `, ${locations.join(', ')}` : ''}. See the full trip at https://wanderlog-one.vercel.app`)
          window.open(`https://wa.me/?text=${text}`, '_blank')
        }
      }, 'image/png')
    } catch(e) { console.error(e) }
    setSaving(false)
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.85)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>

      {/* The card itself — this is what gets screenshotted */}
      <div ref={cardRef} style={{
        width: 340, background: C.night, borderRadius: 24, overflow: 'hidden',
        fontFamily: "'Cormorant Garamond', Georgia, serif",
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Cover photo */}
        {coverPhoto ? (
          <div style={{ position: 'relative', height: 200, overflow: 'hidden' }}>
            <img src={coverPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(13,17,23,0.9))' }} />
          </div>
        ) : (
          <div style={{ height: 120, background: `linear-gradient(135deg, ${C.rust}, ${C.amber})` }} />
        )}

        {/* Content */}
        <div style={{ padding: '20px 24px 28px' }}>
          {/* Trip name */}
          <div style={{ fontSize: 12, color: C.amber, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            {tripEmoji} {tripName}
          </div>

          {/* Day number — big stamp */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 72, fontWeight: 700, color: '#fff', lineHeight: 0.9, letterSpacing: '-0.03em' }}>{dayNum}</div>
            <div>
              <div style={{ fontSize: 18, fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', lineHeight: 1.1 }}>{dayName}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif" }}>{monthYear}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '16px 0' }} />

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 20, marginBottom: locations.length ? 16 : 0 }}>
            {[
              { num: moments.length, label: moments.length === 1 ? 'moment' : 'moments' },
              { num: photos.length, label: photos.length === 1 ? 'photo' : 'photos' },
              { num: locations.length, label: locations.length === 1 ? 'place' : 'places' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 28, fontWeight: 700, color: C.amber, lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: "'DM Sans', sans-serif", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Locations */}
          {locations.length > 0 && (
            <div style={{ fontSize: 13, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
              📍 {locations.join(' · ')}
            </div>
          )}

          {/* Photo strip */}
          {photos.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginTop: 16, overflow: 'hidden' }}>
              {photos.slice(1, 4).map((p, i) => (
                <img key={i} src={p.url} crossOrigin="anonymous" alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flex: '0 0 72px' }} />
              ))}
            </div>
          )}

          {/* Watermark */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 14, fontStyle: 'italic', color: 'rgba(255,255,255,0.25)' }}>wanderlog</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.06em' }}>wanderlog-one.vercel.app</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={saveAsImage} disabled={saving}
          style={{ background: '#fff', color: C.night, border: 'none', borderRadius: 100, padding: '11px 22px', fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: 'pointer' }}>
          {saving ? 'Saving…' : '↓ Save image'}
        </button>
        <button onClick={shareToWhatsApp} disabled={saving}
          style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 100, padding: '11px 22px', fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: 'pointer' }}>
          Share on WhatsApp
        </button>
        <button onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 100, padding: '11px 18px', fontSize: 13, fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
          ✕
        </button>
      </div>
    </div>
  )
}
