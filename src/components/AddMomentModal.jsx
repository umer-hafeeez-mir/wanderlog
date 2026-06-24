import { useRef, useState } from 'react'

export function AddMomentModal({ onClose, onAdd, loading }) {
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

  function submit() {
    if (!caption.trim()) return
    onAdd({ caption: caption.trim(), location: location.trim(), imageFiles: files })
  }

  const inputStyle = {
    width: '100%', border: '1.5px solid var(--mist)', borderRadius: 10,
    padding: '10px 12px', fontSize: 14, background: 'var(--sand)',
    fontFamily: 'Inter, sans-serif', outline: 'none', color: 'var(--ink)'
  }
  const labelStyle = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
    textTransform: 'uppercase', color: '#6b6258', marginBottom: 6, display: 'block'
  }

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,22,18,0.6)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--white)', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px', width: '100%', maxWidth: 600 }}>
        <div style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Add a moment
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#9a9088' }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Caption</label>
          <textarea rows={3} value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="What happened? Where are you?"
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Location (optional)</label>
          <input type="text" value={location} onChange={e => setLocation(e.target.value)}
            placeholder="e.g. Hanoi, Vietnam" style={inputStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Photos</label>
          <div onClick={() => fileRef.current.click()} style={{
            border: '2px dashed var(--dusk)', borderRadius: 10, padding: 20,
            textAlign: 'center', cursor: 'pointer', color: '#9a9088', fontSize: 13, background: 'var(--sand)'
          }}>
            <div style={{ fontSize: 28, marginBottom: 4 }}>📷</div>
            Tap to upload photos
          </div>
          <input ref={fileRef} type="file" multiple accept="image/*" onChange={handleFiles} style={{ display: 'none' }} />
          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              {previews.map((src, i) => (
                <img key={i} src={src} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '2px solid var(--mist)' }} />
              ))}
            </div>
          )}
        </div>

        <button onClick={submit} disabled={loading || !caption.trim()} style={{
          width: '100%', background: 'var(--rust)', color: 'white', border: 'none',
          borderRadius: 10, padding: 13, fontSize: 15, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
        }}>
          {loading ? 'Posting…' : 'Post Moment'}
        </button>
      </div>
    </div>
  )
}
