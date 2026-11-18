# A24 Minimal macOS Music Player 💿

A hyper-curated, interactive music player built in the exact aesthetic of the **A24 Films & Music** digital design language, featuring physical-feel 3D compact discs, iridescent spectral light reflections, tactile acoustic feedback, and **live YouTube Music playlist synchronization**.

---

## ✨ Visual & Interaction Highlights

- **Exact Reference Typography**:
  - Top-left editorial uppercase serif title (`EVERYTHING EVERYWHERE ALL AT ONCE`, `THE ZONE OF INTEREST`, `UNCUT GEMS`).
  - Hairline tabular metadata rows: `ARTIST`, `YEAR`, `ALBUM`, and `LABEL / GENRE`.
  - Bottom 5-star critic reviews: *“GALAXY-BRAIN HEAD TRIP”* (The New York Times) & *“AN ORGIASTIC WORK OF SLAPHAPPY GENIUS”* (IndieWire).
- **Physical 3D CD Carousel**:
  - Realistic multi-layered CDs: printed artwork, micro-groove spiral texture, outer silver bevel, clear polycarbonate hub, metallic mirror clamping ring with laser-stamped matrix codes, and center spindle hole.
  - **Iridescent Holographic Sheen**: Dynamic rainbow diffraction sheen that glints with rotational motion and mouse tilt parallax.
  - **Apple-Style Fluid Physics**: Inertial acceleration/deceleration on play/pause, gesture dragging with momentum projection and rubber-band boundary resistance.
- **YouTube Music Playlist Sync**:
  - Paste any public or unlisted YouTube / YouTube Music playlist link (or track link).
  - Automatically loads and presses each song into an interactive spinning CD with real audio streaming, artwork, and metadata.
  - Preloaded with iconic curated collections (*A24 Masterpieces & Scores*, *Minimalism & Ambient*, *Lo-Fi Study*, and *Late-Night Jazz*).
- **Tactile Multi-Modal Feedback**:
  - Synthesized Web Audio API acoustic clicks and mechanical disc spin-up whirrs.
  - Responsive audio visualizer bars and minimal hairline scrubber.
- **Mac App & Keyboard Navigation**:
  - <kbd>Space</kbd>: Play / Pause
  - <kbd>←</kbd> / <kbd>→</kbd>: Previous / Next Disc
  - <kbd>↑</kbd> / <kbd>↓</kbd>: Volume Up / Down
  - Native macOS traffic lights (`✕`, `−`, `+` with fullscreen toggle) and Electron desktop app packaging.

---

## 🚀 How to Run

### In Your Browser (Instant Live Preview)
The dev server is currently running at:
```bash
http://localhost:5173/
```
If you ever need to restart it:
```bash
npm run dev
```

### As a Native macOS Desktop App Window (Electron)
To launch it inside a native frameless macOS desktop app window with vibrancy and native titlebar:
```bash
npm run mac
```
*(If prompted to install electron locally, run `npm run mac:setup`)*

---

## 🎵 How to Sync Your YouTube Music Playlist
1. Click **`Sync YT`** or **`Playlists ▾` → `Sync YouTube Music Playlist…`** in the top navigation bar.
2. Paste the URL of your playlist (e.g. `https://music.youtube.com/playlist?list=PL...`) or raw playlist ID.
3. *(Optional)* Name your collection (e.g. *"Midnight Drives"*).
4. Click **`Sync & Press Discs`** — your tracks will immediately load as interactive spinning CDs!
