# Firebase Hosting Setup Guide

This project is configured for Firebase Hosting with project ID: ``

## Prerequisites

1. Install Firebase CLI globally:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Verify you have access to the project:
```bash
firebase projects:list
```

## Initial Setup

The Firebase configuration files are already created:
- `firebase.json` - Hosting configuration
- `.firebaserc` - Project ID configuration

## Build and Deploy

1. **Build the project:**
```bash
npm run build
```

2. **Deploy to Firebase Hosting:**
```bash
npm run deploy
```

Or use Firebase CLI directly:
```bash
firebase deploy --only hosting
```

## Development

- **Run development server:**
```bash
npm run dev
```

- **Preview production build locally:**
```bash
npm run build
npm run preview
```

- **Test Firebase hosting locally:**
```bash
npm run build
firebase serve
```

## Environment Variables

Make sure to set your Supabase environment variables in Firebase Hosting:

1. Go to Firebase Console → Hosting → Your site
2. Add environment variables in the hosting settings
3. Or use Firebase Functions if you need server-side environment variables

For client-side environment variables, you can:
- Use Firebase Hosting environment config
- Or build with environment variables and deploy

## Important Notes

- The `dist` folder (Vite build output) is configured as the public directory
- All routes are rewritten to `index.html` for SPA routing
- Static assets are cached for 1 year
- Make sure your `.env` file with Supabase credentials is not committed to git

## Troubleshooting

If you get permission errors:
```bash
firebase login --reauth
```

If the project ID doesn't match:
```bash
firebase use matlab3728323
```

To check current project:
```bash
firebase projects:list
firebase use
```

