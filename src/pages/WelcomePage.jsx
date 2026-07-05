import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function WelcomePage({ onSignIn }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('home')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOTP() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '')
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) setError(error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function verifyOTP() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g, '')
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    if (error) setError(error.message)
    setLoading(false)
  }

  const Bg = () => (
    <>
      <div style={{ position:'fixed', inset:0, zIndex:0, background:'linear-gradient(135deg,#fef9f0,#fce8e8 18%,#e8f4fc 38%,#f0e8fc 58%,#e8fce8)', backgroundSize:'500% 500%', animation:'meshMove 22s ease infinite', pointerEvents:'none' }} />
      <div style={{ position:'fixed', inset:0, zIndex:1, pointerEvents:'none', overflow:'hidden' }}>
        {[
          { label:'Umer', color:'#FF6B6B', top:'4%', left:'4%', delay:'0s' },
          { label:'Mom', color:'#FF9FF3', top:'4%', left:'28%', delay:'0.4s' },
          { label:'Istanbul 🕌', color:'#FF9F43', top:'4%', left:'52%', delay:'0.8s' },
          { label:'Sarah', color:'#54A0FF', top:'4%', right:'4%', delay:'1.2s' },
          { label:'Anas', color:'#5F27CD', top:'22%', left:'2%', delay:'2s' },
          { label:'Saba', color:'#48DBFB', top:'22%', right:'2%', delay:'1.7s' },
          { label:'Shifa', color:'#EE5A24', top:'74%', left:'2%', delay:'1.1s' },
          { label:'Turkey 🇹🇷', color:'#FF6B6B', top:'74%', right:'2%', delay:'0.9s' },
          { label:'Adil', color:'#1DD1A1', bottom:'10%', left:'4%', delay:'0.8s' },
          { label:'Dad', color:'#EE5A24', bottom:'10%', left:'26%', delay:'1.1s' },
          { label:'Cappadocia 🎈', color:'#FECA57', bottom:'10%', left:'44%', delay:'1.5s' },
          { label:'Iesa', color:'#FF9FF3', bottom:'10%', right:'4%', delay:'0.3s' },
        ].map((p, i) => (
          <div key={i} style={{ position:'absolute', top:p.top, bottom:p.bottom, left:p.left, right:p.right, background:`${p.color}20`, color:p.color, border:`2px solid ${p.color}`, borderRadius:100, padding:'5px 12px', fontSize:12, fontWeight:700, animation:`float ${3.5+i*0.3}s ease-in-out ${p.delay} infinite`, opacity:0.75, whiteSpace:'nowrap', fontFamily:'Geist, sans-serif' }}>
            {p.label}
          </div>
        ))}
      </div>
    </>
  )

  // ── OTP verification screen ────────────────────────────────
  if (step === 'otp') {
    return (
      <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', fontFamily:'Geist, sans-serif', position:'relative', overflow:'hidden' }}>
        <style>{`@keyframes meshMove{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <Bg />
        <div style={{ position:'relative', zIndex:2, maxWidth:320, width:'100%', textAlign:'center', animation:'fadeUp 0.4s ease both' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:28, color:'#111', marginBottom:6 }}>Check your messages</div>
          <div style={{ fontSize:14, color:'#888', marginBottom:24 }}>Code sent to <strong>{phone}</strong></div>
          <div style={{ background:'rgba(255,255,255,0.9)', borderRadius:20, padding:'20px', backdropFilter:'blur(8px)', boxShadow:'0 4px 20px rgba(0,0,0,0.08)' }}>
            <input type="number" value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" maxLength={6} autoFocus
              style={{ width:'100%', border:'1.5px solid #e8e8e8', borderRadius:12, padding:'14px', fontSize:24, fontFamily:'Geist, sans-serif', outline:'none', background:'#fff', textAlign:'center', letterSpacing:'0.3em', marginBottom:12, boxSizing:'border-box' }} />
            <button onClick={verifyOTP} disabled={loading || otp.length < 6}
              style={{ width:'100%', background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer', opacity:loading||otp.length<6?0.5:1, marginBottom:8 }}>
              {loading ? 'Verifying…' : 'Verify & Sign in'}
            </button>
            {error && <div style={{ fontSize:12, color:'#e53e3e', marginBottom:8 }}>{error}</div>}
            <button onClick={() => { setStep('home'); setOtp(''); setError('') }}
              style={{ background:'none', border:'none', color:'#bbb', fontSize:13, cursor:'pointer', fontFamily:'Geist, sans-serif' }}>← Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main welcome screen ────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', fontFamily:'Geist, sans-serif', position:'relative', overflow:'hidden' }}>
      <style>{`@keyframes meshMove{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=Geist:wght@300;400;500;600;700&display=swap');`}</style>
      <Bg />
      <div style={{ position:'relative', zIndex:2, maxWidth:320, width:'100%', textAlign:'center' }}>
        <div style={{ animation:'fadeUp 0.5s ease both' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:48, fontWeight:600, color:'#111', lineHeight:1 }}>wanderlog</div>
          <div style={{ fontSize:14, color:'#888', marginTop:6 }}>Our family's journal</div>
        </div>

        <AnimatedMoments />

        <div style={{ marginTop:8, animation:'fadeUp 0.5s ease 0.5s both' }}>
          <button onClick={onSignIn}
            style={{ width:'100%', background:'#111', color:'#fff', border:'none', borderRadius:14, padding:'15px', fontSize:15, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:12, boxShadow:'0 4px 20px rgba(0,0,0,0.15)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:12, margin:'4px 0 12px' }}>
            <div style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />
            <span style={{ fontSize:12, color:'#bbb' }}>or</span>
            <div style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />
          </div>

          <div style={{ background:'rgba(255,255,255,0.85)', borderRadius:16, padding:'16px', backdropFilter:'blur(8px)', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <div style={{ fontSize:12, fontWeight:600, color:'#333', textAlign:'left' }}>Sign in with WhatsApp number</div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                style={{ flex:1, border:'1.5px solid #e8e8e8', borderRadius:10, padding:'11px 12px', fontSize:14, fontFamily:'Geist, sans-serif', outline:'none', background:'#fff' }} />
              <button onClick={sendOTP} disabled={loading || !phone.trim()}
                style={{ background:'#25D366', color:'#fff', border:'none', borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, opacity:loading||!phone.trim()?0.5:1 }}>
                {loading ? '…' : 'Send'}
              </button>
            </div>
            {error && <div style={{ fontSize:12, color:'#e53e3e', marginTop:8 }}>{error}</div>}
            <div style={{ fontSize:11, color:'#bbb', marginTop:6, textAlign:'left' }}>We'll send a 6-digit code to your number</div>
          </div>
        </div>

        <div style={{ marginTop:16, fontSize:11, color:'#ccc' }}>wanderlog · our family's journal</div>
      </div>
    </div>
  )
}

const ALL_MOMENTS = [
  { name:'Umer', color:'#FF6B6B', emoji:'🕌', caption:'First look at the Bosphorus. Worth every penny. 🌊' },
  { name:'Sarah', color:'#54A0FF', emoji:'🎈', caption:'the hot air balloon had so many colours!! i want to go again 🎈🎈🎈' },
  { name:'Adil', color:'#1DD1A1', emoji:'🍜', caption:'Found the best kebab spot. Dad owes me 20 lira 😤' },
  { name:'Mom', color:'#FF9FF3', emoji:'🛍️', caption:'The Grand Bazaar has everything. EVERYTHING. 👀' },
  { name:'Dad', color:'#EE5A24', emoji:'☕', caption:'This tea is better than anything back home. Period.' },
  { name:'Iesa', color:'#FECA57', emoji:'⚽', caption:'played football with turkish kids. scored twice. i am better than mbappe 🏆⚽' },
  { name:'Anas', color:'#5F27CD', emoji:'😤', caption:'iesa took my toy and i said NOOO and papa said calm down 😤' },
  { name:'Shifa', color:'#48DBFB', emoji:'🌊', caption:'Bosphorus cruise was 10/10. Highly recommend the sunset 🌅' },
  { name:'Saba', color:'#FF9F43', emoji:'🧿', caption:'Bought 47 evil eyes. They are all for me. No returns.' },
]

function AnimatedMoments() {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex(i => (i+1) % ALL_MOMENTS.length); setVisible(true) }, 300)
    }, 2800)
    return () => clearInterval(t)
  }, [])
  const m = ALL_MOMENTS[index]
  const prev = ALL_MOMENTS[(index - 1 + ALL_MOMENTS.length) % ALL_MOMENTS.length]
  return (
    <div style={{ margin:'32px 0 24px', width:'100%' }}>
      <style>{`.m-in{animation:fadeUp 0.3s ease both}.m-out{animation:fadeDown 0.3s ease both}@keyframes fadeDown{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-8px)}}`}</style>
      <div style={{ background:'rgba(255,255,255,0.5)', borderRadius:14, padding:'10px 12px', marginBottom:8, opacity:0.45, transform:'scale(0.96)', textAlign:'left' }}>
        <div style={{ fontSize:11, fontWeight:700, color:prev.color, fontFamily:'Geist, sans-serif', marginBottom:2 }}>{prev.name}</div>
        <div style={{ fontSize:12, color:'#555', fontFamily:'Geist, sans-serif' }}>{prev.caption}</div>
      </div>
      <div className={visible ? 'm-in' : 'm-out'} style={{ background:'rgba(255,255,255,0.92)', borderRadius:14, padding:'12px', border:`1.5px solid ${m.color}33`, textAlign:'left', boxShadow:'0 4px 16px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:28, height:28, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0 }}>{m.emoji}</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#111', fontFamily:'Geist, sans-serif' }}>{m.name}</div>
          <div style={{ marginLeft:'auto', fontSize:11, background:`${m.color}22`, color:m.color, borderRadius:100, padding:'2px 8px', fontWeight:700 }}>❤️ {Math.floor(index * 1.7 + 2)}</div>
        </div>
        <div style={{ fontSize:13, color:'#333', fontFamily:'Geist, sans-serif', lineHeight:1.5 }}>{m.caption}</div>
      </div>
      <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:10 }}>
        {ALL_MOMENTS.map((_,i) => <div key={i} style={{ width:i===index?16:5, height:5, borderRadius:100, background:i===index?m.color:'#ddd', transition:'all 0.3s' }} />)}
      </div>
    </div>
  )
}
