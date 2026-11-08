# Breath Bar launch site

A one-page site: open `index.html` in a browser to see it. It has no build step and loads nothing from other sites.

## Before it goes live

1. **Fill in the links.** In `site.js`, set `LINKS`: `windows` (the installer download), `android` (the Google Play listing) and `pro` (the Lemon Squeezy checkout link). Until each is set, its buttons say it opens at launch.
2. **Add your clip (optional).** Save a screen recording here as `clip.mp4`. It replaces the animated picture automatically.
3. **Hosting.** This repository is public and served by GitHub Pages at https://simon-jordan-dev.github.io/breath-bar-site/. Pushing to `main` updates the page. It holds only the website and, as releases, the Windows installers (which the app also checks for updates); the app's code is in a private repository.

## Files

- `index.html`, `site.css`, `site.js`: the page.
- `scene.js`, `scenes/`: copied unchanged from the Windows app (`../breath-bar`), so the demo is the real drawing code.
