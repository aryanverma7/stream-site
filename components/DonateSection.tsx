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
    <section className="w-full">
      <div className="hazard h-3" aria-hidden />
      <div className="wallpaper relative overflow-hidden px-4 py-20 sm:px-6 md:py-28">
        <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6">
          <h2 className="stencil tilt slam max-w-3xl text-[clamp(3.25rem,10vw,6rem)] text-ink">Support the stream</h2>
          <p className="max-w-md rotate-[-1deg] bg-ink px-3 py-2 text-base font-medium text-phosphor">
            Donations go directly through Streamlabs — you&apos;ll be taken to their
            secure page to complete it.
          </p>
          <div>
            <a
              href="https://streamlabs.com/dualbladex"
              target="_blank"
              rel="noopener noreferrer"
              className="menu-pop label inline-flex items-center gap-3 border-[3px] border-phosphor bg-ink px-7 py-4 text-sm text-phosphor shadow-[6px_6px_0_var(--phosphor)] hover:bg-phosphor hover:text-ink"
            >
              Donate on Streamlabs
            </a>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- static export, local sticker */}
        <img
          src="/stickers/love.png"
          alt=""
          className="sticker absolute -bottom-6 right-[4%] w-40 rotate-[12deg] sm:w-56 md:right-[10%] md:w-72"
        />
      </div>
      <div className="hazard h-3" aria-hidden />
    </section>
  );
}
