// "How it is calculated": plain-English explanation of every number. A native <details> works without JavaScript.
export function Method() {
  return (
    <section className="block" id="method" aria-labelledby="h-method">
      <div className="sec-head"><span className="sec-num">04</span><h2 id="h-method">How it is calculated</h2></div>
      <details className="method" data-method>
        <summary>Every number explained</summary>
        <div className="method-body" data-method-body>
          <p>Every probability on this page is a <strong>model estimate from the data</strong>. It is never a guarantee that a guest will say yes or a sponsor will buy.</p>
          <h3>Thin data fixes itself</h3>
          <p>If a show has fewer than 6 guest episodes in the last 6 months, the system looks up that show&apos;s podcast RSS feed by itself and reads it as well. If the overall picture is still thin, it searches Apple&apos;s free podcast directory for active India business and startup shows and adds them. Added shows that still do not deliver 6 guest episodes are removed again. You never have to enter a link.</p>
          <h3>Where the data comes from</h3>
          <p>Only guest-interview episodes count: a video is used for topics, guests and sponsors only when a real guest was found in it. Shows that post rarely are read further back in time (up to six months) so they are not left blank. Solo videos and news clips are ignored (they still help set each channel&apos;s typical views). Podcast RSS show notes (guest names, bios, sponsor reads) for shows that are thin on YouTube, plus YouTube titles, descriptions, tags and public stats (views, likes, comments) for the shows you monitor. Spoken ad reads and audio are not available, so brand detection is partial: it only sees brands written in the text. Hidden likes or comments are treated as missing, never as zero.</p>
          <h3>Topics (score out of 10 and probability)</h3>
          <ul>
            <li><strong>Performance (40%)</strong>: how a topic&apos;s videos did against their own channel&apos;s typical views. Only videos at least 3 days old count, because brand-new videos always look weak.</li>
            <li><strong>Engagement (20%)</strong>: likes plus comments per view, compared with the typical rate across all shows.</li>
            <li><strong>Coverage (25%)</strong>: how many different shows covered it. Six shows is the maximum.</li>
            <li><strong>Recency (15%)</strong>: the share of its videos from the last 7 days.</li>
            <li><strong>Probability</strong>: out of the mature videos on the topic, how many beat their channel&apos;s typical views. It is smoothed as (hits + 1) / (videos + 2) so a tiny sample never shows 0% or 100%.</li>
          </ul>
          <h3>Guests</h3>
          <ul>
            <li><strong>Media willingness (40%)</strong>: appearing on more shows in the last 60 days means a media round. Counted up to 4 shows; 6 or more is slightly reduced because that guest is already everywhere.</li>
            <li><strong>Recency (30%)</strong>: fades over about two weeks since their last appearance.</li>
            <li><strong>Topic fit (30%)</strong>: the share of their videos tagged with the selected topic. Guests with no fit are shown last and marked &ldquo;adjacent&rdquo;.</li>
            <li>The hosts of the monitored shows are never listed as guests.</li>
            <li>A guest stays on the list until you press &ldquo;Confirmed: remove from list&rdquo; (after they agree to come on your show). You can put them back in Settings.</li>
          </ul>
          <h3>Sponsors</h3>
          <ul>
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
