import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { getEnv } from '@/lib/env';

const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', variable: '--font-serif', display: 'swap' });
const sans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export const metadata = {
  metadataBase: new URL(getEnv().appUrl),
  title: 'Podcast Ecosystem Radar',
  description: 'Which topics to cover, which guests to book, which sponsors to pitch, from live YouTube podcast data.',
  robots: { index: false, follow: false },
  openGraph: { title: 'Podcast Ecosystem Radar', description: 'Topics, guests and sponsors for your next episodes.', images: ['/opengraph-image'] },
};

export const viewport = { themeColor: '#07090B', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
