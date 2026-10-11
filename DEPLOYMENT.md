# LearnFlow deployment

LearnFlow is an Express application with EJS pages, MongoDB, Google OAuth, Mongo-backed sessions, and optional S3 avatar uploads. It does not contain a React application.

## Credentials and fresh database

The old public source contained MongoDB, Google OAuth, and AWS credentials. Removing them from the current files does not invalidate credentials or remove them from Git history. Rotate the MongoDB password, Google OAuth secret, and AWS key in their respective provider consoles, and retire the old values. Do not copy the old credentials into hosting settings.

This restoration uses a new free MongoDB database because the owner cannot access the old database account. The new database starts without the old users, posts, or comments. Recovering those records requires access to the old account or a backup. Use the database name `learnFlow` and a database-scoped account. Do not loosen Atlas network restrictions to `0.0.0.0/0` as part of deployment; confirm the host can connect under a restricted policy or use an explicitly approved network configuration.

## Free Vercel Hobby deployment

1. Sign in to Vercel with an existing account and use the Hobby plan for this personal portfolio demo.
2. Import the sanitized GitHub source. Vercel detects Express from `app.js` and `package.json`; `vercel.json` includes the EJS views and runs `npm run build`. The build bundles the current HTML sanitizer and its ESM dependencies into `config/sanitizer.cjs` for Vercel's CommonJS runtime loader. The generated bundle is ignored by Git. Node 24 is selected in `package.json`.
3. Set private production environment values using `.env.example` as the key list. Required keys are `APP_BASE_URL`, `MONGODB_URI`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Set `NODE_ENV=production` and `MONGODB_DB_NAME=learnFlow`. Generate a new session secret with at least 32 random characters.
4. Set `APP_BASE_URL` to the final HTTPS production origin, without a path or trailing slash. Configure a new Google OAuth web client with that origin plus `/auth/google/callback` as an authorized redirect URI. OAuth state validation requires MongoDB-backed sessions to work.
5. For avatar uploads, set `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, and `S3_PUBLIC_BASE_URL`. The IAM credential should be restricted to uploading objects in the intended bucket. The bucket CORS policy needs the final application origin, PUT, and Content-Type. Preserve the original CloudFront origin if retaining the same storage.
6. Deploy and verify `/healthz`, the homepage and assets, Google sign-in, returning-user redirect, signup, dashboard/posts/comments, logout, and an avatar upload. Update the resume URL only after these production checks work.

## Conventional Node hosts

Run `npm ci` and `npm start`. The application uses `PORT` (default 3000), listens on all interfaces, and trusts one reverse proxy hop for secure cookies. The same private environment variables and callback configuration apply.

## Local verification

Run `npm ci`, then `npm test`. The test command builds the sanitizer and disables CommonJS loading of ESM to catch runtime compatibility regressions. Tests use an isolated ephemeral MongoDB database and a simulated Google token exchange. They do not access the original database, Google account, or S3 bucket. Real Google login and real S3 upload still require production verification.

For manual development, set private `.env` values with `NODE_ENV=development` and `APP_BASE_URL=http://localhost:3000`, then run `npm start`. Never commit `.env`.
