/**
 * Shared frame for the privacy policy and terms pages. Google's OAuth
 * consent screen needs both linked from this domain before the Drive app
 * can leave Testing; they are plain static pages, open without a login.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="w-full bg-ink px-4 py-16 text-phosphor sm:px-6">
      <article className="mx-auto flex max-w-2xl flex-col gap-6 leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-bold [&_a]:text-field [&_a:hover]:text-field-hot [&_ul]:list-disc [&_ul]:pl-6">
        {/* A plain link: the homepage loads as a whole document, not through the client router. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate full navigation, see above */}
        <a href="/" className="osd text-lg text-dim">
          ← DualBladeX
        </a>
        <h1 className="stencil text-5xl text-field">{title}</h1>
        <p className="osd text-lg text-dim">Last updated {updated}</p>
        {children}
      </article>
    </main>
  );
}
