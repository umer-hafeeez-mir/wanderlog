import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import jsPDF from 'jspdf'

const C = {
  night:    '#0d1117',
  parchment:'#f2ead8',
  amber:    '#e8a838',
  rust:     '#c4603a',
  dim:      '#8a8070',
  mist:     '#e8e0cc',
}

async function imgToBase64(url) {
  try {
    const res = await fetch(url + '?t=' + Date.now())
    const blob = await res.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

async function generatePDF(moments, tripName, tripEmoji) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210, H = 297
  const margin = 20

  // Group by day
  const grouped = moments.reduce((acc, m) => {
    const day = format(parseISO(m.created_at), 'EEE, MMM d')
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})

  // ── Cover page ──
  pdf.setFillColor(13, 17, 23)
  pdf.rect(0, 0, W, H, 'F')

  // Amber accent bar
  pdf.setFillColor(232, 168, 56)
  pdf.rect(0, 0, 4, H, 'F')

  // Trip name
  pdf.setFont('times', 'italic')
  pdf.setFontSize(38)
  pdf.setTextColor(255, 255, 255)
  pdf.text(`${tripEmoji}`, margin + 4, 90)
  pdf.text(tripName, margin + 4, 112)

  pdf.setFont('times', 'normal')
  pdf.setFontSize(14)
  pdf.setTextColor(180, 160, 120)
  pdf.text('A travel journal', margin + 4, 126)

  // Stats
  const totalPhotos = moments.flatMap(m => m.moment_images ?? []).length
  const totalDays = Object.keys(grouped).length
  pdf.setFontSize(11)
  pdf.setTextColor(100, 90, 80)
  pdf.text(`${moments.length} moments  ·  ${totalPhotos} photos  ·  ${totalDays} days`, margin + 4, 200)

  // Watermark
  pdf.setFont('times', 'italic')
  pdf.setFontSize(13)
  pdf.setTextColor(50, 50, 50)
  pdf.text('wanderlog', margin + 4, H - 20)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(40, 40, 40)
  pdf.text('wanderlog-one.vercel.app', margin + 4, H - 13)

  // ── Day pages ──
  for (const [day, dayMoments] of Object.entries(grouped)) {
    pdf.addPage()

    // Header bar
    pdf.setFillColor(13, 17, 23)
    pdf.rect(0, 0, W, 28, 'F')
    pdf.setFillColor(232, 168, 56)
    pdf.rect(0, 0, 4, 28, 'F')

    pdf.setFont('times', 'italic')
    pdf.setFontSize(16)
    pdf.setTextColor(255, 255, 255)
    pdf.text(day, margin + 4, 18)

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(150, 130, 100)
    pdf.text(`${tripEmoji} ${tripName}`, W - margin - 2, 18, { align: 'right' })

    let y = 40

    for (const moment of dayMoments) {
      // Check if we need a new page
      if (y > H - 60) { pdf.addPage(); y = 20 }

      const time = format(parseISO(moment.created_at), 'h:mm a')

      // Time + author
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(8)
      pdf.setTextColor(196, 96, 58)
      pdf.text(time.toUpperCase(), margin, y)

      if (moment.user_name) {
        pdf.setTextColor(140, 128, 112)
        pdf.text('  ·  ' + moment.user_name, margin + pdf.getTextWidth(time.toUpperCase()), y)
      }
      y += 6

      // Caption
      if (moment.caption) {
        pdf.setFont('times', 'italic')
        pdf.setFontSize(13)
        pdf.setTextColor(28, 35, 51)
        const lines = pdf.splitTextToSize(moment.caption, W - margin * 2)
        pdf.text(lines, margin, y)
        y += lines.length * 6 + 3
      }

      // Location
      if (moment.location) {
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.setTextColor(138, 128, 112)
        pdf.text('📍 ' + moment.location, margin, y)
        y += 7
      }

      // Photos — up to 3 per moment, side by side
      const images = moment.moment_images ?? []
      if (images.length > 0) {
        const maxImgs = Math.min(images.length, 3)
        const imgW = (W - margin * 2 - (maxImgs - 1) * 4) / maxImgs
        const imgH = Math.min(imgW * 0.65, 55)

        if (y + imgH > H - 20) { pdf.addPage(); y = 20 }

        for (let i = 0; i < maxImgs; i++) {
          try {
            const b64 = await imgToBase64(images[i].url)
            if (b64) {
              const x = margin + i * (imgW + 4)
              pdf.addImage(b64, 'JPEG', x, y, imgW, imgH, undefined, 'MEDIUM')
              // Rounded corner illusion with thin border
              pdf.setDrawColor(232, 224, 204)
              pdf.setLineWidth(0.3)
              pdf.rect(x, y, imgW, imgH)
            }
          } catch {}
        }
        y += imgH + 8
      }

      // Divider between moments
      pdf.setDrawColor(232, 224, 204)
      pdf.setLineWidth(0.3)
      pdf.line(margin, y, W - margin, y)
      y += 8
    }
  }

  // ── Back cover ──
  pdf.addPage()
  pdf.setFillColor(13, 17, 23)
  pdf.rect(0, 0, W, H, 'F')
  pdf.setFillColor(232, 168, 56)
  pdf.rect(0, 0, 4, H, 'F')
  pdf.setFont('times', 'italic')
  pdf.setFontSize(18)
  pdf.setTextColor(255, 255, 255)
  pdf.text('Until the next adventure.', margin + 4, H / 2)
  pdf.setFontSize(11)
  pdf.setTextColor(100, 90, 80)
  pdf.text('wanderlog', margin + 4, H / 2 + 12)

  return pdf
}

export function TripBook({ moments, tripName, tripEmoji, onClose }) {
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')

  async function generate() {
    setGenerating(true)
    setProgress('Building your trip book…')
    try {
      const pdf = await generatePDF(moments, tripName, tripEmoji)
      setProgress('Almost done…')
      pdf.save(`wanderlog-${tripName.toLowerCase().replace(/\s+/g, '-')}.pdf`)
      setProgress('Downloaded!')
      setTimeout(onClose, 1500)
    } catch(e) {
      setProgress('Something went wrong — try again')
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  const totalPhotos = moments.flatMap(m => m.moment_images ?? []).length
  const grouped = moments.reduce((acc, m) => {
    const day = format(parseISO(m.created_at), 'EEE, MMM d')
    if (!acc[day]) acc[day] = []
    acc[day].push(m)
    return acc
  }, {})
  const totalDays = Object.keys(grouped).length

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,17,23,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '36px 32px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        {/* Preview cover */}
        <div style={{ background: C.night, borderRadius: 16, padding: '28px 24px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: C.amber }} />
          <div style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: '0.12em', color: C.amber, textTransform: 'uppercase', marginBottom: 8 }}>Trip Book</div>
          <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic', fontSize: 26, color: '#fff', lineHeight: 1.2, marginBottom: 4 }}>{tripEmoji} {tripName}</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>A travel journal</div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            {[
              { n: moments.length, l: 'moments' },
              { n: totalPhotos, l: 'photos' },
              { n: totalDays, l: 'days' },
            ].map(s => (
              <div key={s.l} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 700, color: C.amber }}>{s.n}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.dim, lineHeight: 1.6, marginBottom: 24 }}>
          Generates a beautifully designed PDF with all your moments, photos, and locations — ready to print or keep as a keepsake.
        </div>

        {progress && (
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: C.rust, marginBottom: 16, fontWeight: 500 }}>{progress}</div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, background: '#f7f3ee', color: C.dim, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={generate} disabled={generating || moments.length === 0}
            style={{ flex: 2, background: generating ? C.dim : C.night, color: '#fff', border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
            {generating ? 'Generating…' : `Generate PDF`}
          </button>
        </div>
      </div>
    </div>
  )
}
