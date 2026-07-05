import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function WelcomePage({ onSignIn }) {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('home') // 'home' | 'otp'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOTP() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g,'')
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) setError(error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function verifyOTP() {
    setLoading(true); setError('')
    const formatted = phone.startsWith('+') ? phone : '+' + phone.replace(/\D/g,'')
    const { error } = await supabase.auth.verifyOtp({ phone: formatted, token: otp, type: 'sms' })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 24px', fontFamily:'Geist, Inter, sans-serif', position:'relative', overflow:'hidden' }}>
      <style>{`
        @keyframes meshMove{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=Geist:wght@300;400;500;600;700&display=swap');
      `}</style>

      {/* Animated background */}
      <div style={{ position:'fixed', inset:0, zIndex:0, background:'linear-gradient(135deg,#fef9f0,#fce8e8 18%,#e8f4fc 38%,#f0e8fc 58%,#e8fce8 78%,#fef9f0)', backgroundSize:'600% 600%', animation:'meshMove 22s ease infinite', pointerEvents:'none' }} />

      {/* Floating family name pills */}
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

      {/* Main content */}
      <div style={{ position:'relative', zIndex:2, maxWidth:320, width:'100%', textAlign:'center' }}>

        {/* Logo */}
        <div style={{ animation:'fadeUp 0.5s ease both' }}>
          <div style={{ fontFamily:'Cormorant Garamond, serif', fontStyle:'italic', fontSize:48, fontWeight:600, color:'#111', lineHeight:1 }}>wanderlog</div>
          <div style={{ fontSize:14, color:'#888', marginTop:6, fontWeight:400 }}>Our family's journal</div>
        </div>

        {step === 'home' && (
          <div style={{ marginTop:40, animation:'fadeUp 0.5s ease 0.2s both' }}>
            {/* Google */}
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

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:12, margin:'8px 0 12px' }}>
              <div style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />
              <span style={{ fontSize:12, color:'#bbb', fontWeight:500 }}>or</span>
              <div style={{ flex:1, height:1, background:'rgba(0,0,0,0.08)' }} />
            </div>

            {/* WhatsApp / Phone */}
            <div style={{ background:'rgba(255,255,255,0.85)', borderRadius:16, padding:'18px', backdropFilter:'blur(8px)', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#111', marginBottom:10, textAlign:'left' }}>Sign in with phone number</div>
              <div style={{ display:'flex', gap:8 }}>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+919797014586"
                  style={{ flex:1, border:'1.5px solid #e8e8e8', borderRadius:10, padding:'11px 12px', fontSize:14, fontFamily:'Geist, sans-serif', outline:'none', background:'#fff' }}
                />
                <button onClick={sendOTP} disabled={loading || !phone.trim()}
                  style={{ background:'#25D366', color:'#fff', border:'none', borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:700, cursor:'pointer', flexShrink:0, opacity:loading||!phone.trim()?0.5:1 }}>
                  {loading ? '…' : 'Send'}
                </button>
              </div>
              {error && <div style={{ fontSize:12, color:'#e53e3e', marginTop:8 }}>{error}</div>}
              <div style={{ fontSize:11, color:'#bbb', marginTop:8, textAlign:'left' }}>You'll receive an SMS with a code</div>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div style={{ marginTop:40, animation:'fadeUp 0.4s ease both' }}>
            <div style={{ background:'rgba(255,255,255,0.85)', borderRadius:16, padding:'20px', backdropFilter:'blur(8px)', boxShadow:'0 4px 20px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize:14, color:'#888', marginBottom:4 }}>Code sent to</div>
              <div style={{ fontSize:16, fontWeight:700, color:'#111', marginBottom:16 }}>{phone}</div>
              <input
                type="number"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                autoFocus
                style={{ width:'100%', border:'1.5px solid #e8e8e8', borderRadius:10, padding:'13px', fontSize:20, fontFamily:'Geist, sans-serif', outline:'none', background:'#fff', textAlign:'center', letterSpacing:'0.2em', marginBottom:12, boxSizing:'border-box' }}
              />
              <button onClick={verifyOTP} disabled={loading || otp.length < 6}
                style={{ width:'100%', background:'#111', color:'#fff', border:'none', borderRadius:12, padding:'14px', fontSize:15, fontWeight:700, cursor:'pointer', opacity:loading||otp.length<6?0.5:1 }}>
                {loading ? 'Verifying…' : 'Verify & Sign in'}
              </button>
              {error && <div style={{ fontSize:12, color:'#e53e3e', marginTop:8 }}>{error}</div>}
              <button onClick={()=>{setStep('home');setOtp('');setError('')}} style={{ background:'none', border:'none', color:'#bbb', fontSize:13, cursor:'pointer', marginTop:12, fontFamily:'Geist, sans-serif' }}>← Try a different number</button>
            </div>
          </div>
        )}

        <div style={{ marginTop:20, fontSize:11, color:'#ccc', animation:'fadeUp 0.5s ease 0.4s both' }}>
          wanderlog · our family's journal
        </div>
      </div>
    </div>
  )
}
