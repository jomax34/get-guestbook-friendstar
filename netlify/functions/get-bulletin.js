// netlify/functions/get-bulletin.js
//
// Returns the single most recent "bulletin" submitted via bulletin-admin.html,
// so index.html can replace its placeholder post with the real one for every
// visitor (not just the browser that posted it).
//
// This mirrors get-guestbook.js and needs the SAME one-time setup:
//   1. Netlify site settings -> Site configuration -> Environment variables
//   2. Add NETLIFY_API_TOKEN — a Personal Access Token from
//      https://app.netlify.com/user/applications#personal-access-tokens
//   3. Add NETLIFY_SITE_ID — your site's API ID, shown on
//      Site configuration -> General -> Site details.
//      (If get-guestbook.js already uses a different variable name for
//      this, e.g. SITE_ID, either rename that one to match or add a
//      second env var here with the same value — either works.)
//
// bulletin-admin.html's form is named "bulletin" (data-netlify="true"),
// so once deployed, every submission is captured as a real Netlify Forms
// entry. This function reads those back via the Forms API
// (GET /sites/{site_id}/submissions), keeps only the ones from the
// "bulletin" form, and returns the newest one as JSON — or `null` if
// nothing's been posted yet, or if the env vars above aren't set.
//
// Note: Forms submissions can take a few seconds to become available
// here after someone submits bulletin-admin.html — that's normal.

exports.handler = async function () {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;

  const respond = (body) => ({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!token || !siteId) {
    // Not configured yet — front-end just keeps showing its placeholder.
    return respond(null);
  }

  try {
    const res = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/submissions`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      throw new Error(`Netlify API returned ${res.status}`);
    }

    const submissions = await res.json();

    const bulletinSubs = submissions
      .filter((s) => s.form_name === 'bulletin')
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const latest = bulletinSubs[0];
    if (!latest) {
      return respond(null);
    }

    const data = latest.data || {};

    return respond({
      title: data.title || '',
      message: data.message || '',
      date: new Date(latest.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    });
  } catch (err) {
    // API hiccup, bad token, whatever — fail soft, same as get-guestbook.js.
    return respond(null);
  }
};
