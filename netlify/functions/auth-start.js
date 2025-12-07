// Initiates the OAuth flow with Raindrop.io

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
    const REDIRECT_URI = process.env.RAINDROP_REDIRECT_URI;

    if (!CLIENT_ID || !REDIRECT_URI) {
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
                    <h1>OAuth Not Configured</h1>
                    <p>Please check your environment variables:</p>
                    <ul>
                        <li>RAINDROP_CLIENT_ID</li>
                        <li>RAINDROP_REDIRECT_URI</li>
                    </ul>
                    <a href="/">Return to home</a>
                </body>
                </html>
            `
        };
    }

    // Build Raindrop OAuth authorization URL
    const authUrl = new URL('https://raindrop.io/oauth/authorize');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

    // Use HTML meta redirect for better compatibility
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
        },
        body: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta http-equiv="refresh" content="0;url=${authUrl.toString()}">
                <title>Redirecting to Raindrop.io...</title>
            </head>
            <body>
                <p>Redirecting to Raindrop.io...</p>
                <p>If you are not redirected, <a href="${authUrl.toString()}">click here</a>.</p>
                <script>window.location.href = "${authUrl.toString()}";</script>
            </body>
            </html>
        `
    };
};
