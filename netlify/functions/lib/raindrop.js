// Shared utilities for Raindrop.io API interactions

function parseCookies(cookieHeader) {
    const cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            cookies[name] = value;
        });
    }
    return cookies;
}

function getAccessToken(event) {
    const cookies = parseCookies(event.headers.cookie);
    return cookies.raindrop_token;
}

function createAuthHeaders(accessToken) {
    return {
        'Authorization': `Bearer ${accessToken}`
    };
}

function createAuthErrorResponse() {
    return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            error: 'Not authenticated',
            needsAuth: true
        })
    };
}

function createTokenExpiredResponse() {
    return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            error: 'Token expired or invalid',
            needsAuth: true
        })
    };
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
    parseCookies,
    getAccessToken,
    createAuthHeaders,
    createAuthErrorResponse,
    createTokenExpiredResponse,
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup
};
