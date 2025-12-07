// Netlify Function to fetch bookmarks from Raindrop.io
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

    // Get names of groups to fetch
    const NEW_TAB_GROUP_NAME = process.env.RAINDROP_GROUP_NAME;
    const AUTOCOMPLETE_GROUP_NAME = process.env.RAINDROP_AUTOCOMPLETE_GROUP_NAME;

    if (!NEW_TAB_GROUP_NAME) {
        return createResponse(500, {
            error: 'RAINDROP_GROUP_NAME not set',
            needsAuth: true
        });
    }

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

        const newTabGroup = userData.user.groups?.find(g => g.title === NEW_TAB_GROUP_NAME);
        const autocompleteGroup = userData.user.groups?.find(g => g.title === AUTOCOMPLETE_GROUP_NAME);

        if (!newTabGroup) {
            throw new Error(`No group found called '${NEW_TAB_GROUP_NAME}'`);
        }

        if (!newTabGroup.collections || newTabGroup.collections.length === 0) {
            throw new Error(`${NEW_TAB_GROUP_NAME} group contains no collections`);
        }

        // Step 2: Fetch all collections to get their titles
        const collectionsMap = await fetchCollectionsMap(authHeaders);

        // Step 3: Fetch bookmarks for both groups
        const newTabFolders = await fetchBookmarksForGroup(newTabGroup, collectionsMap, authHeaders);
        const autocompleteFolders = autocompleteGroup
            ? await fetchBookmarksForGroup(autocompleteGroup, collectionsMap, authHeaders)
            : [];

        return createResponse(200, {
            display: newTabFolders,
            autocomplete: autocompleteFolders
        }, { 'Cache-Control': 'private, max-age=300' });

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return createResponse(500, {
            error: 'Failed to fetch bookmarks',
            message: error.message
        });
    }
};
