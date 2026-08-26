/**
 * Donate section, sitting between Live and Clips. Deliberately a real
 * outbound link, not an iframe embed - couldn't confirm Streamlabs'
 * tip page allows being framed (payment pages very often explicitly
 * block this via X-Frame-Options, as a clickjacking protection), and
 * even where framing IS allowed, a real navigation to streamlabs.com's
 * own domain is generally more trustworthy for anyone about to enter
 * payment details than a payment form embedded inside a third-party page.
 */
export function DonateSection() {
  return (
    <section className="flex h-[60vh] w-full flex-col items-center justify-center gap-6 bg-[#0F1923] px-6 text-center text-[#ECE8E1]">
      <h2
        className="text-2xl tracking-[0.2em]"
        style={{ fontFamily: "'Chakra Petch', sans-serif", fontWeight: 700 }}
      >
        SUPPORT THE STREAM
      </h2>
      <p className="max-w-md text-sm text-[#9AA3AC]">
        Donations go directly through Streamlabs — you&apos;ll be taken to their
        secure page to complete it.
      </p>
      <a
        href="https://streamlabs.com/dualbladex"
        target="_blank"
        rel="noopener noreferrer"
        className="rounded border border-[#34f5c5]/40 bg-[#34f5c5]/10 px-8 py-3 text-sm font-semibold uppercase tracking-widest text-[#34f5c5] transition-colors hover:bg-[#34f5c5]/20"
      >
        Donate on Streamlabs
      </a>
    </section>
  );
}
