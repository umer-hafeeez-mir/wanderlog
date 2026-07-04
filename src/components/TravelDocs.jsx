import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format, parseISO, isPast, differenceInDays } from 'date-fns'

const DOC_TYPES = [
  { id: 'passport',   label: 'Passport',   icon: '🛂' },
  { id: 'ticket',     label: 'Ticket',     icon: '✈️' },
  { id: 'visa',       label: 'Visa',       icon: '📋' },
  { id: 'hotel',      label: 'Hotel',      icon: '🏨' },
  { id: 'insurance',  label: 'Insurance',  icon: '🛡️' },
  { id: 'other',      label: 'Other',      icon: '📄' },
]

const C = {
  ink: '#111',
  dim: '#888',
  mist: '#f0f0f0',
  border: '#e8e8e8',
}

function docIcon(type) { return DOC_TYPES.find(d => d.id === type)?.icon ?? '📄' }

async function getSignedUrl(path) {
  const { data } = await supabase.storage.from('travel-documents').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}
function docLabel(type) { return DOC_TYPES.find(d => d.id === type)?.label ?? 'Document' }

function ExpiryBadge({ date }) {
  if (!date) return null
  const d = parseISO(date)
  const expired = isPast(d)
  const daysLeft = differenceInDays(d, new Date())
  const soon = daysLeft <= 90 && !expired
  const color = expired ? '#e53e3e' : soon ? '#FF9F43' : '#7a9e7e'
  const bg = expired ? '#fff0f0' : soon ? '#fff8f0' : '#f0faf5'
  const text = expired ? 'Expired' : soon ? `${daysLeft}d left` : format(d, 'MMM yyyy')
  return <span style={{ background:bg, color, borderRadius:6, padding:'2px 8px', fontSize:10, fontFamily:'Geist, sans-serif', fontWeight:700 }}>{text}</span>
}

