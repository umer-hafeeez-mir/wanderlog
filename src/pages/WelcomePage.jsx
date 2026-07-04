import { useState, useEffect } from 'react'

const DAY_COLORS = ['#FF6B6B','#FF9F43','#FECA57','#1DD1A1','#48DBFB','#FF9FF3','#54A0FF']

const ALL_MOMENTS = [
  { name:'Umer', color:'#FF6B6B', emoji:'🕌', caption:'First look at the Bosphorus. Worth every penny. 🌊' },
  { name:'Sarah', color:'#54A0FF', emoji:'🎈', caption:'balloooon!! so many colours!! i want to go again 🎈🎈🎈' },
  { name:'Adil', color:'#1DD1A1', emoji:'🍜', caption:'Found the best kebab spot. Dad owes me 20 lira 😤' },
  { name:'Mom', color:'#FF9FF3', emoji:'🛍️', caption:'The Grand Bazaar has everything. EVERYTHING. 👀' },
  { name:'Dad', color:'#EE5A24', emoji:'🤌', caption:'This tea is better than anything back home. Period.' },
  { name:'Iesa', color:'#FECA57', emoji:'⚽', caption:'played football with turkish kids. scored twice. i am better than mbappe 🏆⚽' },
  { name:'Anas', color:'#5F27CD', emoji:'😤', caption:'iesa took my toy and i said NOOO and papa said calm down 😤' },
  { name:'Shifa', color:'#48DBFB', emoji:'🌊', caption:'Bosphorus cruise was 10/10. Highly recommend the sunset 🌅' },
  { name:'Saba', color:'#FF9F43', emoji:'🧿', caption:'Bought 47 evil eyes. They are all for me. No returns.' },
]

function AnimatedMoments() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % ALL_MOMENTS.length)
        setVisible(true)
      }, 300)
    }, 2800)
    return () => clearInterval(interval)
  }, [])

  const m = ALL_MOMENTS[index]
  const prev = ALL_MOMENTS[(index - 1 + ALL_MOMENTS.length) % ALL_MOMENTS.length]

  return (
    <div style={{ margin:'36px 0', width:'100%', maxWidth:320, display:'flex', flexDirection:'column', gap:10 }}>
      <style>{`
        @keyframes momentIn { from{opacity:0;transform:translateY(8px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes momentOut { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-8px)} }
        .moment-visible { animation: momentIn 0.3s ease both; }
        .moment-hidden { animation: momentOut 0.3s ease both; }
      `}</style>

      {/* Previous card — static, slightly faded */}
      <div style={{ background:'rgba(255,255,255,0.6)', borderRadius:16, padding:'11px 14px', boxShadow:'0 1px 8px rgba(0,0,0,0.04)', textAlign:'left', backdropFilter:'blur(8px)', opacity:0.5, transform:'scale(0.97)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:prev.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0 }}>{prev.emoji}</div>
          <div style={{ fontSize:12, fontWeight:700, fontFamily:'Geist, sans-serif', color:'#111' }}>{prev.name}</div>
        </div>
        <div style={{ fontSize:12, fontFamily:'Geist, sans-serif', color:'#555' }}>{prev.caption}</div>
      </div>

      {/* Active card — animated */}
      <div className={visible ? 'moment-visible' : 'moment-hidden'}
        style={{ background:'rgba(255,255,255,0.92)', borderRadius:16, padding:'12px 14px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', textAlign:'left', backdropFilter:'blur(8px)', border:`1px solid ${m.color}33` }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:30, height:30, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{m.emoji}</div>
          <div>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:'Geist, sans-serif', color:'#111' }}>{m.name}</div>
            <div style={{ fontSize:10, color:'#aaa', fontFamily:'Geist, sans-serif' }}>just now</div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:10, background:`${m.color}22`, color:m.color, borderRadius:100, padding:'2px 8px', fontFamily:'Geist, sans-serif', fontWeight:700 }}>❤️ {Math.floor(Math.random()*8)+1}</div>
        </div>
        <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', color:'#222', lineHeight:1.5 }}>{m.caption}</div>
      </div>

      {/* Dots indicator */}
      <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:4 }}>
        {ALL_MOMENTS.map((_, i) => (
          <div key={i} style={{ width: i===index ? 16 : 5, height:5, borderRadius:100, background: i===index ? m.color : '#ddd', transition:'all 0.3s ease' }} />
        ))}
      </div>
    </div>
  )
}

