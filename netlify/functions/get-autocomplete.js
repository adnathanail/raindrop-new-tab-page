// Netlify Function to fetch autocomplete URLs from Raindrop.io
// Uses OAuth token from cookie for authentication

const {
    getAccessToken,
    createAuthHeaders,
    createResponse,
    createAuthErrorResponse,
    createTokenExpiredResponse
} = require('./lib/utils');

const {
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup
} = require('./lib/raindrop');

exports.handler = async function(event) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    // Extract access token from cookie
    const accessToken = getAccessToken(event);

    // Check if user is authenticated
    if (!accessToken) {
        return createAuthErrorResponse();
    }

    // Get name of group to display autocomplete URLs from
    const AUTOCOMPLETE_GROUP_NAME = process.env.RAINDROP_AUTOCOMPLETE_GROUP_NAME;

    if (!AUTOCOMPLETE_GROUP_NAME) {
        return createResponse(500, {
            error: 'RAINDROP_AUTOCOMPLETE_GROUP_NAME not set',
            needsAuth: true
        });
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

        const autocompleteGroup = userData.user.groups?.find(g => g.title === AUTOCOMPLETE_GROUP_NAME);

        if (!autocompleteGroup || !autocompleteGroup.collections || autocompleteGroup.collections.length === 0) {
            // Return empty results if group doesn't exist or has no collections
            return createResponse(200, { folders: [] }, { 'Cache-Control': 'private, max-age=300' });
        }

        // Step 2: Fetch all collections to get their titles
        const collectionsMap = await fetchCollectionsMap(authHeaders);

        // Step 3: Fetch bookmarks for each collection in the group
        const foldersWithBookmarks = await fetchBookmarksForGroup(autocompleteGroup, collectionsMap, authHeaders);

        return createResponse(200, { folders: foldersWithBookmarks }, { 'Cache-Control': 'private, max-age=300' });

    } catch (error) {
        console.error('Error fetching autocomplete data:', error);
        return createResponse(500, {
            error: 'Failed to fetch autocomplete data',
            message: error.message
        });
    }
};
