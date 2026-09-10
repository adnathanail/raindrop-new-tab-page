// GitHub OAuth-specific utilities

const ACCESS_TOKEN_FALLBACK_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, used when GitHub doesn't report expires_in (non-expiring token)
const REFRESH_TOKEN_FALLBACK_MAX_AGE = 60 * 60 * 24 * 180; // ~6 months, GitHub's default refresh token lifetime

// Exchanges a refresh token for a new access/refresh token pair.
// Throws 'REFRESH_FAILED' if the refresh token is invalid, expired, or revoked.
async function refreshGithubToken(refreshToken) {
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

    const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        })
    });

    if (!response.ok) {
        throw new Error('REFRESH_FAILED');
    }

    const data = await response.json();

    if (data.error || !data.access_token) {
        throw new Error('REFRESH_FAILED');
    }

    return data;
}

// Builds Set-Cookie header values for a GitHub token response.
// Only includes a refresh_token cookie when GitHub actually issued one
// (i.e. "Expire user access tokens" is enabled on the OAuth App).
function buildGithubCookies(tokenData) {
    const cookies = [];

    const accessMaxAge = tokenData.expires_in || ACCESS_TOKEN_FALLBACK_MAX_AGE;
    cookies.push(`github_token=${tokenData.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${accessMaxAge}`);

    if (tokenData.refresh_token) {
        const refreshMaxAge = tokenData.refresh_token_expires_in || REFRESH_TOKEN_FALLBACK_MAX_AGE;
        cookies.push(`github_refresh_token=${tokenData.refresh_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${refreshMaxAge}`);
    }

    return cookies;
}

module.exports = {
    refreshGithubToken,
    buildGithubCookies
};
