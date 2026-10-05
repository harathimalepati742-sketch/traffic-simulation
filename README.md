# Traffic Rules Game

A simple browser game where you choose to **drive a car** or **walk as a pedestrian**.
Follow the traffic rules to earn points, break them and you lose points.

## Files
- `index.html` – page layout and menu
- `style.css` – styling
- `game.js` – all game logic (driving mode + walking mode)

## Run locally
Just double-click `index.html`. No install or server needed.

## Upload to GitHub
1. Create a new repository on GitHub (for example `traffic-rules-game`).
2. Click **Add file > Upload files**, drag in `index.html`, `style.css`, `game.js` and `README.md`, then **Commit changes**.

## Publish it online (free, GitHub Pages)
1. In the repository go to **Settings > Pages**.
2. Under **Branch** pick `main` and folder `/ (root)`, then **Save**.
3. After a minute your game is live at `https://<your-username>.github.io/traffic-rules-game/`.

## Controls
| Mode | Keys |
|------|------|
| Drive | Up/W gas, Down/S/Space brake, Left/Right change lane, B seat belt |
| Walk | Arrow keys/WASD move, L look left and right |

On phones, use the on-screen buttons.

## Scoring (start with 50 points, game over at 0)
**Driving:** seat belt +5 (−5 if you drive without it), stop at red +5, run red −15, pass on green +10, give way at zebra +10 (−20 if you don't), overspeed −3, crash −20, hit pedestrian −30.

**Walking:** each crossing +15, perfect crossing +10, no look −5, jaywalking −10, crossing on red −15, hit by car −20.
