import { useState, useMemo, useRef, useEffect } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useMoments } from '../hooks/useMoments'
import { useAuth } from '../hooks/useAuth'
import { DayRecap } from '../components/DayRecap'
import { WelcomePage } from './WelcomePage'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { TravelDocs } from '../components/TravelDocs'
import { TripBook } from '../components/TripBook'

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
const EMOJI_OPTIONS = ['✈️','🌍','🏔️','🏖️','🏙️','🗺️','🎒','🚂','🛳️','🏕️','🍜','☕','🎭','📸','🌅','⛩️','🕌','🏛️','🌴','❄️']

// Vivid colors per day — like Config Timeline
const DAY_COLORS = ['#FF6B6B','#FF9F43','#FECA57','#1DD1A1','#48DBFB','#FF9FF3','#54A0FF','#5F27CD','#00D2D3','#EE5A24','#C8D6E5','#576574']
const dayColor = idx => DAY_COLORS[idx % DAY_COLORS.length]

// Inject fonts
const _fl = document.createElement('link')
_fl.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&display=swap'
_fl.rel = 'stylesheet'
if (!document.head.querySelector('[href*="Geist"]')) document.head.appendChild(_fl)

// ── Helpers ───────────────────────────────────────────────────
async function loadTripCovers(trips, setTrips) {
  const ids = trips.filter(t => t.id).map(t => t.id)
  const { data } = await supabase.from('trips').select('id, cover_url, is_private').in('id', ids)
  if (!data) return
  setTrips(ts => ts.map(t => {
    const r = data.find(x => x.id === t.id)
    if (!r) return t
    return { ...t, ...(r.cover_url ? { cover: r.cover_url } : {}), isPrivate: r.is_private ?? false }
  }))
}

