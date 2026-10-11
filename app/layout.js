import './globals.css';

export const metadata = {
  title: 'Podcast Ecosystem Radar',
  description: 'Topics, guests and sponsors for your next episodes, from live YouTube podcast data.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
