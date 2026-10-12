# Tsamara videos

The pitch and demo videos for the submission, built with [Remotion](https://www.remotion.dev).
A standalone pnpm project, like `apps/docs`: not part of the Bun workspace.

| Composition | What it is | Length |
|---|---|---|
| `Demo` | One continuous take of the app with a caption per chapter | about 2 minutes |
| `Pitch` | Seven scenes that follow `docs/SUBMISSION.md` | 2.5 minutes |

Neither has a narration track; each scene carries its own sentence.

## Render

```sh
pnpm install
pnpm studio        # preview and scrub
pnpm render        # out/demo.mp4 and out/pitch.mp4
```

## The footage

`public/demo.mp4` is not in the repository. Record it against a local stack; the script also writes
`public/markers.json`, which says when each chapter starts:

```sh
bun run indexer
SUMSUB_TOKEN= SUMSUB_SECRET= ADMIN_TOKEN=e2e bun run api
bun run --cwd apps/app build && bun run --cwd apps/app start
ADMIN_TOKEN=e2e bun apps/app/e2e/demo-recording.ts
ffmpeg -i apps/video/public/demo.webm -c:v libx264 -crf 18 -pix_fmt yuv420p -r 30 -an apps/video/public/demo.mp4
```

The stills in `public/shot-*.png` are frames of that take.

## Before rendering the pitch

Edit `src/team.ts`. It is the "who we are" scene, and only the team can write it truthfully.
The wording rules in `docs/REGULATION.md` apply to every caption.
