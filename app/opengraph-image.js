import { ImageResponse } from 'next/og';

export const alt = 'Podcast Ecosystem Radar';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', background: '#07090B', color: '#EDEBE4', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, position: 'relative' }}>
        <div style={{ position: 'absolute', right: -120, top: -120, width: 700, height: 700, borderRadius: 700, border: '2px solid rgba(198,244,50,0.35)', display: 'flex' }} />
        <div style={{ position: 'absolute', right: 20, top: 20, width: 420, height: 420, borderRadius: 420, border: '2px solid rgba(198,244,50,0.25)', display: 'flex' }} />
        <div style={{ fontSize: 28, color: '#C6F432', letterSpacing: 6, display: 'flex' }}>PODCAST ECOSYSTEM RADAR</div>
        <div style={{ fontSize: 92, marginTop: 24, lineHeight: 1.05, display: 'flex', maxWidth: 800 }}>Topics, guests and sponsors, before the moment passes.</div>
      </div>
    ),
    size,
  );
}
