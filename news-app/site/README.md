# News Hammer website

The download page at https://news-hammer.netlify.app (Netlify project `news-hammer`). One static
page, no build step: `index.html`, the app screenshots in `img/` and the Barlow Condensed fonts.

The Download buttons point at
`https://github.com/johnny4091-allstar/headlines-releases/releases/latest/download/news-hammer.apk`,
so they always give the newest APK the CI published; the version label reads the latest release
from GitHub's API in the browser.

To publish a change, deploy this folder to the Netlify project (for example `netlify deploy --prod`
from here after `netlify link`). Changes here don't trigger the app's CI build.
