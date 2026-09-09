// Handles OAuth callback from GitHub and exchanges code for access token
const { renderTemplate } = require('./lib/templates');

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
    const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

    // Get the authorization code from query parameters
    const code = event.queryStringParameters?.code;

    if (!code) {
        const html = renderTemplate('error', {
            TITLE: 'Error',
            HEADING: 'Missing Authorization Code',
            CONTENT: `<p>Query params: ${JSON.stringify(event.queryStringParameters)}</p>`
        });

        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            },
            body: html
        };
    }

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        const html = renderTemplate('error', {
            TITLE: 'Configuration Error',
            HEADING: 'OAuth Not Configured Properly',
            CONTENT: '<p>Check environment variables</p>'
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: html
        };
    }

    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                code: code,
                redirect_uri: REDIRECT_URI
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            throw new Error(tokenData.error_description || tokenData.error);
        }

        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new Error('No access token received');
        }

        // Store the access token in a secure HTTP-only cookie
        const cookieValue = `github_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`; // 30 days

        const html = renderTemplate('redirect', {
            REDIRECT_URL: '/',
            TITLE: 'Authentication Successful',
            MESSAGE: 'Authentication successful! Redirecting...'
        });

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Set-Cookie': cookieValue,
                'Cache-Control': 'no-cache'
            },
            body: html
        };

    } catch (error) {
        console.error('GitHub OAuth callback error:', error);

        const html = renderTemplate('error', {
            TITLE: 'Authentication Error',
            HEADING: 'Authentication Failed',
            CONTENT: `<p>${error.message}</p>`
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: html
        };
    }
};
