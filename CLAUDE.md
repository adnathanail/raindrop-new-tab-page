# Claude Code Notes - Raindrop New Tab Page

## Project Overview
A Progressive Web App (PWA) that serves as a clean new tab page displaying bookmarks from Raindrop.io. The app uses OAuth authentication to fetch and display bookmarks organized by collections.

## Architecture

### Frontend
- **index.html**: Main HTML page with Bootstrap 5 layout
  - Responsive design with mobile-first approach
  - Search bar for Google search or direct URL navigation
  - Template-based rendering for bookmarks and folders
  - Service worker registration for PWA functionality

- **app.js**: Client-side JavaScript
  - Handles bookmark fetching and rendering
  - Manages OAuth flow
  - Implements search functionality with autocomplete
  - Autocomplete searches through both "New Tab" and "Autocomplete URLs" groups
  - Keyboard navigation (arrow keys, Enter, Escape)
  - Click to reopen autocomplete when refocusing search box
  - GitHub search bar: checks `/.netlify/functions/github-auth-status` on load. If GitHub OAuth
    isn't configured (`configured: false` — missing `GITHUB_CLIENT_ID`/`SECRET`/`REDIRECT_URI`),
    the whole search column is hidden and the main search bar takes the row. Otherwise, when not
    authed, disables the input and turns the button into a "Sign In" link. When authed, loads the user's
    repos (public + private, via `/.netlify/functions/get-github-repos`) and filters them
    client-side as you type — same `createAutocomplete()` factory the bookmarks search bar uses,
    parameterized per search box. Selecting a result navigates straight to the repo on GitHub.
  - When a query matches nothing, two fallback rows show instead (both titled "No repos found"):
    "Refresh cache" re-fetches the repo list bypassing the server's 5-min HTTP cache (handles a
    repo added/renamed since the page loaded); "Grant more access" links to
    `github-manage-access` (see below), for repos missing because an org hasn't approved the
    OAuth App yet.

- **Service Worker (sw.js)**:
  - Cache name: `raindrop-newtab-v1`
  - Caches static assets (HTML, JS, CSS from CDN)
  - **Strategy**: Cache-first for static assets with background updates
  - **API Strategy**: Network-first for Netlify Functions (`/.netlify/functions/*`)
  - Offline fallback with JSON error response for API calls
  - Implements install, activate, and fetch event handlers

- **PWA Manifest (manifest.json)**:

### Backend (Netlify Functions)

- **get-bookmarks.js** (`/.netlify/functions/get-bookmarks`):
  - Fetches bookmarks from Raindrop.io API for both display and autocomplete
  - Uses OAuth token from `raindrop_token` cookie
  - Requires `RAINDROP_GROUP_NAME` and `RAINDROP_AUTOCOMPLETE_GROUP_NAME` environment variables
  - **Flow**:
    1. Validates OAuth token from cookie
    2. Fetches user data to find both specified groups
    3. Fetches all collections to build a collections map
    4. Fetches bookmarks for both groups
    5. Returns combined data for display and autocomplete
  - **Returns**:
    - `display`: Folders from the New Tab group to show on the page
    - `autocomplete`: Folders from the Autocomplete URLs group only
    - Frontend combines both for search autocomplete
    - Format: `{ display: [...], autocomplete: [...] }`
  - **Error handling**: Returns 401 with `needsAuth: true` for auth issues

- **lib/utils.js**: General HTTP and Netlify utilities
  - Cookie parsing and token extraction
  - Authentication header creation
  - HTTP response creation helpers
  - Error response templates

- **lib/raindrop.js**: Raindrop.io API-specific utilities
  - Raindrop API calls (user data, collections, bookmarks)
  - Group and collection fetching logic

- **github-auth-start.js** / **github-auth-callback.js** (`/.netlify/functions/github-auth-*`):
  - Mirrors the Raindrop OAuth flow (`auth-start.js` / `auth-callback.js`) but for GitHub
  - Uses `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI` env vars
  - Callback stores the access token in an HttpOnly `github_token` cookie. If the GitHub OAuth
    App has "Expire user access tokens" enabled, GitHub also returns a `refresh_token` (~6 month
    lifetime), which is stored in a separate HttpOnly `github_refresh_token` cookie via
    `lib/github.js`'s `buildGithubCookies()`. Cookie `Max-Age`s are taken from the token
    response's `expires_in` / `refresh_token_expires_in` when present, falling back to 30 days /
    ~6 months for non-expiring tokens (the setting disabled)
  - Requests the `repo` OAuth scope so private repos are included in search

- **lib/github.js**: GitHub OAuth-specific utilities
  - `refreshGithubToken(refreshToken)`: exchanges a refresh token for a new access/refresh token
    pair via GitHub's `grant_type=refresh_token` flow; throws `REFRESH_FAILED` if the refresh
    token is invalid/expired/revoked
  - `buildGithubCookies(tokenData)`: builds the `Set-Cookie` header values for a token response
    (used by both the OAuth callback and the transparent-refresh path in `get-github-repos.js`)

- **github-auth-status.js** (`/.netlify/functions/github-auth-status`):
  - Lightweight check used by the frontend to gate the GitHub search bar
  - Returns `{ authed: true/false }` based on presence of the `github_token` cookie only
    (does not validate the token against the GitHub API)

