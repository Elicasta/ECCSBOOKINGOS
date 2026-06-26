# Vercel deployment fix

The previous deploy failed during `npm install` because the committed `package-lock.json` contained package URLs generated inside ChatGPT's sandbox registry. Vercel cannot resolve those internal URLs reliably.

This deploy-safe package removes `package-lock.json`, adds a public `.npmrc`, pins Node 20, and tells Vercel to install without generating/using a lockfile for this prototype.

## Vercel settings

- Framework Preset: Vite
- Install Command: `npm install --no-audit --no-fund --package-lock=false`
- Build Command: `npm run build`
- Output Directory: `dist`

## Important

Do not commit a package-lock generated inside ChatGPT's sandbox. Generate it locally from your machine later if you want a lockfile.