export function WelcomePage({ onSignIn, loading }) {
  const [pressed, setPressed] = useState(false)

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', position:'relative', overflow:'hidden', fontFamily:'Geist, Inter, sans-serif' }}>
      <style>{`
        @keyframes meshMove { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=Geist:wght@300;400;500;600;700&display=swap');
      `}</style>

      {/* Animated background */}
      <div style={{ position:'fixed', inset:0, zIndex:0, background:'linear-gradient(135deg, #fef9f0 0%, #fce8e8 20%, #e8f4fc 45%, #f0e8fc 70%, #e8fce8 100%)', backgroundSize:'500% 500%', animation:'meshMove 20s ease infinite' }} />

      {/* Floating day pills — decorative */}
      <div style={{ position:'fixed', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden' }}>
        {/* Top row — above center content */}
        {[
          { label:'Umer', color:'#FF6B6B', top:'4%', left:'4%', delay:'0s' },
          { label:'Mom', color:'#FF9FF3', top:'4%', left:'28%', delay:'0.4s' },
          { label:'Istanbul 🕌', color:'#FF9F43', top:'4%', left:'52%', delay:'0.8s' },
          { label:'Sarah', color:'#54A0FF', top:'4%', right:'4%', delay:'1.2s' },
        ].map((p, i) => (
          <div key={'t'+i} style={{ position:'absolute', top:p.top, left:p.left, right:p.right, background:`${p.color}22`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'5px 12px', fontSize:12, fontWeight:700, animation:`float ${3.5+i*0.4}s ease-in-out ${p.delay} infinite`, opacity:0.75, whiteSpace:'nowrap', transform:'translateX(0)' }}>
            {p.label}
          </div>
        ))}
        {/* Bottom row — below center content */}
        {[
          { label:'Adil', color:'#1DD1A1', bottom:'10%', left:'4%', delay:'0.8s' },
          { label:'Dad', color:'#EE5A24', bottom:'10%', left:'26%', delay:'1.1s' },
          { label:'Cappadocia 🎈', color:'#FECA57', bottom:'10%', left:'44%', delay:'1.5s' },
          { label:'Iesa', color:'#FF9FF3', bottom:'10%', right:'4%', delay:'0.3s' },
        ].map((p, i) => (
          <div key={'b'+i} style={{ position:'absolute', bottom:p.bottom, left:p.left, right:p.right, background:`${p.color}22`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'5px 12px', fontSize:12, fontWeight:700, animation:`float ${3.8+i*0.5}s ease-in-out ${p.delay} infinite`, opacity:0.75, whiteSpace:'nowrap' }}>
            {p.label}
          </div>
        ))}
        {/* Left column */}
        {[
          { label:'Anas', color:'#5F27CD', top:'22%', left:'2%', delay:'2s' },
          { label:'Shifa', color:'#EE5A24', top:'74%', left:'2%', delay:'1.1s' },
        ].map((p, i) => (
          <div key={'l'+i} style={{ position:'absolute', top:p.top, left:p.left, background:`${p.color}22`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'5px 12px', fontSize:12, fontWeight:700, animation:`float ${4+i*0.3}s ease-in-out ${p.delay} infinite`, opacity:0.75, whiteSpace:'nowrap' }}>
            {p.label}
          </div>
        ))}
        {/* Right column */}
        {[
          { label:'Saba', color:'#48DBFB', top:'22%', right:'2%', delay:'1.7s' },
          { label:'Turkey 🇹🇷', color:'#FF6B6B', top:'74%', right:'2%', delay:'0.9s' },
        ].map((p, i) => (
          <div key={'r'+i} style={{ position:'absolute', top:p.top, right:p.right, background:`${p.color}22`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'5px 12px', fontSize:12, fontWeight:700, animation:`float ${3.6+i*0.4}s ease-in-out ${p.delay} infinite`, opacity:0.75, whiteSpace:'nowrap' }}>
            {p.label}
          </div>
        ))}
      </div>

      {/* Content */}
      <div style={{ position:'relative', zIndex:2, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'40px 24px', textAlign:'center' }}>

        {/* Logo */}
        <div style={{ animation:'fadeUp 0.6s ease both', animationDelay:'0.1s' }}>
          <div style={{ fontFamily:'Cormorant Garamond, Georgia, serif', fontStyle:'italic', fontSize:48, fontWeight:600, color:'#111', letterSpacing:'-0.02em', lineHeight:1 }}>
            wanderlog
          </div>
          <div style={{ fontSize:14, color:'#888', fontFamily:'Geist, sans-serif', fontWeight:400, marginTop:6, letterSpacing:'0.02em' }}>
            Our family's journal
          </div>
        </div>

        {/* Rotating family moments */}
        <AnimatedMoments />

        {/* CTA */}
        <div style={{ animation:'fadeUp 0.6s ease both', animationDelay:'0.5s', width:'100%', maxWidth:320 }}>
          <button
            onClick={() => { setPressed(true); onSignIn() }}
            disabled={loading || pressed}
            style={{
              width:'100%', background:'#111', color:'#fff', border:'none', borderRadius:14, padding:'16px', fontSize:16, fontFamily:'Geist, sans-serif', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:12, transition:'all 0.2s', opacity: loading || pressed ? 0.7 : 1, boxShadow:'0 4px 20px rgba(0,0,0,0.2)'
            }}>
            {/* Google G */}
            {!loading && !pressed && (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading || pressed ? 'Signing in…' : 'Continue with Google'}
          </button>

          <div style={{ marginTop:14, fontSize:12, color:'#bbb', fontFamily:'Geist, sans-serif', lineHeight:1.6 }}>
            Private family memories, safely stored.<br/>Sign in to view or post moments.
          </div>
        </div>
      </div>

      {/* Bottom wordmark */}
      <div style={{ position:'relative', zIndex:2, textAlign:'center', padding:'16px', color:'#ccc', fontFamily:'Geist, sans-serif', fontSize:11 }}>
        wanderlog · our family's journal
      </div>
    </div>
  )
}
