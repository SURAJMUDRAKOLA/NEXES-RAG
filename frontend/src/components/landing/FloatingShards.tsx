'use client';

const SHARDS = [
  {
    points: '0,20 14,0 24,16 10,36',
    x: '8%',
    y: '15%',
    anim: 'shard-float-a 22s ease-in-out infinite',
    size: 48,
    opacity: 0.22,
  },
  {
    points: '0,12 18,0 22,18 8,28',
    x: '88%',
    y: '12%',
    anim: 'shard-float-b 18s ease-in-out infinite',
    size: 40,
    opacity: 0.18,
  },
  {
    points: '8,0 24,6 20,22 0,18',
    x: '4%',
    y: '60%',
    anim: 'shard-float-c 24s ease-in-out infinite',
    size: 36,
    opacity: 0.15,
  },
  {
    points: '0,16 12,0 26,10 18,26 4,28',
    x: '92%',
    y: '55%',
    anim: 'shard-float-d 20s ease-in-out infinite',
    size: 44,
    opacity: 0.20,
  },
  {
    points: '0,8 14,0 20,12 12,24 2,20',
    x: '15%',
    y: '80%',
    anim: 'shard-float-b 26s ease-in-out 2s infinite',
    size: 32,
    opacity: 0.14,
  },
  {
    points: '0,10 16,0 22,14 8,26',
    x: '78%',
    y: '78%',
    anim: 'shard-float-a 21s ease-in-out 1s infinite',
    size: 38,
    opacity: 0.17,
  },
];

export default function FloatingShards() {
  return (
    <>
      {SHARDS.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            animation: s.anim,
            pointerEvents: 'none',
            zIndex: 4,
          }}
        >
          <svg width={s.size} height={s.size} viewBox={`0 0 ${s.size} ${s.size}`}>
            <defs>
              <linearGradient id={`sg${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(196,181,253,0.6)" />
                <stop offset="100%" stopColor="rgba(124,58,237,0.1)" />
              </linearGradient>
            </defs>
            <polygon points={s.points} fill={`url(#sg${i})`} opacity={s.opacity} />
          </svg>
        </div>
      ))}
    </>
  );
}
