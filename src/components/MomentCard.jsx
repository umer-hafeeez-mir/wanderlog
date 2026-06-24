import { format } from 'date-fns'

export function MomentCard({ moment, currentUserId, onReact }) {
  const images = moment.moment_images ?? []
  const reactions = moment.reactions ?? []
  const myReaction = reactions.find(r => r.user_id === currentUserId && r.emoji === '🫶')
  const reactionCount = reactions.filter(r => r.emoji === '🫶').length

  const time = format(new Date(moment.created_at), 'h:mm a')

  return (
    <div style={{
      background: 'var(--white)', borderRadius: 14,
      boxShadow: '0 2px 12px var(--shadow)', marginBottom: 16, overflow: 'hidden'
    }}>
      <div style={{ padding: '14px 16px 12px' }}>
        <div style={{ fontSize: 11, color: 'var(--rust)', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6 }}>
          {time}
        </div>
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{moment.caption}</div>
      </div>

      {images.length === 0 ? (
        <div style={{ height: 140, background: 'linear-gradient(135deg,var(--mist),#ddd5c8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>
          📸
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: images.length === 1 ? '1fr' : '1fr 1fr',
          gap: 3
        }}>
          {images.slice(0, 3).map((img, i) => (
            <img key={img.id} src={img.url} alt=""
              style={{
                width: '100%',
                height: images.length === 1 ? 220 : 150,
                objectFit: 'cover', display: 'block',
                ...(images.length === 3 && i === 0 ? { gridColumn: '1 / -1', height: 200 } : {})
              }}
            />
          ))}
        </div>
      )}

      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--mist)' }}>
        <button
          onClick={() => currentUserId && onReact(moment.id)}
          style={{
            background: myReaction ? '#fef3ee' : 'none',
            border: `1.5px solid ${myReaction ? 'var(--rust)' : 'var(--mist)'}`,
            borderRadius: 100, padding: '4px 12px', fontSize: 13,
            cursor: currentUserId ? 'pointer' : 'default',
            color: myReaction ? 'var(--rust)' : 'var(--ink)',
            display: 'flex', alignItems: 'center', gap: 5
          }}
        >
          🫶 {reactionCount}
        </button>
        {moment.location && (
          <div style={{ fontSize: 11, color: '#9a9088', display: 'flex', alignItems: 'center', gap: 3 }}>
            📍 {moment.location}
          </div>
        )}
      </div>
    </div>
  )
}
