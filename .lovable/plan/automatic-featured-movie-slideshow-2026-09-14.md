# Automatic featured-movie slideshow

## What will change
- Replace the single featured title with a rotating selection from real Emby movies and series already loaded on Home.
- Advance automatically on a comfortable timer, looping continuously.
- Add smooth cross-fades, progress dots, and previous/next controls usable by touch, mouse, and TV remote.
- Keep Play and More Info connected to whichever title is currently featured.
- Pause automatic switching while the user interacts with the slideshow, and respect reduced-motion settings.
- Extend the same featured experience to phones instead of showing a separate static poster rail first.

## Technical details
- Build a focused `FeaturedSlideshow` component from the existing home data and image proxy.
- Deduplicate candidates, prefer titles with backdrop artwork, and cap the rotation to avoid unnecessary image loading.
- Preload only the next backdrop and use stable dimensions to prevent layout shifts.
- Verify desktop, phone, and TV-sized layouts plus automatic advancement and controls.
