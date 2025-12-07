# Raindrop New Tab Page

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://github.com/adnathanail/raindrop-new-tab-page)

A clean, minimal new tab page for your browser that displays your bookmarks from Raindrop.io.

## Features

- 🔖 Fetches bookmarks from Raindrop.io via OAuth
- 🔒 Secure OAuth authentication via Netlify Functions
- 🎨 Clean, gradient design with no frameworks
- ⚡ Fast and lightweight vanilla JavaScript

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create a Raindrop.io OAuth App

1. Go to [Raindrop.io Settings > Integrations](https://app.raindrop.io/settings/integrations)
2. Click "Create new app"
3. Fill in the app details
4. Under "OAuth", add a redirect URI:
   - For local development: `http://localhost:8888/.netlify/functions/auth-callback`
   - For production: `https://your-site.netlify.app/.netlify/functions/auth-callback`
5. Save and copy your Client ID and Client Secret

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your OAuth credentials:

```
RAINDROP_CLIENT_ID=your_actual_client_id
RAINDROP_CLIENT_SECRET=your_actual_client_secret
RAINDROP_REDIRECT_URI=http://localhost:8888/.netlify/functions/auth-callback
```

### 4. Local Development

Run the local development server with Netlify Functions:

```bash
npm run dev
```

Visit `http://localhost:8888` to see your new tab page.

## Deployment to Netlify

### Option 1: Netlify CLI

```bash
# Login to Netlify
netlify login

# Deploy
npm run deploy
```

### Option 2: Netlify Dashboard

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com)
3. Click "Add new site" > "Import an existing project"
4. Connect your GitHub repository
5. Configure build settings (they're already in netlify.toml)
6. Add environment variables:
   - `RAINDROP_CLIENT_ID`
   - `RAINDROP_CLIENT_SECRET`
   - `RAINDROP_REDIRECT_URI` (use your Netlify URL)
7. Deploy!

## Project Structure

```
.
├── index.html              # Main HTML page
├── styles.css              # Styling
├── app.js                  # Frontend JavaScript
├── netlify/
│   └── functions/
│       ├── auth-start.js      # Initiates OAuth flow
│       ├── auth-callback.js   # Handles OAuth callback
│       └── get-bookmarks.js   # Fetches bookmarks with OAuth token
├── netlify.toml            # Netlify configuration
└── package.json            # Dependencies and scripts
```

## Browser Extension Setup

To use this as your new tab page:

1. Deploy to Netlify and get your URL
2. Install a "Custom New Tab URL" extension for your browser
3. Set the URL to your Netlify deployment

## Customization

The bookmarks are currently fetched from the unsorted collection (ID: 0). To fetch from a specific collection, edit `netlify/functions/get-bookmarks.js:26` and change the endpoint.

## License

MIT
