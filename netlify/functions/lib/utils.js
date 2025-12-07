// General utilities for Netlify Functions

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

function getAccessToken(event) {
    const cookies = parseCookies(event.headers.cookie);
    return cookies.raindrop_token;
}

function createAuthHeaders(accessToken) {
    return {
        'Authorization': `Bearer ${accessToken}`
    };
}

function createResponse(statusCode, body, additionalHeaders = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...additionalHeaders
        },
        body: JSON.stringify(body)
    };
}

function createAuthErrorResponse() {
    return createResponse(401, {
        error: 'Not authenticated',
        needsAuth: true
    });
}

function createTokenExpiredResponse() {
    return createResponse(401, {
        error: 'Token expired or invalid',
        needsAuth: true
    });
}

module.exports = {
    parseCookies,
    getAccessToken,
    createAuthHeaders,
    createResponse,
    createAuthErrorResponse,
    createTokenExpiredResponse
};
