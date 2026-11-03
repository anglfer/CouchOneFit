import type { ReactElement } from 'react';
import AppearanceSettings from './AppearanceSettings';
import { Icon, type IconName } from './Icon';
import InstallAppCard from './InstallAppCard';
import { PageHeader } from './ui';

export interface ProfileRow {
  icon: IconName;
  label: string;
  value: string;
}

/** Perfil de cuenta compartido por el panel profesional y administración. */
export default function AccountProfile({
  eyebrow,
  title,
  lead,
  name,
  caption,
  rows,
  footnote,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  name: string;
  caption: string;
  rows: ProfileRow[];
  footnote: string;
}): ReactElement {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} lead={lead} />
      <div className="ws-grid-2">
        <section className="ws-card" aria-labelledby="profile-title">
          <header className="mb-5 flex items-center gap-4">
            <span className="ws-avatar ws-avatar-lg" aria-hidden="true">
              {name.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 id="profile-title" className="ws-card-title text-lg!">
                {name}
              </h2>
              <p className="ws-card-sub">{caption}</p>
            </div>
          </header>
          <dl className="ws-dl">
            {rows.map(({ icon, label, value }) => (
              <div key={label}>
                <dt>
                  <Icon name={icon} size={16} />
                  {label}
                </dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 border-t border-(--ws-border-subtle) pt-4 text-xs text-(--ws-muted)">
            {footnote}
          </p>
        </section>

        <div className="space-y-4">
          <AppearanceSettings />
          <InstallAppCard />
        </div>
      </div>
    </>
  );
}
