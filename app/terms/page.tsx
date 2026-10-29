import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · DualBladeX" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="29 October 2026">
      <p>
        These terms cover hub.dualbladex.org, the site of the streamer DualBladeX, including the private
        tool &ldquo;DualBladeX Editor&rdquo;. By using the site you agree to them.
      </p>

      <h2>The public site</h2>
      <p>
        The homepage is free to view. Stream clips, overlays and other content on it belong to DualBladeX
        unless stated otherwise, and may not be republished as your own. Embedded Twitch and YouTube
        content is also covered by those platforms&rsquo; own terms.
      </p>

      <h2>The private area</h2>
      <p>
        Only accounts the streamer has approved may log in. Do not try to reach pages or files you have
        not been given access to. Videos and other files shared through the editor tool are for working on
        DualBladeX content and must not be shared further without the streamer&rsquo;s permission.
      </p>

      <h2>No warranty</h2>
      <p>
        The site is a personal project, provided as it is, without any guarantee that it will always be
        available or free of errors. Keep your own copies of anything important. To the extent the law
        allows, DualBladeX is not liable for any loss caused by using the site.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change; the date above shows the latest version. Using the site after a change
        means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:ultimateshedic@gmail.com">ultimateshedic@gmail.com</a>
      </p>
    </LegalPage>
  );
}
