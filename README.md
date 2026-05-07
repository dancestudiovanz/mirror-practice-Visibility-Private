# Mirror Practice

Dance mirror trainer for learning choreography on phones, tablets, and desktop browsers.

Mirror Practice lets you load a dance video, flip it horizontally, slow it down, and practice with a large, distraction-light player.

## Features

- Mirror playback for dance practice
- Local video file loading
- HTTPS direct video URL loading, such as mp4 or webm
- API-less YouTube embed support
- Speed presets: 0.25x, 0.5x, 0.75x, 1x, 1.25x
- Tap-to-show minimal playback controls
- Fullscreen-style practice view on playback
- Portrait and landscape responsive layout for phones and tablets
- Focus mode for zooming into a selected area on direct video playback
- A/B section loop for direct video and local files
- Last URL or file name memory
- History clear button
- CSP and security headers for Vercel

## YouTube Support

This app intentionally does not use the YouTube IFrame Player API or an API key.

YouTube videos are loaded with `youtube-nocookie.com` embeds. Because of this, some YouTube videos may not play inside the app due to the uploader's embedding settings, age restrictions, regional restrictions, or YouTube policy.

For YouTube videos in no-API mode, playback controls such as play, pause, speed change, and looping are handled by the embedded YouTube player, not by the app.

For the best practice experience, use a local video file or a direct HTTPS video URL.

## Local Development

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:8000/
```

No build step is required. The app is static HTML, CSS, and JavaScript.

## Deployment

This repository is ready for Vercel as a static site.

The included `vercel.json` sets security headers, including:

- Content Security Policy
- Referrer Policy
- Permissions Policy
- X-Content-Type-Options
- X-Frame-Options

## Files

- `index.html` - App markup and CSP meta tag
- `styles.css` - Responsive UI and practice player styling
- `app.js` - Video loading, mirroring, controls, history, focus, and loop logic
- `vercel.json` - Vercel headers
- `package.json` - Local dev commands

## Notes

This app is designed for choreography practice. Make sure you have the right to use any video files or URLs you load into the app, especially for commercial use.
