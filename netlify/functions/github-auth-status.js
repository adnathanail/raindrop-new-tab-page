// Reports whether GitHub OAuth is configured, and whether the visitor has a GitHub auth cookie set
const { getGithubAccessToken, getGithubRefreshToken, createResponse } = require('./lib/utils');

exports.handler = async function(event) {
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    const configured = !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && process.env.GITHUB_REDIRECT_URI);

    if (!configured) {
        return createResponse(200, { configured: false, authed: false });
    }

    const accessToken = getGithubAccessToken(event);
    const refreshToken = getGithubRefreshToken(event);

    return createResponse(200, { configured: true, authed: !!(accessToken || refreshToken) });
};
