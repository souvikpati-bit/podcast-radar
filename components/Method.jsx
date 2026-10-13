// "How it is calculated": plain-English explanation of every number. A native <details> works without JavaScript.
export function Method({ num = '07' }) {
  return (
    <section className="block" id="method" aria-labelledby="h-method">
      <div className="sec-head"><span className="sec-num">{num}</span><h2 id="h-method">How it is calculated</h2></div>
      <details className="method" data-method>
        <summary>Every number explained</summary>
        <div className="method-body" data-method-body>
          <p>Every probability on this page is a <strong>model estimate from the data</strong>. It is never a guarantee that a guest will say yes or a sponsor will buy.</p>
          <h3>Thin data fixes itself</h3>
          <p>If a show has fewer than 6 guest episodes in the last 6 months, the system looks up that show&apos;s podcast RSS feed by itself and reads it as well. If the overall picture is still thin, it searches Apple&apos;s free podcast directory for active India business and startup shows and adds them. Added shows that still do not deliver 6 guest episodes are removed again. You never have to enter a link.</p>
          <h3>Where the data comes from</h3>
          <p>Only guest-interview episodes count: a video is used for topics, guests and sponsors only when a real guest was found in it. Shows that post rarely are read further back in time (up to six months) so they are not left blank. Solo videos and news clips are ignored (they still help set each channel&apos;s typical views). Podcast RSS show notes (guest names, bios, sponsor reads) for shows that are thin on YouTube, plus YouTube titles, descriptions, tags and public stats (views, likes, comments) for the shows you monitor. Spoken ad reads and audio are not available, so brand detection is partial: it only sees brands written in the text. Hidden likes or comments are treated as missing, never as zero.</p>
          <h3>Topics (ranked by coverage across shows; grouped by audience response)</h3>
          <p>Each topic card shows how audiences are responding, in words, with the real count behind it. <strong>High response</strong> = strength score of 6.5 or more out of 10. <strong>Mixed response</strong> = under 5 (a fresh angle will matter more). <strong>Steady response</strong> = in between. With fewer than 3 videos to judge, the card says <strong>Early signal</strong> instead of guessing. The line beneath, such as &ldquo;7 of 17 videos beat their channel&apos;s usual views&rdquo;, is the real count. The score itself (still computed as below) is also saved in the CSV and the data. All six topics were already chosen as the most widely covered, so these words compare them with each other, not with the rest of YouTube.</p>
          <ul>
            <li><strong>Performance (40%)</strong>: how a topic&apos;s videos did against their own channel&apos;s typical views. Only videos at least 3 days old count, because brand-new videos always look weak.</li>
            <li><strong>Engagement (20%)</strong>: likes plus comments per view, compared with the typical rate across all shows.</li>
            <li><strong>Coverage (25%)</strong>: how many different shows covered it. Six shows is the maximum.</li>
            <li><strong>Recency (15%)</strong>: the share of its videos from the last 7 days.</li>
            <li><strong>Ranking</strong>: the six topics are the ones covered by the most different shows in the last 30 days (the same time window). They are then listed in groups that never mix: High response first, then Steady, then Mixed, then Early signal. Inside a group, more shows come first, then the score. &ldquo;Ride it&rdquo; = 3 or more shows are on it now. &ldquo;Crowded: counter-programme&rdquo; = it is a quarter or more of all recent talk, so a fresh angle stands out more than another take. &ldquo;Emerging&rdquo; = fewer than 3 shows so far. Topic names come from a growing list: when an episode&apos;s theme fits no existing name, a new specific one is created.</li>
            <li><strong>Trend</strong>: the topic&apos;s guest episodes in the last 14 days against the 14 days before: rising, steady, cooling, or new. It is shown next to the rank and does not change the score.</li>
            <li><strong>Probability</strong>: out of the mature videos on the topic, how many beat their channel&apos;s typical views. It is smoothed as (hits + 1) / (videos + 2) so a tiny sample never shows 0% or 100%.</li>
          </ul>
          <h3>Topic trends</h3>
          <p>The Trends block compares the six topics week by week. <strong>Shows covering it</strong> counts how many different monitored shows had a guest episode on the topic in each of the last 12 weeks (shows, not episodes, so one busy show cannot fake a spike; older history is not stored reliably). <strong>Public interest</strong> uses daily Wikipedia page views for a matching article (for example &ldquo;Artificial intelligence&rdquo; for AI and agents), averaged per week over the last 16 weeks and shown as an index where 100 is that topic&apos;s own 16-week average. The table compares the latest week with that average. A change of a few percent is ordinary wobble, and a falling line is context, not a reason to skip a topic. It is a free, live stand-in for how much the public cares; it is not Google search data. If Wikipedia cannot be reached, the interest lines are left out and the coverage lines still show.</p>
          <h3>Guests</h3>
          <ul>
            <li>Only <strong>founders</strong> are listed, because that is who you host. The AI reads each guest&apos;s role (founder, investor, analyst, public figure and so on) and company from the episode text. Analysts, investors and celebrities are left out; a guest whose role is not stated gets the benefit of the doubt.</li>
            <li>Guests are ranked on their own. No topic is involved, so whoever joins you, you can discuss the trending topics with them.</li>
            <li>A <strong>media round</strong> means the same founder appeared on two or more shows within the last 30 days. That is the score&apos;s biggest lever. The score is a booking-readiness index from 3 to 97, not a measured chance that they will say yes.</li>
            <li><strong>New voice</strong> = few appearances in the last 6 months (not yet flooded with requests). <strong>Heavily booked</strong> = on 6 or more shows.</li>
            <li><strong>Media willingness (about 57%)</strong>: appearing on more shows in the last 60 days means a media round. Counted up to 4 shows; 6 or more is slightly reduced because that guest is already everywhere.</li>
            <li><strong>Recency (about 43%)</strong>: fades over about two weeks since their last appearance. (These are the original 40 and 30 weights scaled to 100% now that topic fit is gone.)</li>
            <li>The hosts of the monitored shows are never listed as guests.</li>
            <li>A guest stays on the list until you press &ldquo;Confirmed: remove from list&rdquo; (after they agree to come on your show). You can put them back in Settings.</li>
          </ul>
          <h3>Sponsors</h3>
          <ul>
            <li>A brand is listed when it appears on two or more shows or shows paid promotion. Wording like &ldquo;presented by&rdquo;, &ldquo;powered by&rdquo;, &ldquo;in association with&rdquo; or a promo code counts as paid. A company that a guest founded or works for is not counted as an advertiser.</li>
            <li><strong>Reach (35%)</strong>: how many shows carried the brand, up to 4.</li>
            <li><strong>Recency (25%)</strong>: fades over about three weeks.</li>
            <li><strong>Paid signal (25%)</strong>: the share of mentions that showed paid promotion (&ldquo;sponsored by&rdquo;, &ldquo;brought to you by&rdquo;, a promo code or an affiliate link).</li>
            <li><strong>Frequency (15%)</strong>: number of mentions, up to 8.</li>
            <li>&ldquo;Likely advertiser&rdquo; means at least one mention showed paid promotion. &ldquo;Mentioned only&rdquo; means it was named without one.</li>
          </ul>
          <h3>Limits</h3>
          <p>The AI reads only the text of each video and every name it returns is checked against that text, so no name is invented. The system never contacts a guest or a sponsor. You make every decision.</p>
        </div>
      </details>
    </section>
  );
}