- **get-github-repos.js** (`/.netlify/functions/get-github-repos`):
  - Fetches the authenticated user's repos via `GET /user/repos` (owner + collaborator + org),
    paginating through all pages (100 per page) until a short page is returned
  - Returns `{ repos: [{ name, fullName, url, private, description }] }`
  - Same 401/`needsAuth` pattern as `get-bookmarks.js`, but if the access token is missing/expired
    and a `github_refresh_token` cookie is present, it transparently refreshes via
    `lib/github.js`'s `refreshGithubToken()`, retries the request, and sets updated cookies on
    the response (`multiValueHeaders['Set-Cookie']`) — no re-login needed. Falls back to the
    401/`needsAuth` response only if there's no refresh token or the refresh call itself fails

- **github-manage-access.js** (`/.netlify/functions/github-manage-access`):
  - Redirects to `https://github.com/settings/connections/applications/{GITHUB_CLIENT_ID}`
  - This is where org access is actually granted for an OAuth App — re-running `github-auth-start`
    does NOT show the consent screen again once the current scope is already granted, so it can't
    be used to pick up newly-visible orgs
  - Linked from the GitHub search bar's "No repos found — Grant more access" fallback row

## Environment Variables

Required environment variables (set in Netlify):
- `RAINDROP_GROUP_NAME`: Name of the Raindrop.io group to display collections from
- `RAINDROP_AUTOCOMPLETE_GROUP_NAME`: Name of the Raindrop.io group for autocomplete suggestions
- `RAINDROP_CLIENT_ID` / `RAINDROP_CLIENT_SECRET` / `RAINDROP_REDIRECT_URI`: Raindrop OAuth app credentials

Optional (gates the GitHub search bar; omit to leave it showing the sign-in prompt):
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI`: GitHub OAuth app credentials
  (the OAuth app must allow the `repo` scope to search private repos)

## Authentication Flow

1. User visits page
2. If no `raindrop_token` cookie exists, show login button
3. Login redirects to OAuth flow (handled by separate function)
4. OAuth callback sets `raindrop_token` cookie
5. App fetches bookmarks using the token
6. Token is validated on each request to `/get-bookmarks`

## Dependencies

### CDN Dependencies
- Bootstrap 5.3.2 (CSS + JS bundle)
- Font Awesome Free 6 (static CSS, via jsDelivr — swapped from the Kit loader to avoid icon flash on load)

### Backend Dependencies
- Node.js (for Netlify Functions)
- No external npm packages used in functions (uses native fetch)

## File Structure
```
/
├── index.html              # Main HTML page
├── app.js                  # Frontend JavaScript
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
├── netlify.toml           # Netlify configuration
├── netlify/
│   └── functions/
│       ├── get-bookmarks.js        # Fetch bookmarks function
│       ├── github-auth-start.js    # Initiates GitHub OAuth flow
│       ├── github-auth-callback.js # Handles GitHub OAuth callback
│       └── github-auth-status.js   # Reports whether the GitHub auth cookie is set
└── CLAUDE.md              # This file
```

## Important Implementation Details

### Search Functionality
- Form ID: `searchForm`
- Input ID: `searchInput`
- Determines if input is URL or search query
- URLs: Direct navigation
- Non-URLs: Google search

### Bookmark Rendering
- Uses HTML `<template>` elements for:
  - `folder-template`: Collection/folder header
  - `bookmark-template`: Individual bookmark cards
- Bootstrap grid: Responsive columns (1 on mobile → 2 on md → 3 on lg → 4 on xl)

### Caching Strategy
- Static assets cached on service worker install
- Cache updated in background when serving from cache
- API calls use network-first strategy
- Old caches cleaned up on activate

### Security Headers (netlify.toml)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

## API Endpoints

### Raindrop.io API
- Base URL: `https://api.raindrop.io/rest/v1`
- Authentication: Bearer token in Authorization header
- Endpoints used:
  - `/user` - Get user data including groups
  - `/collections` - Get all collections
  - `/raindrops/{collectionId}` - Get bookmarks in a collection

### Netlify Functions
- `/api/*` redirects to `/.netlify/functions/*` (status 200)
- Available functions:
  - `/api/get-bookmarks` - Fetch bookmarks for the configured group

## Common Tasks

### Adding New Collections
Collections are managed in Raindrop.io. The app automatically displays all collections within the group specified by `RAINDROP_GROUP_NAME`.

### Updating Cached Assets
1. Change `CACHE_NAME` in sw.js (e.g., `raindrop-newtab-v2`)
2. Update `urlsToCache` array if needed
3. Service worker will auto-update on next page load

### Debugging Auth Issues
- Check browser cookies for `raindrop_token`
- Verify `RAINDROP_GROUP_NAME` is set in Netlify environment
- Check Netlify function logs for API errors
- Ensure OAuth token hasn't expired (returns 401 with `needsAuth: true`)

## Known Patterns

### Error Display
- `#loading` - Shown while fetching bookmarks
- `#login` - Shown when not authenticated
- `#error` - Shown for error messages
- `#bookmarks` - Container for bookmark content

### Response Format
The get-bookmarks function expects Raindrop.io API to return:
- User data with `user.groups[]` containing group objects
- Each group has `{ title, collections: [collectionIds] }`
- Collections endpoint returns `{ items: [collection objects] }`
- Raindrops endpoint returns `{ items: [bookmark objects] }`
