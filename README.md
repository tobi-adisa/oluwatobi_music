# Oluwatobi Music Site

React artist website with:

- a public-facing music landing page
- an admin view for editing site content
- server-side JSON persistence
- Spotify URL enrichment for artwork and streaming links
- optional Bandcamp embeds per release

## Setup

1. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD`.
2. Install dependencies with `npm install`.
3. Run `npm run dev`.

The React app runs on `http://localhost:5173` and proxies API requests to the Node server on `http://localhost:5050`.

## Production

1. Run `npm run build`.
2. Start the server with `npm start`.

The server will serve the built React app and persist content edits in `data/site-content.json`.

## Vercel Backend

This project now includes Vercel serverless API routes in `api/` and a root `vercel.json`.

- Local development still uses the Express server and the `data/` JSON files.
- On Vercel, the same API logic uses Vercel Blob for persistent content and release-cache storage.
- Add both `ADMIN_PASSWORD` and `BLOB_READ_WRITE_TOKEN` in your Vercel project environment variables before deploying.

Recommended Vercel setup:

1. Import the repo into Vercel.
2. Create or connect a Blob store to the project.
3. Add `ADMIN_PASSWORD` and `BLOB_READ_WRITE_TOKEN` in Project Settings > Environment Variables.
4. Deploy.

## Hidden Admin Password

The admin password is read from `ADMIN_PASSWORD` on the server only.

- For local development, keep it in `.env`.
- For Vercel, add `ADMIN_PASSWORD` in the project environment variables dashboard.
- Do not hardcode the password in React files or commit `.env`.
