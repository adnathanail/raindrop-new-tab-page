// Netlify Function to fetch the authenticated user's GitHub repos (public + private)
// Uses OAuth token from cookie for authentication

const {
    getGithubAccessToken,
    getGithubRefreshToken,
    createResponse,
    createAuthErrorResponse,
    createTokenExpiredResponse
} = require('./lib/utils');
const { refreshGithubToken, buildGithubCookies } = require('./lib/github');

const PER_PAGE = 100;

async function fetchAllRepos(accessToken) {
    const repos = [];
    let page = 1;

    while (true) {
        const reposResponse = await fetch(`https://api.github.com/user/repos?per_page=${PER_PAGE}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'raindrop-new-tab-page'
            }
        });

        if (!reposResponse.ok) {
            if (reposResponse.status === 401) {
                throw new Error('TOKEN_EXPIRED');
            }
            throw new Error(`Failed to fetch repos: ${reposResponse.statusText}`);
        }

        const pageRepos = await reposResponse.json();
        repos.push(...pageRepos);

        if (pageRepos.length < PER_PAGE) {
            break;
        }
        page++;
    }

    return repos;
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    const accessToken = getGithubAccessToken(event);
    const refreshToken = getGithubRefreshToken(event);

    if (!accessToken && !refreshToken) {
        return createAuthErrorResponse();
    }

    try {
        let repos;
        let refreshedCookies = null;

        try {
            if (!accessToken) {
                throw new Error('TOKEN_EXPIRED');
            }
            repos = await fetchAllRepos(accessToken);
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
                tokenData = await refreshGithubToken(refreshToken);
            } catch (refreshError) {
                return createTokenExpiredResponse();
            }

            refreshedCookies = buildGithubCookies(tokenData);
            repos = await fetchAllRepos(tokenData.access_token);
        }

        return createResponse(200, {
            repos: repos.filter(repo => !repo.archived).map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                url: repo.html_url,
                private: repo.private,
                description: repo.description
            }))
        }, { 'Cache-Control': 'private, max-age=300' }, refreshedCookies ? { 'Set-Cookie': refreshedCookies } : null);

    } catch (error) {
        console.error('Error fetching GitHub repos:', error);
        return createResponse(500, {
            error: 'Failed to fetch GitHub repos',
            message: error.message
        });
    }
};
