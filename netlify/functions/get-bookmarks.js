// Netlify Function to fetch bookmarks from Raindrop.io
// Uses OAuth token from cookie for authentication

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

exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Extract access token from cookie
    const cookies = parseCookies(event.headers.cookie);
    const accessToken = cookies.raindrop_token;

    // Check if user is authenticated
    if (!accessToken) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Not authenticated',
                needsAuth: true
            })
        };
    }

    // Get name of group to display collections for
    const GROUP_NAME = process.env.RAINDROP_GROUP_NAME;

    if (!GROUP_NAME) {
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'RAINDROP_GROUP_NAME not set',
                needsAuth: true
            })
        };
    }

    try {
        const authHeaders = {
            'Authorization': `Bearer ${accessToken}`
        };

        // Step 1: Fetch authenticated user to get groups
        const userResponse = await fetch('https://api.raindrop.io/rest/v1/user', {
            headers: authHeaders
        });

        if (!userResponse.ok) {
            if (userResponse.status === 401) {
                return {
                    statusCode: 401,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        error: 'Token expired or invalid',
                        needsAuth: true
                    })
                };
            }
            throw new Error(`Failed to fetch user: ${userResponse.statusText}`);
        }

        const userData = await userResponse.json();
        const newTabGroup = userData.user.groups?.find(g => g.title === GROUP_NAME);

        if (!newTabGroup) {
            throw new Error(`No group found called '${GROUP_NAME}'`);
        }

        if (!newTabGroup.collections || newTabGroup.collections.length === 0) {
            throw new Error(`${GROUP_NAME} group contains no collections`);
        }

        // Step 2: Fetch all collections to get their titles
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

        // Step 3: Fetch bookmarks for each collection in the group
        const foldersWithBookmarks = [];

        for (const collectionId of newTabGroup.collections) {
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

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, max-age=300'
            },
            body: JSON.stringify({ folders: foldersWithBookmarks })
        };

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch bookmarks',
                message: error.message
            })
        };
    }
};
