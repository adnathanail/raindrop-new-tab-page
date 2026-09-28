// Netlify Function to fetch bookmarks from Raindrop.io
// Uses OAuth token from cookie for authentication

const {
    getAccessToken,
    getRefreshToken,
    createAuthHeaders,
    createResponse,
    createAuthErrorResponse,
    createTokenExpiredResponse
} = require('./lib/utils');

const {
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup,
    refreshRaindropToken,
    buildRaindropCookies
} = require('./lib/raindrop');

exports.handler = async function(event) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    // Extract tokens from cookies
    const accessToken = getAccessToken(event);
    const refreshToken = getRefreshToken(event);

    // Check if user is authenticated
    if (!accessToken && !refreshToken) {
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
        let authHeaders = accessToken ? createAuthHeaders(accessToken) : null;
        let refreshedCookies = null;

        // Step 1: Fetch authenticated user to get groups
        let userData;
        try {
            if (!authHeaders) {
                throw new Error('TOKEN_EXPIRED');
            }
            userData = await fetchUserData(authHeaders);
        } catch (error) {
            if (error.message !== 'TOKEN_EXPIRED') {
                throw error;
            }

            // Access token missing/expired - try to use the refresh token to get a new one
            if (!refreshToken) {
                return createTokenExpiredResponse();
            }

            let tokenData;
            try {
                tokenData = await refreshRaindropToken(refreshToken);
            } catch (refreshError) {
                return createTokenExpiredResponse();
            }

            refreshedCookies = buildRaindropCookies(tokenData);
            authHeaders = createAuthHeaders(tokenData.access_token);
            userData = await fetchUserData(authHeaders);
        }

        const newTabGroup = userData.user.groups?.find(g => g.title === NEW_TAB_GROUP_NAME);
        const autocompleteGroup = userData.user.groups?.find(g => g.title === AUTOCOMPLETE_GROUP_NAME);

        if (!newTabGroup) {
            throw new Error(`No group found called '${NEW_TAB_GROUP_NAME}'`);
        }

        if (!newTabGroup.collections || newTabGroup.collections.length === 0) {
            throw new Error(`${NEW_TAB_GROUP_NAME} group contains no collections`);
        }

        if (!autocompleteGroup) {
            throw new Error(`No group found called '${AUTOCOMPLETE_GROUP_NAME}'`);
        }

        if (!autocompleteGroup.collections || autocompleteGroup.collections.length === 0) {
            throw new Error(`${AUTOCOMPLETE_GROUP_NAME} group contains no collections`);
        }

        // Step 2: Fetch all collections to get their titles
        const collectionsMap = await fetchCollectionsMap(authHeaders);

        // Step 3: Fetch bookmarks for both groups
        const newTabFolders = await fetchBookmarksForGroup(newTabGroup, collectionsMap, authHeaders);
        const autocompleteFolders = await fetchBookmarksForGroup(autocompleteGroup, collectionsMap, authHeaders);

        return createResponse(200, {
            display: newTabFolders,
            autocomplete: autocompleteFolders
        }, { 'Cache-Control': 'private, max-age=300' }, refreshedCookies ? { 'Set-Cookie': refreshedCookies } : null);

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return createResponse(500, {
            error: 'Failed to fetch bookmarks',
            message: error.message
        });
    }
};
