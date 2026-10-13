import Link from 'next/link';
import { getEnv, missingKeys } from '@/lib/env';
import { isAdminPage } from '@/lib/session';
import { TopBar } from '@/components/TopBar';
import { LoginForm } from '@/components/LoginForm';
import { SettingsPanel } from '@/components/SettingsPanel';
import { listChannels } from '@/lib/channels';
import { getHealth } from '@/lib/health';
import { listActions, impactCounts } from '@/lib/actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Podcast Ecosystem Radar' };

export default async function Settings() {
  const env = getEnv();
  const admin = await isAdminPage();
  if (!env.adminKey) {
    return (
      <>
        <TopBar admin={false} active="settings" />
        <main id="main" className="wrap" style={{ paddingTop: 48 }}>
          <div className="empty"><h2>Settings are locked</h2><p>Set the ADMIN_KEY environment variable (in .env.local and in Vercel for Production), then redeploy.</p></div>
        </main>
      </>
    );
  }
  if (!admin) {
    return (
      <>
        <TopBar admin={false} active="settings" />
        <main id="main" className="wrap" style={{ paddingTop: 48 }}>
          <p className="back"><Link href="/">← Back to the dashboard</Link></p>
          <LoginForm />
        </main>
      </>
    );
  }
  const [channels, health, actions] = await Promise.all([listChannels(), getHealth(), listActions()]);
  return (
    <>
      <TopBar admin active="settings" />
      <main id="main" className="wrap" style={{ paddingTop: 40 }}>
        <SettingsPanel
          channels={channels.ok ? channels.rows : []}
          dbError={channels.ok ? '' : channels.error}
          health={JSON.parse(JSON.stringify(health))}
          missing={missingKeys()}
          impact={impactCounts(actions)}
          confirmed={actions.filter((a) => a.entity_type === 'guest' && a.status === 'booked').map((a) => a.entity_key)}
          emailReady={Boolean(env.resendKey && env.briefTo)}
          maxChannels={10}
        />
      </main>
    </>
  );
}
