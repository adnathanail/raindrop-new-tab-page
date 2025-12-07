// Raindrop.io API-specific utilities

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
    fetchUserData,
    fetchCollectionsMap,
    fetchBookmarksForGroup
};
