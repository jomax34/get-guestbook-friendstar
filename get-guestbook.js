// netlify/functions/get-guestbook.js
//
// Serverless Function that reads the site's real, shared guestbook
// comments (from everyone who has submitted the "guestbook" form) via
// the Netlify Forms API, and returns them as plain JSON for the page
// to render. This is what makes the guestbook shared across visitors,
// instead of each visitor only seeing their own localStorage copy.
//
// ---------------------------------------------------------------------
// SETUP (one-time):
//   1. Generate a Personal Access Token:
//        Netlify dashboard -> User settings -> Applications
//        -> Personal access tokens -> New access token
//   2. Add it as a site environment variable (NOT in this file, and NOT
//      in netlify.toml — those are both readable by anyone with repo
//      access):
//        Site settings -> Environment variables -> Add a variable
//        Key:   NETLIFY_API_TOKEN
//        Value: <paste the token from step 1>
//        Scopes: make sure "Functions" is checked
//   3. Redeploy the site (or trigger a new deploy) so the function picks
//      up the new environment variable.
//
// You do NOT need to set SITE_ID yourself — Netlify injects it
// automatically for every function at runtime.
// ---------------------------------------------------------------------

exports.handler = async function (event, context) {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.SITE_ID;

  if (!token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'NETLIFY_API_TOKEN is not set. Add it under Site settings -> Environment variables, then redeploy.'
      })
    };
  }

  try {
    // Pulls submissions for every form on the site, then filters down to
    // just the "guestbook" form below. (Simpler and more robust than
    // hunting down a specific form_id, which changes if the form is ever
    // deleted and recreated.)
    const res = await fetch(
      'https://api.netlify.com/api/v1/sites/' + siteId + '/submissions',
      { headers: { Authorization: 'Bearer ' + token } }
    );

    if (!res.ok) {
      const detail = await res.text();
      return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Netlify API request failed', detail: detail })
      };
    }

    const submissions = await res.json();

    // Keep only guestbook submissions, oldest first, reshaped to just
    // what the page needs — matches the {name, message, date} shape
    // buildEntryEl() in index.html already knows how to render.
    const entries = submissions
      .filter(function (s) { return s.form_name === 'guestbook'; })
      .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); })
      .map(function (s) {
        const data = s.data || {};
        return {
          name: data.name || 'Anonymous',
          message: data.message || '',
          date: new Date(s.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
          })
        };
      });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        // Short cache so the guestbook still feels fresh without hitting
        // the Netlify API on every single page load.
        'Cache-Control': 'public, max-age=30'
      },
      body: JSON.stringify(entries)
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
