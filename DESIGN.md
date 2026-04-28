# Design

## Color

Use `evadevil-colorscheme-oklch.css` as the source palette. The site should feel controlled and pink-first, matching the main Eva de Vil site without becoming candy-like.

- Primary background: `--eva-pink` as a flat field.
- Primary text: `--eva-red`, with softer burgundy for body copy, never pure black.
- Accent: `--eva-red` for primary actions and rules. Reserve `--eva-red-dark` for occasional high-contrast blocks only.
- Secondary accents: `--eva-rose`, `--eva-mauve`, and `--eva-blush` for muted text, panels, and unavailable states.
- Avoid neon gaming color, rainbow gradients, glassmorphism, glow blobs, translucent panels, heavy shadows, and pure black or pure white surfaces.

## Typography

- Logo wordmark: `Advantage-Regular.woff2` from `/fonts/`, used only for “Eva de Vil”.
- Interface typography: a separate refined system sans stack for navigation, grid labels, buttons, and body copy.
- Use short labels, deliberate tracking, and high contrast between the wordmark and the functional UI.

## Layout

- A single-page hub for `https://evagames.org/`.
- Top navigation with the Eva de Vil wordmark, an Eva Games label, and a clear link to `https://evadevil.com/`.
- Hero section should establish mood quickly, then yield to a simple responsive game grid.
- Game grid should be easy to scan, with a strict flat index structure. Available, coming-soon, and reserved slots must be visually distinct.

## Components

- Game tile: title, status, short line of copy, and either an action link or a reserved-state label.
- Main-site link: elegant but prominent, styled as a primary route out.
- Placeholder tile: quieter, intentional, and visibly unavailable without looking disabled-broken.

## Motion

Subtle hover and focus transitions only. Honor `prefers-reduced-motion`. No flashing, bouncing, or arcade-style animation.
