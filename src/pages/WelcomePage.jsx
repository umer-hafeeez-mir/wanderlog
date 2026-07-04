import { useState } from 'react'

const DAY_COLORS = ['#FF6B6B','#FF9F43','#FECA57','#1DD1A1','#48DBFB','#FF9FF3','#54A0FF']

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
        {[
          { label:'Today', color:'#FF6B6B', top:'12%', left:'8%', delay:'0s' },
          { label:'Istanbul', color:'#FF9F43', top:'18%', right:'10%', delay:'1.5s' },
          { label:'Cappadocia', color:'#1DD1A1', top:'55%', left:'5%', delay:'0.8s' },
          { label:'Jul 13', color:'#54A0FF', bottom:'28%', right:'8%', delay:'2s' },
          { label:'Family', color:'#FF9FF3', bottom:'18%', left:'12%', delay:'1.2s' },
        ].map((p, i) => (
          <div key={i} style={{ position:'absolute', top:p.top, bottom:p.bottom, left:p.left, right:p.right, background:`${p.color}22`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'6px 14px', fontSize:13, fontWeight:700, animation:`float 4s ease-in-out ${p.delay} infinite`, opacity:0.7, whiteSpace:'nowrap' }}>
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
            Your family's travel journal
          </div>
        </div>

        {/* Sample moments preview */}
        <div style={{ animation:'fadeUp 0.6s ease both', animationDelay:'0.3s', margin:'48px 0', display:'flex', flexDirection:'column', gap:10, width:'100%', maxWidth:320 }}>
          {[
            { name:'Umer', time:'2:36 PM · Istanbul, Turkey', caption:'First look at the Bosphorus 🌊', color:'#FF6B6B', img:'🕌' },
            { name:'Ayaan', time:'4:12 PM · Cappadocia', caption:'Hot air balloon ride!!!', color:'#FF9F43', img:'🎈' },
          ].map((m, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,0.85)', borderRadius:16, padding:'12px 14px', boxShadow:'0 2px 12px rgba(0,0,0,0.06)', textAlign:'left', backdropFilter:'blur(8px)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{m.img}</div>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, fontFamily:'Geist, sans-serif', color:'#111' }}>{m.name}</div>
                  <div style={{ fontSize:10, color:'#aaa', fontFamily:'Geist, sans-serif' }}>{m.time}</div>
                </div>
              </div>
              <div style={{ fontSize:13, fontFamily:'Geist, sans-serif', color:'#333' }}>{m.caption}</div>
            </div>
          ))}
        </div>

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
        wanderlog · your family travel journal
      </div>
    </div>
  )
}
