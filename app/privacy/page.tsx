import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · DualBladeX" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="29 October 2026">
      <p>
        This site, hub.dualbladex.org, belongs to the streamer DualBladeX. It has a public homepage and
        a private area used only by the streamer and their video editor. This page explains what data
        the site handles and why.
      </p>

      <h2>Visitors to the homepage</h2>
      <p>
        The homepage does not ask you to log in, does not set tracking cookies and does not collect
        personal information. It embeds the Twitch and YouTube players, which are run by those companies
        under their own privacy policies.
      </p>

      <h2>Logging in</h2>
      <p>
        Only the streamer and their editor can log in, using GitHub. The site receives your GitHub
        username, checks it against the allowed list, and keeps a login session in a secure cookie for up
        to 30 days. Nothing else from your GitHub account is read or stored.
      </p>

      <h2>Google Drive</h2>
      <p>
        The private editor tool, &ldquo;DualBladeX Editor&rdquo;, connects to the streamer&rsquo;s own
        Google Drive with the <code>drive.file</code> permission. That permission only reaches files and
        folders this tool created itself; it cannot see anything else in the Drive. The tool uses it to:
      </p>
      <ul>
        <li>store stream recordings, edited videos and their thumbnails,</li>
        <li>share those files with the editor&rsquo;s Google account so they can be watched and downloaded,</li>
        <li>keep a nightly backup of the tool&rsquo;s own database,</li>
        <li>delete those files when the streamer or editor asks it to.</li>
      </ul>
      <p>
        Google user data is used for nothing else. It is not sold, not shared with anyone outside the
        streamer and the editor, not used for advertising and not used to train any AI model. The use of
        information received from Google APIs follows the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">
          Google API Services User Data Policy
        </a>
        , including its Limited Use requirements.
      </p>

      <h2>Where data is kept</h2>
      <p>
        Video files stay in the streamer&rsquo;s Google Drive. Comments, to-dos and the list of projects
        are kept in a database on the streamer&rsquo;s own computer, backed up to the same Drive. The
        Google access credential is stored only on that computer and is never sent to a browser.
      </p>

      <h2>Removing access and data</h2>
      <p>
        Access to Google Drive can be withdrawn at any time from{" "}
        <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
          your Google account&rsquo;s third-party access page
        </a>
        . Files the tool created can be deleted from inside the tool or directly in Google Drive. To ask
        for any data about you to be removed, email the contact below.
      </p>

      <h2>Contact</h2>
      <p>
        <a href="mailto:ultimateshedic@gmail.com">ultimateshedic@gmail.com</a>
      </p>
    </LegalPage>
  );
}
