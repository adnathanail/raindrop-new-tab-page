// Reports whether the visitor has a GitHub auth cookie set
const { getGithubAccessToken, createResponse } = require('./lib/utils');

exports.handler = async function(event) {
    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    const accessToken = getGithubAccessToken(event);

    return createResponse(200, { authed: !!accessToken });
};
