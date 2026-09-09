// Redirects to GitHub's "Authorized OAuth Apps" settings page for this app, where org access
// can be requested/granted. Re-running the OAuth flow doesn't show this — GitHub skips the
// consent screen once a user has already granted the current scope, so org access has to be
// managed from here instead.
const { renderTemplate } = require('./lib/templates');

exports.handler = async function(event, context) {
    const CLIENT_ID = process.env.GITHUB_CLIENT_ID;

    if (!CLIENT_ID) {
        const html = renderTemplate('error', {
            TITLE: 'Configuration Error',
            HEADING: 'OAuth Not Configured',
            CONTENT: `
                <p>Please check your environment variables:</p>
                <ul>
                    <li>GITHUB_CLIENT_ID</li>
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

    const html = renderTemplate('redirect', {
        REDIRECT_URL: `https://github.com/settings/connections/applications/${CLIENT_ID}`,
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
