// Initiates the OAuth flow with Raindrop.io
const { renderTemplate } = require('./lib/templates');

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.RAINDROP_CLIENT_ID;
    const REDIRECT_URI = process.env.RAINDROP_REDIRECT_URI;

    if (!CLIENT_ID || !REDIRECT_URI) {
        const html = renderTemplate('error', {
            TITLE: 'Configuration Error',
            HEADING: 'OAuth Not Configured',
            CONTENT: `
                <p>Please check your environment variables:</p>
                <ul>
                    <li>RAINDROP_CLIENT_ID</li>
                    <li>RAINDROP_REDIRECT_URI</li>
                </ul>
            `
        });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/html'
            },
            body: html
        };
    }

    // Build Raindrop OAuth authorization URL
    const authUrl = new URL('https://raindrop.io/oauth/authorize');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

    const html = renderTemplate('redirect', {
        REDIRECT_URL: authUrl.toString(),
        TITLE: 'Redirecting to Raindrop.io...',
        MESSAGE: 'Redirecting to Raindrop.io...'
    });

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache'
        },
        body: html
    };
};