function DocCard({ doc, onDelete, onView }) {
  const [deleting, setDeleting] = useState(false)
  const [signedUrl, setSignedUrl] = useState(null)

  useEffect(() => {
    getSignedUrl(doc.file_url).then(url => setSignedUrl(url))
  }, [doc.file_url])

  const displayUrl = signedUrl

  async function handleDelete() {
    if (!confirm('Delete this document?')) return
    setDeleting(true)
    if (doc.file_url) await supabase.storage.from('travel-documents').remove([doc.file_url])
    await supabase.from('travel_documents').delete().eq('id', doc.id)
    onDelete(doc.id)
    setDeleting(false)
  }
  return (
    <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${C.border}`, overflow:'hidden', cursor:'pointer' }} onClick={() => onView({ ...doc, signedUrl: displayUrl })}>
      {/* Thumbnail */}
      <div style={{ height:110, background:'#f8f8f8', position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {doc.file_type === 'image'
          ? (displayUrl ? <img src={displayUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <div style={{ width:'100%', height:'100%', background:'#f0f0f0' }} />)
          : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:36 }}>📄</span>
              <span style={{ fontSize:10, color:C.dim, fontFamily:'Geist, sans-serif', fontWeight:600 }}>PDF</span>
            </div>
        }
        {/* Type badge */}
        <div style={{ position:'absolute', top:8, left:8, background:'rgba(0,0,0,0.55)', borderRadius:6, padding:'3px 8px', fontSize:11, color:'#fff', fontFamily:'Geist, sans-serif', fontWeight:600, display:'flex', alignItems:'center', gap:4, backdropFilter:'blur(4px)' }}>
          {docIcon(doc.doc_type)} {docLabel(doc.doc_type)}
        </div>
      </div>
      {/* Info */}
      <div style={{ padding:'10px 12px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, fontFamily:'Geist, sans-serif', color:C.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {doc.label || docLabel(doc.doc_type)}
            </div>
            <div style={{ fontSize:11, color:C.dim, fontFamily:'Geist, sans-serif', marginTop:2 }}>
              {doc.person_name}
            </div>
          </div>
          <button onClick={e=>{e.stopPropagation();handleDelete()}} disabled={deleting}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:14, flexShrink:0, padding:0 }}>✕</button>
        </div>
        {doc.expiry_date && (
          <div style={{ marginTop:6 }}><ExpiryBadge date={doc.expiry_date} /></div>
        )}
      </div>
    </div>
  )
}

function UploadModal({ user, onClose, onUploaded }) {
  const [personName, setPersonName] = useState(user?.user_metadata?.full_name?.split(' ')[0] ?? '')
  const [docType, setDocType] = useState('passport')
  const [label, setLabel] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const r = new FileReader()
      r.onload = ev => setPreview({ type:'image', src:ev.target.result })
      r.readAsDataURL(f)
    } else {
      setPreview({ type:'pdf', name:f.name })
    }
  }

  async function upload() {
    if (!file || !personName.trim()) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: uploadErr } = await supabase.storage.from('travel-documents').upload(path, file, { upsert:true })
      if (uploadErr) throw uploadErr

      // Private bucket — store path, generate signed URL for display
      const { data, error } = await supabase.from('travel_documents').insert({
        user_id: user.id,
        user_name: user.user_metadata?.full_name ?? user.email,
        person_name: personName.trim(),
        doc_type: docType,
        label: label.trim() || null,
        file_url: path,  // store storage path, not URL
        file_type: file.type.startsWith('image/') ? 'image' : 'pdf',
        expiry_date: expiryDate || null,
      }).select().single()

      if (error) throw error
      onUploaded(data)
      onClose()
    } catch(e) { alert('Upload failed: ' + e.message) }
    finally { setUploading(false) }
  }

  const inputStyle = { width:'100%', border:'none', borderBottom:'1.5px solid #e8e8e8', padding:'7px 0', fontSize:14, fontFamily:'Geist, sans-serif', outline:'none', background:'transparent', color:C.ink }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:600, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:560, maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ width:36, height:4, background:'#e8e8e8', borderRadius:2, margin:'12px auto 0', flexShrink:0 }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px', flexShrink:0 }}>
          <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:20 }}>Add document</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#bbb' }}>✕</button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'0 18px' }}>
          {/* File picker */}
          {!preview ? (
            <div onClick={()=>fileRef.current?.click()} style={{ border:'2px dashed #e8e8e8', borderRadius:14, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'#fafafa', marginBottom:16 }}>
              <div style={{ fontSize:32, marginBottom:6 }}>📎</div>
              <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', color:'#bbb' }}>Tap to upload photo or PDF</div>
            </div>
          ) : (
            <div style={{ position:'relative', marginBottom:16, borderRadius:14, overflow:'hidden', border:'1px solid #e8e8e8' }}>
              {preview.type === 'image'
                ? <img src={preview.src} alt="" style={{ width:'100%', height:160, objectFit:'cover', display:'block' }} />
                : <div style={{ height:100, display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f8f8', gap:10 }}><span style={{ fontSize:32 }}>📄</span><span style={{ fontFamily:'Geist, sans-serif', fontSize:13, color:C.dim }}>{preview.name}</span></div>
              }
              <button onClick={()=>{setFile(null);setPreview(null)}} style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', color:'#fff', border:'none', borderRadius:'50%', width:24, height:24, fontSize:12, cursor:'pointer' }}>✕</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display:'none' }} onChange={handleFile} />

          {/* Person */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:10, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:C.dim, display:'block', marginBottom:4 }}>Person</label>
            <input type="text" value={personName} onChange={e=>setPersonName(e.target.value)} placeholder="e.g. Umer, Wife, Ayaan" style={inputStyle} />
          </div>

          {/* Doc type */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:10, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:C.dim, display:'block', marginBottom:8 }}>Type</label>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {DOC_TYPES.map(t => (
                <button key={t.id} onClick={()=>setDocType(t.id)}
                  style={{ background:docType===t.id?'#111':'#f5f5f5', color:docType===t.id?'#fff':'#444', border:'none', borderRadius:100, padding:'6px 14px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div style={{ marginBottom:14 }}>
            <label style={{ fontSize:10, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:C.dim, display:'block', marginBottom:4 }}>Label (optional)</label>
            <input type="text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Turkey Flight — 13 Jul" style={inputStyle} />
          </div>

          {/* Expiry */}
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:10, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.1em', textTransform:'uppercase', color:C.dim, display:'block', marginBottom:4 }}>Expiry date (optional)</label>
            <input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ padding:'10px 18px 32px', flexShrink:0, borderTop:'1px solid #f0f0f0' }}>
          <button onClick={upload} disabled={uploading||!file||!personName.trim()}
            style={{ width:'100%', background:uploading||!file||!personName.trim()?'#ccc':'#111', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:uploading||!file||!personName.trim()?'not-allowed':'pointer' }}>
            {uploading ? 'Uploading…' : 'Save document'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DocViewer({ doc, onClose }) {
  const url = doc.signedUrl
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:700, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
      <div style={{ position:'absolute', top:16, right:16, display:'flex', gap:10 }}>
        <a href={url} download target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
          style={{ background:'rgba(255,255,255,0.15)', color:'#fff', border:'none', borderRadius:100, padding:'8px 16px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', textDecoration:'none' }}>
          Download
        </a>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', width:36, height:36, borderRadius:'50%', fontSize:16, cursor:'pointer' }}>✕</button>
      </div>
      <div style={{ position:'absolute', top:16, left:16, color:'rgba(255,255,255,0.7)', fontFamily:'Geist, sans-serif', fontSize:13 }}>
        {docIcon(doc.doc_type)} {doc.label || docLabel(doc.doc_type)} · {doc.person_name}
      </div>
      {doc.file_type === 'image'
        ? <img onClick={e=>e.stopPropagation()} src={url} alt="" style={{ maxWidth:'92vw', maxHeight:'85vh', objectFit:'contain', borderRadius:8 }} />
        : <div onClick={e=>e.stopPropagation()} style={{ background:'#fff', borderRadius:12, overflow:'hidden', width:'92vw', maxWidth:600, height:'80vh' }}>
            <iframe src={url} style={{ width:'100%', height:'100%', border:'none' }} title="Document" />
          </div>
      }
    </div>
  )
}

export function TravelDocs({ user, onClose }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [viewDoc, setViewDoc] = useState(null)
  const [filterPerson, setFilterPerson] = useState('all')

  useEffect(() => {
    supabase.from('travel_documents').select('*').order('created_at', { ascending:false })
      .then(({ data }) => { setDocs(data??[]); setLoading(false) })
  }, [])

  const people = ['all', ...new Set(docs.map(d => d.person_name))]
  const filtered = filterPerson === 'all' ? docs : docs.filter(d => d.person_name === filterPerson)

  // Group by person
  const grouped = filtered.reduce((acc, doc) => {
    if (!acc[doc.person_name]) acc[doc.person_name] = []
    acc[doc.person_name].push(doc)
    return acc
  }, {})

  // Expiring soon alert
  const expiringSoon = docs.filter(d => {
    if (!d.expiry_date) return false
    const days = differenceInDays(parseISO(d.expiry_date), new Date())
    return days >= 0 && days <= 90
  })

  return (
    <>
      <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:500, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
        <div style={{ background:'#fafafa', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:560, height:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          {/* Handle + header */}
          <div style={{ background:'#fff', borderBottom:'1px solid #f0f0f0', flexShrink:0 }}>
            <div style={{ width:36, height:4, background:'#e8e8e8', borderRadius:2, margin:'12px auto 0' }} />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 18px 10px' }}>
              <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:22, color:C.ink }}>Travel Documents</div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={()=>setShowUpload(true)} style={{ background:'#111', color:'#fff', border:'none', borderRadius:10, padding:'7px 14px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>+ Add</button>
                <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#bbb' }}>✕</button>
              </div>
            </div>

            {/* Person filter pills */}
            {people.length > 2 && (
              <div style={{ display:'flex', gap:8, padding:'0 18px 12px', overflowX:'auto', scrollbarWidth:'none' }}>
                {people.map(p => (
                  <button key={p} onClick={()=>setFilterPerson(p)}
                    style={{ background:filterPerson===p?'#111':'#f0f0f0', color:filterPerson===p?'#fff':'#555', border:'none', borderRadius:100, padding:'5px 14px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, textTransform:'capitalize' }}>
                    {p === 'all' ? 'Everyone' : p}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expiry warning */}
          {expiringSoon.length > 0 && (
            <div style={{ background:'#fff8f0', borderBottom:'1px solid #ffe0b2', padding:'10px 18px', flexShrink:0 }}>
              <div style={{ fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, color:'#e65100' }}>
                ⚠️ {expiringSoon.length} document{expiringSoon.length>1?'s':''} expiring within 90 days
              </div>
              <div style={{ fontSize:11, color:'#FF9F43', fontFamily:'Geist, sans-serif', marginTop:2 }}>
                {expiringSoon.map(d=>d.label||docLabel(d.doc_type)).join(' · ')}
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex:1, overflowY:'auto', padding:'16px 18px 40px' }}>
            {loading ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb', fontFamily:'Geist, sans-serif', fontStyle:'italic' }}>Loading…</div>
            ) : docs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'48px 20px' }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🗂️</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:20, marginBottom:6 }}>No documents yet</div>
                <div style={{ fontSize:13, color:'#bbb', fontFamily:'Geist, sans-serif', marginBottom:20 }}>Add passports, tickets, visas and more.</div>
                <button onClick={()=>setShowUpload(true)} style={{ background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'11px 24px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Add first document</button>
              </div>
            ) : (
              Object.entries(grouped).map(([person, personDocs]) => (
                <div key={person} style={{ marginBottom:24 }}>
                  <div style={{ fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase', color:C.dim, marginBottom:10 }}>
                    👤 {person}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {personDocs.map(doc => (
                      <DocCard key={doc.id} doc={doc} onDelete={id=>setDocs(ds=>ds.filter(d=>d.id!==id))} onView={setViewDoc} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showUpload && <UploadModal user={user} onClose={()=>setShowUpload(false)} onUploaded={doc=>{setDocs(ds=>[doc,...ds]);setShowUpload(false)}} />}
      {viewDoc && <DocViewer doc={viewDoc} onClose={()=>setViewDoc(null)} />}
    </>
  )
}
