// Netlify Function to fetch the authenticated user's GitHub repos (public + private)
// Uses OAuth token from cookie for authentication

const {
    getGithubAccessToken,
    createResponse,
    createAuthErrorResponse,
    createTokenExpiredResponse
} = require('./lib/utils');

exports.handler = async function(event) {
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    const accessToken = getGithubAccessToken(event);

    if (!accessToken) {
        return createAuthErrorResponse();
    }

    try {
        const reposResponse = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json',
                'User-Agent': 'raindrop-new-tab-page'
            }
        });

        if (!reposResponse.ok) {
            if (reposResponse.status === 401) {
                return createTokenExpiredResponse();
            }
            throw new Error(`Failed to fetch repos: ${reposResponse.statusText}`);
        }

        const repos = await reposResponse.json();

        return createResponse(200, {
            repos: repos.map(repo => ({
                name: repo.name,
                fullName: repo.full_name,
                url: repo.html_url,
                private: repo.private,
                description: repo.description
            }))
        }, { 'Cache-Control': 'private, max-age=300' });

    } catch (error) {
        console.error('Error fetching GitHub repos:', error);
        return createResponse(500, {
            error: 'Failed to fetch GitHub repos',
            message: error.message
        });
    }
};
