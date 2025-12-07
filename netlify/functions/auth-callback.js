// Handles OAuth callback from Raindrop.io and exchanges code for access token

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
    const CLIENT_SECRET = process.env.RAINDROP_CLIENT_SECRET;
    const REDIRECT_URI = process.env.RAINDROP_REDIRECT_URI;

    // Get the authorization code from query parameters
    const code = event.queryStringParameters?.code;

    console.log('Auth callback received:', {
        hasCode: !!code,
        hasClientId: !!CLIENT_ID,
        hasClientSecret: !!CLIENT_SECRET,
        redirectUri: REDIRECT_URI
    });

    if (!code) {
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head><title>Error</title></head>
                <body>
                    <h1>Missing authorization code</h1>
                    <p>Query params: ${JSON.stringify(event.queryStringParameters)}</p>
                    <a href="/">Return to home</a>
                </body>
                </html>
            `
        };
    }

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head><title>Configuration Error</title></head>
                <body>
                    <h1>OAuth not configured properly</h1>
                    <p>Check environment variables</p>
                    <a href="/">Return to home</a>
                </body>
                </html>
            `
        };
    }

    try {
        // Exchange authorization code for access token
        const tokenResponse = await fetch('https://raindrop.io/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            })
        });

        if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            console.error('Token exchange failed:', errorText);
            throw new Error('Failed to exchange code for token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new Error('No access token received');
        }

        // Store the access token in a secure HTTP-only cookie
        const cookieValue = `raindrop_token=${accessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`; // 30 days

        // Redirect back to the home page using HTML redirect
        // This ensures the cookie is set properly in local development
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Set-Cookie': cookieValue,
                'Cache-Control': 'no-cache'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta http-equiv="refresh" content="0;url=/">
                    <title>Authentication Successful</title>
                </head>
                <body>
                    <p>Authentication successful! Redirecting...</p>
                    <script>window.location.href = "/";</script>
                </body>
                </html>
            `
        };

    } catch (error) {
        console.error('OAuth callback error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: `
                <!DOCTYPE html>
                <html>
                <head><title>Authentication Error</title></head>
                <body>
                    <h1>Authentication Failed</h1>
                    <p>${error.message}</p>
                    <a href="/">Return to home</a>
                </body>
                </html>
            `
        };
    }
};
