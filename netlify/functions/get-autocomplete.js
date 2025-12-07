// Netlify Function to fetch autocomplete URLs from Raindrop.io
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

    // Hardcode the autocomplete group name
    const AUTOCOMPLETE_GROUP_NAME = 'Autocomplete URLs';

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
        const autocompleteGroup = userData.user.groups?.find(g => g.title === AUTOCOMPLETE_GROUP_NAME);

        if (!autocompleteGroup) {
            // Return empty results if group doesn't exist
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, max-age=300'
                },
                body: JSON.stringify({ folders: [] })
            };
        }

        if (!autocompleteGroup.collections || autocompleteGroup.collections.length === 0) {
            // Return empty results if no collections
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'private, max-age=300'
                },
                body: JSON.stringify({ folders: [] })
            };
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

        for (const collectionId of autocompleteGroup.collections) {
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
        console.error('Error fetching autocomplete data:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch autocomplete data',
                message: error.message
            })
        };
    }
};
