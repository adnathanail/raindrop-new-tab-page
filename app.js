// Main application logic

async function fetchBookmarks() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const bookmarksEl = document.getElementById('bookmarks');

    try {
        // Call our Netlify Function
        const response = await fetch('/.netlify/functions/get-bookmarks');

        // Check if authentication is needed
        if (response.status === 401) {
            const data = await response.json();
            if (data.needsAuth) {
                showLoginPrompt();
                return;
            }
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
        }

        const data = await response.json();

        // Hide loading
        loadingEl.classList.add('d-none');

        // Display bookmarks
        renderBookmarks(data.items || []);

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        loadingEl.classList.add('d-none');
        errorEl.textContent = `Error: ${error.message}`;
        errorEl.classList.remove('d-none');
    }
}

function showLoginPrompt() {
    const loadingEl = document.getElementById('loading');
    const bookmarksEl = document.getElementById('bookmarks');

    loadingEl.classList.add('d-none');

    bookmarksEl.innerHTML = `
        <div class="col-12">
            <div class="text-center text-white py-5">
                <h2 class="mb-3">Welcome!</h2>
                <p class="mb-4 opacity-75">Sign in with Raindrop.io to see your bookmarks</p>
                <button id="loginBtn" class="btn btn-light btn-lg px-4">
                    Sign in with Raindrop.io
                </button>
            </div>
        </div>
    `;

    document.getElementById('loginBtn').addEventListener('click', () => {
        window.location.href = '/.netlify/functions/auth-start';
    });
}

function renderBookmarks(bookmarks) {
    const bookmarksEl = document.getElementById('bookmarks');

    if (bookmarks.length === 0) {
        bookmarksEl.innerHTML = '<div class="col-12"><p class="text-white text-center">No bookmarks found.</p></div>';
        return;
    }

    bookmarksEl.innerHTML = bookmarks.map(bookmark => `
        <div class="col">
            <a href="${bookmark.link}" class="card h-100 text-decoration-none" target="_blank" rel="noopener noreferrer">
                <div class="card-body">
                    <h5 class="card-title">${escapeHtml(bookmark.title)}</h5>
                    ${bookmark.excerpt ? `<p class="card-text text-muted small">${escapeHtml(bookmark.excerpt)}</p>` : ''}
                    <p class="card-text"><small class="text-muted">${extractDomain(bookmark.link)}</small></p>
                </div>
            </a>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function extractDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch {
        return url;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchBookmarks);
} else {
    fetchBookmarks();
}
