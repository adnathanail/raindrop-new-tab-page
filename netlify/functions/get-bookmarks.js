// Netlify Function to fetch bookmarks from Raindrop.io
// Uses OAuth token from cookie for authentication

const {
    getAccessToken,
    createAuthHeaders,
    createAuthErrorResponse,
    createTokenExpiredResponse,
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup
} = require('./lib/raindrop');

exports.handler = async function(event) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Extract access token from cookie
    const accessToken = getAccessToken(event);

    // Check if user is authenticated
    if (!accessToken) {
        return createAuthErrorResponse();
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
        const authHeaders = createAuthHeaders(accessToken);

        // Step 1: Fetch authenticated user to get groups
        let userData;
        try {
            userData = await fetchUserData(authHeaders);
        } catch (error) {
            if (error.message === 'TOKEN_EXPIRED') {
                return createTokenExpiredResponse();
            }
            throw error;
        }

        const newTabGroup = userData.user.groups?.find(g => g.title === GROUP_NAME);

        if (!newTabGroup) {
            throw new Error(`No group found called '${GROUP_NAME}'`);
        }

        if (!newTabGroup.collections || newTabGroup.collections.length === 0) {
            throw new Error(`${GROUP_NAME} group contains no collections`);
        }

        // Step 2: Fetch all collections to get their titles
        const collectionsMap = await fetchCollectionsMap(authHeaders);

        // Step 3: Fetch bookmarks for each collection in the group
        const foldersWithBookmarks = await fetchBookmarksForGroup(newTabGroup, collectionsMap, authHeaders);

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
