export function PublicLegalShell({ page }: { page: "privacy" | "terms" }) {
  return (
    <main className="public-legal-shell">
      <header className="public-legal-header">
        <a className="brand-row public-brand-link" href="#">
          <img src="/lifeos-mark.svg" alt="" className="brand-mark" />
          <div>
            <p className="eyebrow">Personal workspace</p>
            <h1>LifeOS</h1>
          </div>
        </a>
        <nav className="public-legal-nav" aria-label="Public pages">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#">Login</a>
        </nav>
      </header>
      {page === "privacy" ? <PrivacyPage /> : <TermsPage />}
    </main>
  );
}

export function PrivacyPage() {
  return (
    <section className="legal-page panel">
      <p className="eyebrow">Privacy</p>
      <h3>Simple LifeOS privacy note</h3>
      <p>
        LifeOS stores your app data in Firebase under your signed-in user account. This includes tasks, projects, saved views, habits,
        reminders, focus sessions, daily plans, reflections, weekly reviews, and quote favorites.
      </p>
      <p>
        You can export your data from Settings and you can delete your LifeOS app data. Browser notifications are optional and only requested
        after you click an enable button.
      </p>
      <p>
        LifeOS does not collect payment data. AI processing, calendar sync, team collaboration, and payments are not part of this version.
        Do not put secrets in task text unless you are comfortable storing them in your Firebase project.
      </p>
      <p className="settings-helper">This is a plain product note, not lawyer-approved legal advice.</p>
    </section>
  );
}

export function TermsPage() {
  return (
    <section className="legal-page panel">
      <p className="eyebrow">Terms</p>
      <h3>Simple LifeOS terms</h3>
      <p>
        LifeOS is a personal productivity app for planning, reflection, focus, habits, and reminders. You are responsible for deciding what
        data to store and for maintaining access to your Firebase-backed account.
      </p>
      <p>
        The app is provided as-is. There is no guarantee of uninterrupted service, perfect reminders, or permanent availability. Export your
        data regularly if it matters to you.
      </p>
      <p>
        LifeOS is not medical, legal, financial, or professional advice. Use it at your own risk and verify important decisions outside the
        app.
      </p>
      <p className="settings-helper">These are simple product terms, not a lawyer-approved contract.</p>
    </section>
  );
}
