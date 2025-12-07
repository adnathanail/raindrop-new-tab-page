// Netlify Function to fetch bookmarks from Raindrop.io
// Uses OAuth token from cookie for authentication

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

exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Extract access token from cookie
    const cookies = parseCookies(event.headers.cookie);
    const accessToken = cookies.raindrop_token;

    // Check if user is authenticated
    if (!accessToken) {
        return {
            statusCode: 401,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Not authenticated',
                needsAuth: true
            })
        };
    }

    try {
        // Fetch bookmarks from Raindrop.io API
        // Using the /raindrops/0 endpoint to get all unsorted bookmarks
        // You can modify this to fetch from specific collections
        const response = await fetch('https://api.raindrop.io/rest/v1/raindrops/0', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!response.ok) {
            // If token is invalid or expired, return auth error
            if (response.status === 401) {
                return {
                    statusCode: 401,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        error: 'Token expired or invalid',
                        needsAuth: true
                    })
                };
            }
            throw new Error(`Raindrop API error: ${response.statusText}`);
        }

        const data = await response.json();

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'private, max-age=300' // Cache for 5 minutes
            },
            body: JSON.stringify(data)
        };

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to fetch bookmarks',
                message: error.message
            })
        };
    }
};