function useJoinRequest(trips, user, showToast) {
  const [joinState, setJoinState] = useState(null)
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('join')
    if (!token || !user) return
    async function go() {
      const { data: trip } = await supabase.from('trips').select('id, name, invite_token').eq('invite_token', token).single()
      if (!trip) { showToast('Invalid invite link'); return }
      const { data: existing } = await supabase.from('trip_members').select('status').eq('trip_id', trip.id).eq('user_id', user.id).single()
      if (existing) { setJoinState({ trip, status: existing.status }); return }
      const allIds = DEFAULT_TRIPS.filter(t => !t.fixed).map(t => t.id)
      await supabase.from('trip_members').upsert(allIds.map(tripId => ({ trip_id: tripId, user_id: user.id, user_name: user.user_metadata?.full_name ?? user.email, user_avatar: user.user_metadata?.avatar_url ?? null, user_email: user.email, status: 'pending' })), { onConflict: 'trip_id,user_id' })
      try {
        const { data: nd } = await supabase.functions.invoke('notify-join-request', { body: { tripName: trip.name, requesterName: user.user_metadata?.full_name ?? user.email, requesterEmail: user.email, adminEmail: ADMIN_EMAIL } })
        if (nd && !nd.emailOk) { const t = encodeURIComponent(`📸 Wanderlog: ${user.user_metadata?.full_name ?? user.email} (${user.email}) wants to join *${trip.name}*. Approve: https://wanderlog-one.vercel.app`); window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${t}`, '_blank') }
      } catch {}
      setJoinState({ trip, status: 'pending' })
      window.history.replaceState({}, '', '/')
    }
    go()
  }, [user])
  return joinState
}

// Generate consistent color from name for identity dot
function stringToColor(str) {
  const colors = ['#FF6B6B','#FF9F43','#FECA57','#1DD1A1','#48DBFB','#FF9FF3','#54A0FF','#5F27CD']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function isVideo(url) { return url && /\.(mp4|mov|webm|ogg|avi)$/i.test(url.split('?')[0]) }

// ── Push notification subscription ───────────────────────────
async function subscribeToPush(user) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) return // already subscribed

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    // VAPID not needed for basic push — use simple subscription
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: null, // works without VAPID for same-origin
    }).catch(() => null)

    if (!sub) return

    const { endpoint, keys } = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint,
      p256dh: keys?.p256dh ?? '',
      auth: keys?.auth ?? '',
    }, { onConflict: 'endpoint' })
  } catch {}
}

// ── Lightbox ──────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [i, setI] = useState(startIndex)
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') setI(x => Math.min(x+1, images.length-1)); if (e.key === 'ArrowLeft') setI(x => Math.max(x-1, 0)) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.96)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', width:36, height:36, borderRadius:'50%', fontSize:16, cursor:'pointer' }}>✕</button>
      {images.length > 1 && <div style={{ position:'absolute', top:20, left:'50%', transform:'translateX(-50%)', color:'rgba(255,255,255,0.5)', fontSize:12 }}>{i+1} / {images.length}</div>}
      {i > 0 && <button onClick={e=>{e.stopPropagation();setI(x=>x-1)}} style={{ position:'absolute', left:16, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', fontSize:24, cursor:'pointer' }}>‹</button>}
      {isVideo(images[i].url) ? <video onClick={e=>e.stopPropagation()} src={images[i].url} controls autoPlay style={{ maxWidth:'90vw', maxHeight:'85vh', borderRadius:4 }} /> : <img onClick={e=>e.stopPropagation()} src={images[i].url} alt="" style={{ maxWidth:'90vw', maxHeight:'85vh', objectFit:'contain', borderRadius:4 }} />}
      {i < images.length-1 && <button onClick={e=>{e.stopPropagation();setI(x=>x+1)}} style={{ position:'absolute', right:16, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', width:44, height:44, borderRadius:'50%', fontSize:24, cursor:'pointer' }}>›</button>}
      {images.length > 1 && <div style={{ position:'absolute', bottom:20, left:'50%', transform:'translateX(-50%)', display:'flex', gap:6 }}>{images.map((_,j)=><div key={j} onClick={e=>{e.stopPropagation();setI(j)}} style={{ width:j===i?20:6, height:6, borderRadius:3, background:j===i?'#fff':'rgba(255,255,255,0.3)', cursor:'pointer', transition:'all 0.2s' }} />)}</div>}
    </div>
  )
}

// ── Photo Grid ────────────────────────────────────────────────
function PhotoGrid({ images, onPhotoClick }) {
  if (!images?.length) return null
  const shown = images.slice(0, 4), extra = images.length - 4
  const grid = shown.length === 1 ? { gridTemplateColumns:'1fr', height:280 } : shown.length === 2 ? { gridTemplateColumns:'1fr 1fr', height:210 } : { gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr', height:310 }
  return (
    <div style={{ display:'grid', gap:2, ...grid }}>
      {shown.map((img, j) => (
        <div key={img.id??j} onClick={()=>onPhotoClick(j)} style={{ position:'relative', overflow:'hidden', cursor:'pointer', ...(shown.length===3&&j===0?{gridRow:'1/3'}:{}) }}>
          {isVideo(img.url) ? <video src={img.url} muted playsInline loop style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} /> : <img src={img.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />}
          {j===3&&extra>0 && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:24, fontWeight:700 }}>+{extra}</div>}
        </div>
      ))}
    </div>
  )
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({ src, name, size=32 }) {
  if (src) return <img src={src} alt="" style={{ width:size, height:size, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
  return <div style={{ width:size, height:size, borderRadius:'50%', background:'#FF6B6B', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:700, flexShrink:0 }}>{name?.[0]?.toUpperCase()??'?'}</div>
}

// ── Comments ──────────────────────────────────────────────────
function Comments({ momentId, user }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  useEffect(() => { supabase.from('comments').select('*').eq('moment_id', momentId).order('created_at').then(({ data }) => setComments(data??[])) }, [momentId])
  async function submit() {
    if (!text.trim()||!user) return
    setLoading(true)
    const { data } = await supabase.from('comments').insert({ moment_id:momentId, user_id:user.id, text:text.trim(), user_name:user.user_metadata?.full_name??user.email }).select().single()
    if (data) { setComments(c=>[...c,data]); setText(''); setExpanded(true) }
    setLoading(false)
  }
  const visible = expanded ? comments : comments.slice(-1)
  return (
    <div style={{ padding:'10px 14px 14px', borderTop:'1px solid #f0f0f0' }}>
      {comments.length > 1 && !expanded && <button onClick={()=>setExpanded(true)} style={{ background:'none', border:'none', fontSize:12, color:'#999', cursor:'pointer', padding:'0 0 8px', fontFamily:'Geist, sans-serif' }}>View all {comments.length} comments</button>}
      {visible.map(c => (
        <div key={c.id} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'flex-start' }}>
          <div style={{ width:22, height:22, borderRadius:'50%', background:'#f0f0f0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#666', flexShrink:0 }}>{c.user_name?.[0]?.toUpperCase()??'?'}</div>
          <div style={{ flex:1 }}><span style={{ fontWeight:600, fontSize:12, color:'#222', fontFamily:'Geist, sans-serif' }}>{c.user_name?.split(' ')[0]??'User'} </span><span style={{ fontSize:13, color:'#444', fontFamily:'Geist, sans-serif' }}>{c.text}</span></div>
        </div>
      ))}
      {user ? (
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:4 }}>
          <Avatar src={user.user_metadata?.avatar_url} name={user.email} size={24} />
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder="Add a comment…" style={{ flex:1, border:'none', borderBottom:'1px solid #e8e8e8', background:'transparent', padding:'5px 0', fontSize:13, fontFamily:'Geist, sans-serif', outline:'none', color:'#222' }} />
          {text.trim() && <button onClick={submit} disabled={loading} style={{ background:'none', border:'none', color:'#FF6B6B', fontWeight:600, fontSize:13, fontFamily:'Geist, sans-serif', cursor:'pointer' }}>Post</button>}
        </div>
      ) : <p style={{ fontSize:12, color:'#bbb', margin:'4px 0 0', fontFamily:'Geist, sans-serif', fontStyle:'italic' }}>Sign in to comment</p>}
    </div>
  )
}

// ── Moment Card ───────────────────────────────────────────────
function MomentCard({ moment, user, onReact, onMenuOpen, cardIdx = 0 }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const images = moment.moment_images ?? []
  const reactions = moment.reactions ?? []
  const heartCount = reactions.filter(r => r.emoji === '❤️').length
  const heartMine = reactions.some(r => r.emoji === '❤️' && r.user_id === user?.id)
  const otherReactions = REACTIONS.slice(1).reduce((acc, e) => {
    const count = reactions.filter(r => r.emoji === e).length
    const mine = reactions.some(r => r.emoji === e && r.user_id === user?.id)
    if (count > 0) acc.push({ emoji:e, count, mine })
    return acc
  }, [])
  const [showPicker, setShowPicker] = useState(false)
  const time = format(parseISO(moment.created_at), 'h:mm a')

  return (
    <div className='card-in moment-card' style={{ background:'#fff', borderRadius:16, boxShadow:'0 2px 12px rgba(0,0,0,0.07)', marginBottom:10, overflow:'hidden', animationDelay:`${cardIdx * 0.06}s` }}>
      {/* Header — prominent poster identity */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px 0' }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <Avatar src={moment.user_avatar} name={moment.user_name} size={38} />
          <div style={{ position:'absolute', bottom:-1, right:-1, width:12, height:12, borderRadius:'50%', background: stringToColor(moment.user_name??''), border:'2px solid #fff' }} />
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:700, fontFamily:'Geist, sans-serif', color:'#111', letterSpacing:'-0.01em' }}>{moment.user_name ?? 'Traveller'}</div>
          <div style={{ fontSize:11, color:'#aaa', fontFamily:'Geist, sans-serif', marginTop:1 }}>{time}{moment.location ? ` · ${moment.location}` : ''}</div>
        </div>
        {user && <button onClick={()=>onMenuOpen(moment)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', padding:'4px 8px', fontSize:18, borderRadius:6 }}>•••</button>}
      </div>

      {/* Caption */}
      {moment.caption && <p style={{ margin:'8px 14px', fontSize:14, lineHeight:1.55, fontFamily:'Geist, sans-serif', color:'#222', fontWeight:400 }}>{moment.caption}</p>}



      {/* Photos */}
      <PhotoGrid images={images} onPhotoClick={setLightboxIndex} />
      {lightboxIndex !== null && <Lightbox images={images} startIndex={lightboxIndex} onClose={()=>setLightboxIndex(null)} />}

      {/* Reactions */}
      <div style={{ padding:'10px 14px 0', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', position:'relative' }}>
        {/* Heart */}
        <button onClick={()=>user&&onReact(moment.id,'❤️')} disabled={!user}
          style={{ background:heartMine?'#fff0f0':'#f5f5f5', border:`1.5px solid ${heartMine?'#ff6b6b':'#e8e8e8'}`, borderRadius:100, padding:'4px 12px', fontSize:13, cursor:user?'pointer':'default', display:'flex', alignItems:'center', gap:5, opacity:user?1:0.6, transition:'all 0.15s' }}>
          <span style={{ fontSize:15 }}>🤍</span>
          <span style={{ fontFamily:'Geist, sans-serif', fontWeight:600, fontSize:12, color:heartMine?'#e53e3e':'#666' }}>{heartCount}</span>
          {heartCount > 0 && <span style={{ fontFamily:'Geist, sans-serif', fontSize:11, color:'#999' }}>{heartCount===1?'love':'loves'}</span>}
        </button>

        {/* Other reactions */}
        {otherReactions.map(r => (
          <button key={r.emoji} onClick={()=>user&&onReact(moment.id,r.emoji)}
            style={{ background:r.mine?'#fff8e0':'#f5f5f5', border:`1.5px solid ${r.mine?'#e8a838':'#e8e8e8'}`, borderRadius:100, padding:'4px 10px', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
            {r.emoji} <span style={{ fontSize:11, fontWeight:600, fontFamily:'Geist, sans-serif', color:'#666' }}>{r.count}</span>
          </button>
        ))}

        {/* Add reaction */}
        {user && (
          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowPicker(p=>!p)} style={{ background:'#f5f5f5', border:'1.5px solid #e8e8e8', borderRadius:100, padding:'4px 10px', fontSize:15, cursor:'pointer', color:'#aaa', lineHeight:1 }}>＋</button>
            {showPicker && (
              <div style={{ position:'absolute', bottom:36, left:0, background:'#fff', borderRadius:16, boxShadow:'0 8px 32px rgba(0,0,0,0.12)', padding:10, display:'flex', gap:4, flexWrap:'wrap', width:220, zIndex:200 }}>
                {REACTIONS.map(e => <button key={e} onClick={()=>{onReact(moment.id,e);setShowPicker(false)}} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', borderRadius:8, padding:4, width:38, height:38 }}>{e}</button>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comments */}
      <Comments momentId={moment.id} user={user} />
    </div>
  )
}

// ── Moment Menu ───────────────────────────────────────────────
function MomentMenu({ moment, user, onDelete, onClose }) {
  const isOwner = user?.id === moment.user_id
  const images = moment.moment_images ?? []
  const [copied, setCopied] = useState(false)
  async function savePhoto() { try { const r=await fetch(images[0].url); const b=await r.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='wanderlog.jpg'; a.click() } catch {} onClose() }
  function shareWA() { window.open('https://wa.me/?text='+encodeURIComponent('Check out my trip! '+window.location.href),'_blank'); onClose() }
  async function copyLink() { await navigator.clipboard?.writeText(window.location.href); setCopied(true); setTimeout(onClose,800) }
  const items = [{ label:'Share on WhatsApp', action:shareWA }, { label:copied?'Copied!':'Copy link', action:copyLink }, ...(images.length>0?[{ label:'Save photo', action:savePhoto }]:[]), ...(isOwner?[{ label:'Delete', action:()=>{onDelete(moment);onClose()}, danger:true }]:[])]
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 16px 32px' }}>
      <div style={{ width:'100%', maxWidth:560, display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
          {items.map(item => (
            <button key={item.label} onClick={item.action} style={{ background:item.danger?'rgba(229,62,62,0.9)':'rgba(255,255,255,0.95)', color:item.danger?'#fff':'#111', border:'none', borderRadius:100, padding:'11px 22px', fontSize:14, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', backdropFilter:'blur(12px)', whiteSpace:'nowrap' }}>
              {item.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} style={{ background:'rgba(255,255,255,0.85)', color:'#999', border:'none', borderRadius:100, padding:'11px', fontSize:14, fontFamily:'Geist, sans-serif', cursor:'pointer', backdropFilter:'blur(12px)' }}>Cancel</button>
      </div>
    </div>
  )
}

// ── Add Moment Modal ──────────────────────────────────────────
function AddMomentModal({ onClose, onAdd, loading, initialFiles=[] }) {
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState('')
  const [coords, setCoords] = useState(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    if (!initialFiles.length) return
    const newFiles=[], newPrevs=[]
    let loaded=0
    initialFiles.forEach((file,i) => {
      newFiles.push(file)
      if (file.type.startsWith('video/')) { newPrevs[i]={type:'video',src:URL.createObjectURL(file)}; loaded++; if(loaded===initialFiles.length){setFiles(newFiles);setPreviews([...newPrevs])} }
      else { const r=new FileReader(); r.onload=ev=>{newPrevs[i]={type:'image',src:ev.target.result};loaded++;if(loaded===initialFiles.length){setFiles(newFiles);setPreviews([...newPrevs])}}; r.readAsDataURL(file) }
    })
  }, [])

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(pos => {
      setCoords({lat:pos.coords.latitude,lng:pos.coords.longitude})
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`).then(r=>r.json()).then(d=>{const city=d.address?.city||d.address?.town||d.address?.village||'';const country=d.address?.country||'';if(city||country)setLocation([city,country].filter(Boolean).join(', '))}).catch(()=>{})
    },()=>{})
  }, [])

  function addFiles(fl) {
    Array.from(fl).forEach(file => {
      setFiles(f=>[...f,file])
      if(file.type.startsWith('video/')) setPreviews(p=>[...p,{type:'video',src:URL.createObjectURL(file)}])
      else{const r=new FileReader();r.onload=ev=>setPreviews(p=>[...p,{type:'image',src:ev.target.result}]);r.readAsDataURL(file)}
    })
  }

  function getLocation() {
    setGpsLoading(true)
    navigator.geolocation?.getCurrentPosition(pos=>{
      setCoords({lat:pos.coords.latitude,lng:pos.coords.longitude})
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`).then(r=>r.json()).then(d=>{const city=d.address?.city||d.address?.town||d.address?.village||'';const country=d.address?.country||'';if(city||country)setLocation([city,country].filter(Boolean).join(', '))}).catch(()=>{}).finally(()=>setGpsLoading(false))
    },()=>setGpsLoading(false))
  }

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', width:'100%', maxWidth:560, maxHeight:'92vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ width:36, height:4, background:'#e8e8e8', borderRadius:2, margin:'12px auto 8px', flexShrink:0 }} />
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 18px 10px', flexShrink:0 }}>
          <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:20, color:'#111' }}>New moment</div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#bbb' }}>✕</button>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'0 18px' }}>
          {previews.length > 0 && (
            <div style={{ display:'flex', gap:8, marginBottom:14, overflowX:'auto', scrollbarWidth:'none' }}>
              {previews.map((item,i) => (
                <div key={i} style={{ position:'relative', flexShrink:0 }}>
                  {item.type==='video' ? <video src={item.src} muted playsInline style={{ width:100, height:100, borderRadius:12, objectFit:'cover', background:'#000' }} /> : <img src={item.src} alt="" style={{ width:100, height:100, borderRadius:12, objectFit:'cover', display:'block' }} />}
                  <button onClick={()=>{setFiles(f=>f.filter((_,j)=>j!==i));setPreviews(p=>p.filter((_,j)=>j!==i))}} style={{ position:'absolute', top:-6, right:-6, background:'#e53e3e', color:'#fff', border:'none', borderRadius:'50%', width:20, height:20, fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
                </div>
              ))}
              <label style={{ width:100, height:100, borderRadius:12, border:'2px dashed #e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'#bbb', fontSize:24, background:'#fafafa' }}>＋<input type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={e=>addFiles(e.target.files)} /></label>
            </div>
          )}
          <div style={{ marginBottom:14 }}>
            <textarea rows={3} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Caption…" style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1.5px solid #e8e8e8', padding:'6px 0', fontSize:15, fontFamily:'Geist, sans-serif', color:'#111', outline:'none', resize:'none' }} />
          </div>
          <div style={{ marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <input type="text" value={location} onChange={e=>setLocation(e.target.value)} placeholder="Location" style={{ flex:1, background:'transparent', border:'none', borderBottom:'1.5px solid #e8e8e8', padding:'6px 0', fontSize:14, fontFamily:'Geist, sans-serif', color:'#111', outline:'none' }} />
            <button onClick={getLocation} disabled={gpsLoading} style={{ background:coords?'#e8f5e0':'#f5f5f5', border:`1px solid ${coords?'#7a9e7e':'#e8e8e8'}`, borderRadius:8, padding:'5px 10px', fontSize:11, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', color:coords?'#7a9e7e':'#999', flexShrink:0 }}>
              {gpsLoading?'…':coords?'✓ GPS':'Auto'}
            </button>
          </div>
          {previews.length === 0 && (
            <div onClick={()=>fileRef.current?.click()} style={{ border:'2px dashed #e8e8e8', borderRadius:14, padding:'24px', textAlign:'center', cursor:'pointer', background:'#fafafa', marginBottom:14 }}>
              <div style={{ fontSize:26, marginBottom:4 }}>📎</div>
              <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', color:'#bbb' }}>Add photos or videos</div>
            </div>
          )}
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={e=>addFiles(e.target.files)} />
        </div>
        <div style={{ padding:'10px 18px 32px', flexShrink:0, borderTop:'1px solid #f0f0f0' }}>
          <button onClick={()=>onAdd({caption:caption.trim(),location:location.trim(),latitude:coords?.lat,longitude:coords?.lng,imageFiles:files})} disabled={loading}
            style={{ width:'100%', background:loading?'#ccc':'#111', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:600, fontFamily:'Geist, sans-serif', cursor:loading?'not-allowed':'pointer' }}>
            {loading?'Posting…':'Post moment'}
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
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'20px 20px 36px', width:'100%', maxWidth:560 }}>
        <div style={{ width:36, height:4, background:'#e8e8e8', borderRadius:2, margin:'-8px auto 16px' }} />
        <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:20, marginBottom:20, display:'flex', justifyContent:'space-between' }}>New trip <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#bbb' }}>✕</button></div>
        <input type="text" value={label} onChange={e=>setLabel(e.target.value)} placeholder="e.g. Japan 2026" autoFocus style={{ width:'100%', border:'none', borderBottom:'1.5px solid #e8e8e8', padding:'8px 0', fontSize:15, fontFamily:'Geist, sans-serif', outline:'none', marginBottom:18 }} />
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
          {EMOJI_OPTIONS.map(e => <button key={e} onClick={()=>setEmoji(e)} style={{ background:emoji===e?'#111':'#f5f5f5', border:'none', borderRadius:10, width:40, height:40, fontSize:20, cursor:'pointer', transition:'all 0.1s' }}>{e}</button>)}
        </div>
        <button onClick={()=>{if(label.trim()){onAdd({label:label.trim(),emoji});onClose()}}} disabled={!label.trim()} style={{ width:'100%', background:label.trim()?'#111':'#ccc', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:600, fontFamily:'Geist, sans-serif', cursor:label.trim()?'pointer':'not-allowed' }}>Create trip</button>
      </div>
    </div>
  )
}

// ── Delete Confirm ────────────────────────────────────────────
function DeleteConfirmModal({ onClose, onConfirm, loading }) {
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:450, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'28px 24px', maxWidth:340, width:'100%', textAlign:'center' }}>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontSize:22, fontStyle:'italic', marginBottom:8 }}>Delete this moment?</div>
        <div style={{ fontSize:13, color:'#999', fontFamily:'Geist, sans-serif', marginBottom:24 }}>This permanently removes the moment and all photos.</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={onClose} style={{ flex:1, background:'#f5f5f5', border:'none', borderRadius:12, padding:'12px', fontSize:14, fontFamily:'Geist, sans-serif', cursor:'pointer', color:'#444' }}>Keep it</button>
          <button onClick={onConfirm} disabled={loading} style={{ flex:1, background:'#e53e3e', color:'#fff', border:'none', borderRadius:12, padding:'12px', fontSize:14, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', opacity:loading?0.7:1 }}>{loading?'Deleting…':'Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Members Panel ─────────────────────────────────────────────
function MembersPanel({ trips, user, onClose }) {
  const [members, setMembers] = useState([])
  const [selectedTrip, setSelectedTrip] = useState(trips.filter(t=>!t.fixed)[0]?.id??null)
  const [loading, setLoading] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')
  useEffect(() => { if(!selectedTrip)return; supabase.from('trip_members').select('*').eq('trip_id',selectedTrip).order('requested_at').then(({data})=>setMembers(data??[])) }, [selectedTrip])
  async function updateStatus(memberId,status) { setLoading(true); const m=members.find(x=>x.id===memberId); if(m){await supabase.from('trip_members').update({status}).eq('user_id',m.user_id);setMembers(ms=>ms.map(x=>x.user_id===m.user_id?{...x,status}:x))} setLoading(false) }
  async function copyInviteLink(tripId) { const{data}=await supabase.from('trips').select('invite_token').eq('id',tripId).single(); if(data?.invite_token){const l=`${window.location.origin}?join=${data.invite_token}`;try{await navigator.clipboard.writeText(l);setCopyMsg('Copied! Send this to invite someone.')}catch{setCopyMsg(l)}} }
  const pending=members.filter(m=>m.status==='pending'), approved=members.filter(m=>m.status==='approved')
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'24px 24px 0 0', padding:'20px 20px 40px', width:'100%', maxWidth:560, maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, background:'#e8e8e8', borderRadius:2, margin:'-8px auto 16px' }} />
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:20, marginBottom:16, display:'flex', justifyContent:'space-between' }}>Trip members <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#bbb' }}>✕</button></div>
        <div style={{ display:'flex', gap:8, marginBottom:16, overflowX:'auto' }}>
          {trips.filter(t=>!t.fixed).map(t => <button key={t.id} onClick={()=>{setSelectedTrip(t.id);setCopyMsg('')}} style={{ background:selectedTrip===t.id?'#111':'#f5f5f5', color:selectedTrip===t.id?'#fff':'#444', border:'none', borderRadius:100, padding:'6px 14px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>{t.emoji} {t.label}</button>)}
        </div>
        {selectedTrip && (<>
          <div style={{ background:'#fafafa', borderRadius:12, padding:'12px 16px', marginBottom:14 }}>
            <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, marginBottom:4 }}>Invite link</div>
            <div style={{ fontSize:12, color:'#999', fontFamily:'Geist, sans-serif', marginBottom:10 }}>Anyone with this link can request to join.</div>
            <button onClick={()=>copyInviteLink(selectedTrip)} style={{ background:'#111', color:'#fff', border:'none', borderRadius:8, padding:'8px 16px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Copy invite link</button>
            {copyMsg && <div style={{ marginTop:8, fontSize:12, color:'#7a9e7e', fontFamily:'Geist, sans-serif', wordBreak:'break-all' }}>{copyMsg}</div>}
          </div>
          {pending.length > 0 && <><div style={{ fontSize:11, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#999', marginBottom:8 }}>Pending ({pending.length})</div>
          {pending.map(m => <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0f0f0' }}>
            <Avatar src={m.user_avatar} name={m.user_name} size={36} />
            <div style={{ flex:1 }}><div style={{ fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600 }}>{m.user_name}</div><div style={{ fontSize:11, color:'#999', fontFamily:'Geist, sans-serif' }}>{m.user_email}</div></div>
            <button onClick={()=>updateStatus(m.id,'approved')} disabled={loading} style={{ background:'#e8f5e0', color:'#7a9e7e', border:'1px solid #c8e6c9', borderRadius:8, padding:'6px 12px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', marginRight:4 }}>Approve</button>
            <button onClick={()=>updateStatus(m.id,'rejected')} disabled={loading} style={{ background:'#fff0f0', color:'#e53e3e', border:'1px solid #ffcdd2', borderRadius:8, padding:'6px 12px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Reject</button>
          </div>)}</>}
          {approved.length > 0 && <><div style={{ fontSize:11, fontFamily:'Geist, sans-serif', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', color:'#999', margin:'14px 0 8px' }}>Members ({approved.length})</div>
          {approved.map(m => <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:'1px solid #f0f0f0' }}>
            <Avatar src={m.user_avatar} name={m.user_name} size={36} />
            <div style={{ flex:1 }}><div style={{ fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600 }}>{m.user_name}</div><div style={{ fontSize:11, color:'#999' }}>{m.user_email}</div></div>
            <div style={{ fontSize:11, background:'#e8f5e0', color:'#7a9e7e', borderRadius:100, padding:'3px 10px', fontFamily:'Geist, sans-serif', fontWeight:600 }}>✓</div>
          </div>)}</>}
          {pending.length===0&&approved.length===0 && <div style={{ textAlign:'center', padding:'24px 0', color:'#bbb', fontFamily:'Geist, sans-serif', fontSize:14, fontStyle:'italic' }}>No members yet — share the invite link!</div>}
        </>)}
      </div>
    </div>
  )
}

// ── Join Banner ───────────────────────────────────────────────
function JoinBanner({ joinState, onClose }) {
  if (!joinState) return null
  const cfg = { pending:{icon:'⏳',title:'Request sent!',sub:`Pending approval for "${joinState.trip.name}".`}, approved:{icon:'✅',title:"You're in!",sub:`You can now post to "${joinState.trip.name}".`}, rejected:{icon:'❌',title:'Not approved',sub:`Your request to join "${joinState.trip.name}" was not approved.`} }
  const c = cfg[joinState.status] ?? cfg.pending
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ background:'#fff', borderRadius:20, padding:'36px 28px', maxWidth:360, width:'100%', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>{c.icon}</div>
        <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:24, marginBottom:8 }}>{c.title}</div>
        <div style={{ fontSize:13, color:'#999', fontFamily:'Geist, sans-serif', lineHeight:1.6, marginBottom:24 }}>{c.sub}</div>
        <button onClick={onClose} style={{ background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'12px 32px', fontSize:14, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Got it</button>
      </div>
    </div>
  )
}

// ── Privacy Toggle ───────────────────────────────────────────
function PrivacyToggle({ tripId, isPrivate, onToggle, dark=false }) {
  const [loading, setLoading] = useState(false)
  async function toggle() {
    setLoading(true)
    const newVal = !isPrivate
    await supabase.from('trips').update({ is_private: newVal }).eq('id', tripId)
    onToggle(newVal)
    setLoading(false)
  }
  const textColor = dark ? 'rgba(255,255,255,0.8)' : '#666'
  const trackBg = isPrivate ? (dark ? 'rgba(255,255,255,0.3)' : '#ddd') : (dark ? 'rgba(255,255,255,0.5)' : '#ccc')
  const thumbBg = dark ? '#fff' : '#fff'
  const trackBorder = dark ? '1px solid rgba(255,255,255,0.3)' : '1px solid #ccc'
  return (
    <button onClick={toggle} disabled={loading}
      style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:7, opacity:loading?0.5:1, padding:0 }}>
      <span style={{ fontSize:11, fontFamily:'Geist, sans-serif', fontWeight:600, color:textColor, letterSpacing:'0.04em' }}>
        {isPrivate ? 'Private' : 'Public'}
      </span>
      <div style={{ width:36, height:20, borderRadius:100, background:trackBg, position:'relative', transition:'background 0.2s', border:trackBorder, flexShrink:0 }}>
        <div style={{ position:'absolute', top:2, left:isPrivate?16:2, width:14, height:14, borderRadius:'50%', background:thumbBg, transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }} />
      </div>
    </button>
  )
}

// ── Main Page ─────────────────────────────────────────────────
export function TimelinePage() {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [trips, setTrips] = useState(DEFAULT_TRIPS)
  const [activeSlug, setActiveSlug] = useState('today')
  const [activeDay, setActiveDay] = useState(null)
  const [showAddMoment, setShowAddMoment] = useState(false)
  const [showNotifPrompt, setShowNotifPrompt] = useState(false)
  const [showAddTrip, setShowAddTrip] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [menuMoment, setMenuMoment] = useState(null)
  const [deleteMoment, setDeleteMoment] = useState(null)
  const [recapDay, setRecapDay] = useState(null)
  const [showTripBook, setShowTripBook] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [galleryFiles, setGalleryFiles] = useState([])
  const [toast, setToast] = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000) }
  const joinState = useJoinRequest(trips, user, showToast)

  useEffect(() => { loadTripCovers(trips, setTrips) }, [])
  useEffect(() => {
    if (user && Notification.permission === 'default') {
      setShowNotifPrompt(true)
    } else if (user && Notification.permission === 'granted') {
      subscribeToPush(user)
    }
  }, [user])
  useEffect(() => { setActiveDay(null) }, [activeSlug])

  const activeTrip = trips.find(t => t.slug === activeSlug)
  const { moments, loading, addMoment, toggleReaction, refetch, setMoments } = useMoments(activeTrip?.id ?? null)
  const { isOnline, pendingCount, syncing, queueOrPost } = useOfflineQueue(addMoment)

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
  const visibleDays = activeDay ? [activeDay] : days

  function handleReact(momentId, emoji) { if (!user) return; toggleReaction(momentId, user.id, emoji) }

  async function handleAddMoment(payload) {
    if (!user) return
    setPosting(true)
    try {
      const result = await queueOrPost({ ...payload, userId:user.id, userName:user.user_metadata?.full_name??user.email, userAvatar:user.user_metadata?.avatar_url??null })
      setShowAddMoment(false)
      setGalleryFiles([])
      showToast(result ? 'Moment posted ✨' : 'Saved offline — will sync when connected 📶')
    }
    catch(e) { showToast('Error: '+e.message) }
    finally { setPosting(false) }
  }

  async function handleAddTrip({ label, emoji }) {
    const { data, error } = await supabase.from('trips').insert({ user_id:user.id, name:label, is_public:true }).select().single()
    if (error) { showToast('Failed'); return }
    const slug = label.toLowerCase().replace(/\s+/g,'-')+'-'+Date.now()
    setTrips(t => [...t, { id:data.id, slug, label, emoji }])
    setActiveSlug(slug)
    showToast(`${emoji} ${label} created!`)
  }

  async function handleCoverUpload(e, slug) {
    const file = e.target.files[0]; if (!file||!user) return
    const trip = trips.find(t=>t.slug===slug); if (!trip) return
    const ext = file.name.split('.').pop()
    const path = `covers/${trip.id}.${ext}`
    const { error } = await supabase.storage.from('moment-images').upload(path, file, { upsert:true })
    if (error) { showToast('Upload failed'); return }
    const { data:{ publicUrl } } = supabase.storage.from('moment-images').getPublicUrl(path)
    await supabase.from('trips').update({ cover_url:publicUrl }).eq('id', trip.id)
    setTrips(ts => ts.map(t => t.slug===slug ? {...t, cover:publicUrl} : t))
    showToast('Cover updated!')
  }

  async function handleDelete() {
    if (!deleteMoment) return
    setDeleting(true)
    const toDelete = deleteMoment
    setDeleteMoment(null)
    setMoments(ms => ms.filter(m => m.id !== toDelete.id))
    try {
      for (const img of toDelete.moment_images??[]) { const path=img.url.split('/moment-images/')[1]; if(path)await supabase.storage.from('moment-images').remove([decodeURIComponent(path)]) }
      await supabase.from('moments').delete().eq('id', toDelete.id)
      showToast('Moment deleted')
    } catch { showToast('Delete failed'); refetch() }
    finally { setDeleting(false) }
  }

  const allTabs = [...trips, UPCOMING_TAB]

  // Show welcome page when signed out
  if (!user && !loading) {
    return <WelcomePage onSignIn={signInWithGoogle} loading={false} />
  }

  return (
    <div style={{ fontFamily:'Geist, Inter, sans-serif', minHeight:'100vh', color:'#111' }}>
      <style>{`
        @keyframes meshMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        ::-webkit-scrollbar { display: none; }
        .fade-in { animation: fadeIn 0.15s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* Animated background */}
      <div style={{ position:'fixed', inset:0, zIndex:0, background:'linear-gradient(135deg, #fef9f0 0%, #fce8e8 20%, #e8f4fc 40%, #f0e8fc 60%, #e8fce8 80%, #fef9f0 100%)', backgroundSize:'500% 500%', animation:'meshMove 20s ease infinite', pointerEvents:'none' }} />

      <div style={{ position:'relative', zIndex:1 }}>

        {/* ── Header ── */}
        <header style={{ position:'sticky', top:0, zIndex:100, background:'rgba(255,255,255,0.75)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
          {/* Top bar */}
          <div style={{ padding:'0 20px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:22, color:'#111', letterSpacing:'-0.01em', fontWeight:600 }}>wanderlog</div>
            {user ? (
              <div style={{ position:'relative' }}>
                <button onClick={()=>setShowAccountMenu(m=>!m)} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:6, padding:'4px 0' }}>
                  <Avatar src={user.user_metadata?.avatar_url} name={user.email} size={30} />
                  <span style={{ color:'#aaa', fontSize:10 }}>{showAccountMenu?'▲':'▼'}</span>
                </button>
                {showAccountMenu && (<>
                  <div onClick={()=>setShowAccountMenu(false)} style={{ position:'fixed', inset:0, zIndex:98 }} />
                  <div style={{ position:'absolute', top:42, right:0, background:'rgba(255,255,255,0.96)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:14, minWidth:180, boxShadow:'0 8px 32px rgba(0,0,0,0.12)', zIndex:99, overflow:'hidden', backdropFilter:'blur(12px)' }}>
                    <div style={{ padding:'12px 14px', borderBottom:'1px solid #f0f0f0' }}>
                      <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, color:'#111' }}>{user.user_metadata?.full_name??'Traveller'}</div>
                      <div style={{ fontSize:11, color:'#aaa', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.email}</div>
                    </div>
                    <button onClick={()=>{setShowDocs(true);setShowAccountMenu(false)}} style={{ width:'100%', background:'none', border:'none', padding:'11px 14px', color:'#333', fontFamily:'Geist, sans-serif', fontSize:13, textAlign:'left', cursor:'pointer', borderBottom:'1px solid #f5f5f5' }}>Travel Documents</button>
                    {user.email===ADMIN_EMAIL && <button onClick={()=>{setShowMembers(true);setShowAccountMenu(false)}} style={{ width:'100%', background:'none', border:'none', padding:'11px 14px', color:'#333', fontFamily:'Geist, sans-serif', fontSize:13, textAlign:'left', cursor:'pointer' }}>Members</button>}
                    <button onClick={()=>{signOut();setShowAccountMenu(false)}} style={{ width:'100%', background:'none', border:'none', padding:'11px 14px', color:'#e53e3e', fontFamily:'Geist, sans-serif', fontSize:13, textAlign:'left', cursor:'pointer' }}>Sign out</button>
                  </div>
                </>)}
              </div>
            ) : (
              <button onClick={signInWithGoogle} style={{ background:'#111', color:'#fff', border:'none', borderRadius:100, padding:'8px 18px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Sign in with Google</button>
            )}
          </div>

          {/* Tab bar — colorful pills like Config Timeline */}
          <div className='slide-down' style={{ display:'flex', overflowX:'auto', scrollbarWidth:'none', padding:'0 16px 10px', gap:8 }}>
            {allTabs.map((tab, idx) => {
              const isActive = activeSlug === tab.slug
              const color = tab.slug === 'today' ? '#FF6B6B' : tab.slug === 'upcoming' ? '#8395A7' : dayColor(idx + 1)
              return (
                <button key={tab.slug} onClick={()=>setActiveSlug(tab.slug)}
                  style={{ background:isActive?color:`${color}20`, color:isActive?'#fff':color, border:`2px solid ${color}`, borderRadius:100, padding:'6px 16px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s', boxShadow:isActive?`0 3px 14px ${color}55`:'none' }}>
                  {tab.emoji} {tab.label}
                </button>
              )
            })}
            {user && <button onClick={()=>setShowAddTrip(true)} style={{ background:'transparent', border:'2px dashed #ddd', borderRadius:100, padding:'6px 14px', fontSize:13, color:'#aaa', cursor:'pointer', flexShrink:0, fontFamily:'Geist, sans-serif', fontWeight:600 }}>＋ Trip</button>}
          </div>
        </header>

        {/* ── Offline banner ── */}
        {!isOnline && (
          <div className='slide-down' style={{ background:'#1a1a1a', color:'#fff', padding:'8px 16px', fontSize:12, fontFamily:'Geist, sans-serif', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#FF6B6B', display:'inline-block', flexShrink:0 }} />
            You're offline — moments will sync when connected
            {pendingCount > 0 && <span style={{ background:'rgba(255,255,255,0.15)', borderRadius:100, padding:'1px 8px', fontSize:11 }}>{pendingCount} pending</span>}
          </div>
        )}
        {isOnline && syncing && (
          <div style={{ background:'#1DD1A1', color:'#fff', padding:'7px 16px', fontSize:12, fontFamily:'Geist, sans-serif', textAlign:'center' }}>
            ↑ Syncing offline moments…
          </div>
        )}
        {isOnline && !syncing && pendingCount > 0 && (
          <div style={{ background:'#54A0FF', color:'#fff', padding:'7px 16px', fontSize:12, fontFamily:'Geist, sans-serif', textAlign:'center' }}>
            ✓ {pendingCount} moment{pendingCount>1?'s':''} synced!
          </div>
        )}

        {/* ── Upcoming ── */}
        {activeSlug === 'upcoming' && (
          <div style={{ maxWidth:560, margin:'0 auto', padding:'52px 20px', textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🗺️</div>
            <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:26, marginBottom:8 }}>More trips coming</div>
            <div style={{ fontSize:14, color:'#888', fontFamily:'Geist, sans-serif', marginBottom:32 }}>Future adventures will appear here.</div>
            {user && <button onClick={()=>setShowAddTrip(true)} style={{ background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'12px 28px', fontSize:14, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>+ Add a trip</button>}
          </div>
        )}

        {/* ── Feed ── */}
        {activeSlug !== 'upcoming' && (
          <div className="fade-up" style={{ maxWidth:560, margin:'0 auto', padding:'0 14px 100px' }}
            onTouchStart={e=>{window._swX=e.touches[0].clientX}}
            onTouchEnd={e=>{const d=window._swX-e.changedTouches[0].clientX;const slugs=[...trips.map(t=>t.slug),'upcoming'];const idx=slugs.indexOf(activeSlug);if(d>60&&idx<slugs.length-1)setActiveSlug(slugs[idx+1]);if(d<-60&&idx>0)setActiveSlug(slugs[idx-1])}}>

            {/* Trip hero */}
            {activeSlug === 'today' ? (
              <div className='fade-up' style={{ padding:'20px 0 12px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize:11, color:'#aaa', fontFamily:'Geist, sans-serif', letterSpacing:'0.1em', textTransform:'uppercase' }}>{format(new Date(),'EEEE, MMMM d')}</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:28, color:'#111', marginTop:2 }}>Today's Moments</div>
              </div>
            ) : activeTrip?.cover ? (
              <div style={{ position:'relative', height:180, overflow:'hidden', margin:'0 -14px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                <img src={activeTrip.cover} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65))' }} />
                <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'14px 18px', display:'flex', alignItems:'flex-end', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:24, color:'#fff' }}>{activeTrip.emoji} {activeTrip.label}</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'Geist, sans-serif' }}>{visibleMoments.length} moments</div>
                  </div>
                  {user && (
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <PrivacyToggle tripId={activeTrip.id} isPrivate={activeTrip.isPrivate} onToggle={priv=>setTrips(ts=>ts.map(t=>t.id===activeTrip.id?{...t,isPrivate:priv}:t))} dark={true} />
                      <label style={{ background:'rgba(255,255,255,0.15)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:8, padding:'6px 12px', fontSize:11, fontFamily:'Geist, sans-serif', color:'#fff', cursor:'pointer', backdropFilter:'blur(8px)' }}>Change cover<input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleCoverUpload(e,activeSlug)} /></label>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ padding:'20px 0 12px', borderBottom:'1px solid rgba(0,0,0,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:26, color:'#111' }}>{activeTrip?.emoji} {activeTrip?.label}</div>
                {user && (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <PrivacyToggle tripId={activeTrip.id} isPrivate={activeTrip.isPrivate} onToggle={priv=>setTrips(ts=>ts.map(t=>t.id===activeTrip.id?{...t,isPrivate:priv}:t))} />
                    <label style={{ background:'#f5f5f5', border:'1px solid #e8e8e8', borderRadius:8, padding:'6px 12px', fontSize:11, fontFamily:'Geist, sans-serif', color:'#888', cursor:'pointer' }}>Add cover<input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>handleCoverUpload(e,activeSlug)} /></label>
                  </div>
                )}
              </div>
            )}

            {/* Day pills */}
            {days.length > 0 && (
              <div className='fade-up' style={{ display:'flex', gap:8, padding:'12px 0 4px', overflowX:'auto', scrollbarWidth:'none' }}>
                {days.map((day, idx) => {
                  const color = dayColor(idx)
                  const isActive = activeDay === day
                  return (
                    <button key={day} onClick={()=>setActiveDay(activeDay===day?null:day)}
                      style={{ background:isActive?color:`${color}20`, color:isActive?'#fff':color, border:`2px solid ${color}`, borderRadius:100, padding:'5px 14px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s', boxShadow:isActive?`0 2px 10px ${color}55`:'none' }}>
                      {day} <span style={{ background:isActive?'rgba(255,255,255,0.25)':`${color}30`, borderRadius:100, padding:'1px 6px', fontSize:10, fontWeight:800, marginLeft:2 }}>{grouped[day]?.length}</span>
                    </button>
                  )
                })}
                {activeSlug !== 'today' && visibleMoments.length > 0 && (
                  <button onClick={()=>setShowTripBook(true)} style={{ background:'rgba(0,0,0,0.06)', border:'1.5px solid rgba(0,0,0,0.1)', borderRadius:100, padding:'5px 14px', fontSize:12, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap', color:'#555', flexShrink:0, marginLeft:4 }}>Trip book</button>
                )}
              </div>
            )}

            {/* Privacy gate */}
            {activeTrip && activeTrip.isPrivate && !user && (
              <div style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ fontSize:44, marginBottom:12 }}>🔒</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:22, marginBottom:8 }}>This trip is private</div>
                <div style={{ fontSize:13, color:'#aaa', fontFamily:'Geist, sans-serif', marginBottom:20 }}>Sign in to view this trip.</div>
                <button onClick={signInWithGoogle} style={{ background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'11px 28px', fontSize:14, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Sign in with Google</button>
              </div>
            )}

            {/* Moments */}
            {!(activeTrip && activeTrip.isPrivate && !user) && (loading ? (
              <div style={{ textAlign:'center', padding:'60px 0', color:'#bbb', fontFamily:'Geist, sans-serif', fontStyle:'italic' }}>Loading…</div>
            ) : visibleMoments.length === 0 ? (
              <div className='fade-up' style={{ textAlign:'center', padding:'60px 20px' }}>
                <div style={{ fontSize:44, marginBottom:12, animation:'float 3s ease-in-out infinite' }}>{activeTrip?.emoji??'✈️'}</div>
                <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:22, marginBottom:6 }}>{activeSlug==='today'?'Nothing yet today':'No moments yet'}</div>
                <div style={{ fontSize:13, color:'#aaa', fontFamily:'Geist, sans-serif' }}>Tap the camera to post your first moment</div>

              </div>
            ) : (
              visibleDays.map((day, idx) => {
                const color = dayColor(activeDay ? days.indexOf(day) : idx)
                return (
                  <div key={day} className='fade-up' style={{ animationDelay:`${idx * 0.1}s` }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'18px 0 10px' }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Geist, sans-serif', fontWeight:800, fontSize:14, flexShrink:0, boxShadow:`0 2px 8px ${color}55` }}>{day.split(' ')[1]}</div>
                      <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:20, color:'#111', fontWeight:600 }}>{day}</div>
                      <div style={{ flex:1, height:1, background:'rgba(0,0,0,0.06)' }} />
                      <button onClick={()=>setRecapDay(day)} style={{ background:`${color}18`, color, border:`1.5px solid ${color}44`, borderRadius:100, padding:'3px 12px', fontSize:11, fontFamily:'Geist, sans-serif', fontWeight:700, cursor:'pointer' }}>Recap</button>
                    </div>
                    {grouped[day].map((m, cardIdx) => <MomentCard key={m.id} moment={m} user={user} onReact={handleReact} onMenuOpen={setMenuMoment} cardIdx={cardIdx} />)}
                  </div>
                )
              })
            ))}
          </div>
        )}

        {/* ── FABs ── */}
        {user && activeSlug !== 'upcoming' && (
          <div style={{ position:'fixed', bottom:32, right:22, zIndex:200, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
            <label style={{ width:42, height:42, borderRadius:'50%', background:'rgba(13,13,13,0.85)', border:'1.5px solid rgba(245,200,66,0.35)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:'0 2px 14px rgba(0,0,0,0.2)', backdropFilter:'blur(8px)', transition:'transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="#F5C842" stroke="none"/><polyline points="21 15 16 10 5 21"/></svg>
              <input type="file" multiple accept="image/*,video/*" style={{ display:'none' }} onChange={e=>{const p=Array.from(e.target.files);if(!p.length)return;setGalleryFiles(p);setShowAddMoment(true)}} />
            </label>
            <label style={{ width:58, height:58, borderRadius:'50%', background:'rgba(13,13,13,0.9)', border:'2px solid #F5C842', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', boxShadow:`0 4px 24px rgba(0,0,0,0.3), 0 0 0 5px rgba(245,248,240,0.9)`, backdropFilter:'blur(8px)', transition:'transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e=>e.currentTarget.style.transform='scale(1.08)'} onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F5C842" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" accept="image/*,video/*" capture="environment" style={{ display:'none' }} onChange={e=>{const p=Array.from(e.target.files);if(!p.length)return;setGalleryFiles(p);setShowAddMoment(true)}} />
            </label>
          </div>
        )}

        {/* ── Notification prompt ── */}
        {showNotifPrompt && (
          <div style={{ position:'fixed', bottom:100, left:'50%', transform:'translateX(-50%)', background:'#fff', borderRadius:16, padding:'16px 20px', boxShadow:'0 8px 32px rgba(0,0,0,0.15)', zIndex:300, maxWidth:320, width:'calc(100% - 32px)' }}>
            <div style={{ fontFamily:'Geist, sans-serif', fontWeight:600, fontSize:14, color:'#111', marginBottom:4 }}>🔔 Stay in the loop</div>
            <div style={{ fontFamily:'Geist, sans-serif', fontSize:13, color:'#888', marginBottom:14 }}>Get notified when family members post new moments.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>setShowNotifPrompt(false)} style={{ flex:1, background:'#f5f5f5', border:'none', borderRadius:10, padding:'10px', fontSize:13, fontFamily:'Geist, sans-serif', cursor:'pointer', color:'#888' }}>Not now</button>
              <button onClick={()=>{ subscribeToPush(user); setShowNotifPrompt(false) }} style={{ flex:2, background:'#111', color:'#fff', border:'none', borderRadius:10, padding:'10px', fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:600, cursor:'pointer' }}>Enable notifications</button>
            </div>
          </div>
        )}

        {/* ── Modals ── */}
        {showAddMoment && <AddMomentModal onClose={()=>{setShowAddMoment(false);setGalleryFiles([])}} onAdd={handleAddMoment} loading={posting} initialFiles={galleryFiles} key={galleryFiles.length+'-'+showAddMoment} />}
        {showAddTrip && <AddTripModal onClose={()=>setShowAddTrip(false)} onAdd={handleAddTrip} />}
        {showMembers && <MembersPanel trips={trips} user={user} onClose={()=>setShowMembers(false)} />}
        {menuMoment && <MomentMenu moment={menuMoment} user={user} onDelete={m=>{setMenuMoment(null);setDeleteMoment(m)}} onClose={()=>setMenuMoment(null)} />}
        {deleteMoment && <DeleteConfirmModal onClose={()=>setDeleteMoment(null)} onConfirm={handleDelete} loading={deleting} />}
        {recapDay && <DayRecap day={recapDay} moments={grouped[recapDay]??[]} tripName={activeTrip?.label??'Trip'} tripEmoji={activeTrip?.emoji??'✈️'} onClose={()=>setRecapDay(null)} />}
        {showTripBook && <TripBook moments={visibleMoments} tripName={activeTrip?.label??'Trip'} tripEmoji={activeTrip?.emoji??'✈️'} onClose={()=>setShowTripBook(false)} />}
        {joinState && <JoinBanner joinState={joinState} onClose={()=>window.location.reload()} />}
        {showDocs && <TravelDocs user={user} onClose={()=>setShowDocs(false)} />}

        {/* ── Toast ── */}
        {toast && <div style={{ position:'fixed', top:66, left:'50%', transform:'translateX(-50%)', background:'rgba(13,13,13,0.9)', color:'#fff', padding:'10px 20px', borderRadius:100, fontSize:13, fontFamily:'Geist, sans-serif', fontWeight:500, zIndex:500, whiteSpace:'nowrap', boxShadow:'0 4px 20px rgba(0,0,0,0.2)', backdropFilter:'blur(8px)' }}>{toast}</div>}

      </div>
    </div>
  )
}
