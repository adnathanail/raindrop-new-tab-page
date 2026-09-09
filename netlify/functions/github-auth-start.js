// Initiates the OAuth flow with GitHub
const { renderTemplate } = require('./lib/templates');

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const REDIRECT_URI = process.env.GITHUB_REDIRECT_URI;

    if (!CLIENT_ID || !REDIRECT_URI) {
        const html = renderTemplate('error', {
            TITLE: 'Configuration Error',
            HEADING: 'OAuth Not Configured',
            CONTENT: `
                <p>Please check your environment variables:</p>
                <ul>
                    <li>GITHUB_CLIENT_ID</li>
                    <li>GITHUB_REDIRECT_URI</li>
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

    // Build GitHub OAuth authorization URL
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);

    const html = renderTemplate('redirect', {
        REDIRECT_URL: authUrl.toString(),
        TITLE: 'Redirecting to GitHub...',
        MESSAGE: 'Redirecting to GitHub...'
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
