# OAuth Setup — Google Sign-In

Kingdoms & Crowns supports signing in with Google in addition to email/password. This guide walks through configuring the provider.

## Environment Variables

Add the following to your `.env.local`:

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

---

## Google OAuth

### 1. Create a Google Cloud project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).

### 2. Configure the OAuth consent screen

1. Go to **APIs & Services > OAuth consent screen**.
2. Choose **External** user type (unless you only need internal/org access).
3. Fill in the required fields:
   - **App name**: Kingdoms & Crowns
   - **User support email**: your email
   - **Authorized domains**: your production domain (e.g. `kingdomsandcrowns.com`)
4. Add scopes: `email`, `profile`, `openid`.
5. Save and continue.

### 3. Create OAuth credentials

1. Go to **APIs & Services > Credentials**.
2. Click **Create Credentials > OAuth client ID**.
3. Application type: **Web application**.
4. Add **Authorized redirect URIs**:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://yourdomain.com/api/auth/callback/google`
5. Copy the **Client ID** and **Client Secret** into your `.env.local`.

---

## Verifying the Setup

1. Start the dev server: `npm run dev`
2. Navigate to `/signup` or `/login`.
3. Click **Continue with Google**.
4. You should be redirected to the provider's consent screen, then back to `/tavern` on success.

## Troubleshooting

| Problem | Solution |
|---|---|
| "redirect_uri_mismatch" from Google | Ensure the redirect URI in Google Cloud Console exactly matches `{APP_URL}/api/auth/callback/google` |
| OAuth button doesn't appear | Verify the app builds without errors (`npx tsc --noEmit`) |
| User created but missing name | Google may not always return a name. The app handles this gracefully with Better Auth defaults |
