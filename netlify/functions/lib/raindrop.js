// Raindrop.io API-specific utilities

const ACCESS_TOKEN_FALLBACK_MAX_AGE = 60 * 60 * 24 * 14; // 2 weeks (Raindrop's documented access token lifetime), used when it doesn't report expires_in
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 365; // Raindrop doesn't report a refresh token lifetime; keep it a year and let a failed refresh send us back to login

// Exchanges a refresh token for a new access token.
// Throws 'REFRESH_FAILED' if the refresh token is invalid, expired, or revoked.
async function refreshRaindropToken(refreshToken) {
    const response = await fetch('https://raindrop.io/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            client_id: process.env.RAINDROP_CLIENT_ID,
            client_secret: process.env.RAINDROP_CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        console.error('Raindrop token refresh failed:', await response.text());
        throw new Error('REFRESH_FAILED');
    }

    const data = await response.json();

    if (data.error || !data.access_token) {
        console.error('Raindrop token refresh failed:', data);
        throw new Error('REFRESH_FAILED');
    }

    // Keep using the old refresh token if Raindrop didn't rotate it
    return { ...data, refresh_token: data.refresh_token || refreshToken };
}

// Builds Set-Cookie header values for a Raindrop token response (used by both the OAuth
// callback and the transparent-refresh path in get-bookmarks.js).
// Also records the access token's expiry (epoch ms) in a non-HttpOnly `raindrop_token_expires`
// cookie so the frontend can show it for debugging - browsers don't expose cookie expiry, and
// the token cookie is HttpOnly anyway. It lives as long as the refresh token, so an expired
// access token still shows as "expired" rather than "unknown".
function buildRaindropCookies(tokenData) {
    const accessMaxAge = tokenData.expires_in || ACCESS_TOKEN_FALLBACK_MAX_AGE;
    const expiresAt = tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : '';

    const cookies = [
        `raindrop_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${accessMaxAge}`,
        `raindrop_token_expires=${expiresAt}; Path=/; SameSite=Lax; Max-Age=${REFRESH_TOKEN_MAX_AGE}`
    ];

    if (tokenData.refresh_token) {
        cookies.push(`raindrop_refresh_token=${tokenData.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${REFRESH_TOKEN_MAX_AGE}`);
    }

    return cookies;
}

async function fetchUserData(authHeaders) {
    const userResponse = await fetch('https://api.raindrop.io/rest/v1/user', {
        headers: authHeaders
    });

    if (!userResponse.ok) {
        if (userResponse.status === 401) {
            throw new Error('TOKEN_EXPIRED');
        }
        throw new Error(`Failed to fetch user: ${userResponse.statusText}`);
    }

    return await userResponse.json();
}

async function fetchCollectionsMap(authHeaders) {
    const collectionsResponse = await fetch('https://api.raindrop.io/rest/v1/collections', {
        headers: authHeaders
    });

    if (!collectionsResponse.ok) {
        throw new Error(`Failed to fetch collections: ${collectionsResponse.statusText}`);
    }

    const collectionsData = await collectionsResponse.json();
    const collectionsMap = {};
    collectionsData.items.forEach(c => {
        collectionsMap[c._id] = c;
    });

    return collectionsMap;
}

async function fetchBookmarksForGroup(group, collectionsMap, authHeaders) {
    const foldersWithBookmarks = [];

    for (const collectionId of group.collections) {
        const collection = collectionsMap[collectionId];
        if (!collection) continue;

        const bookmarksResponse = await fetch(`https://api.raindrop.io/rest/v1/raindrops/${collectionId}`, {
            headers: authHeaders
        });

        if (bookmarksResponse.ok) {
            const bookmarksData = await bookmarksResponse.json();

            if (bookmarksData.items && bookmarksData.items.length > 0) {
                foldersWithBookmarks.push({
                    id: collectionId,
                    title: collection.title,
                    bookmarks: bookmarksData.items
                });
            }
        }
    }

    return foldersWithBookmarks;
}

module.exports = {
    refreshRaindropToken,
    buildRaindropCookies,
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup
};
