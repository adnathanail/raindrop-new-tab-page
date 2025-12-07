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
        loadingEl.classList.add('hidden');

        // Display bookmarks
        renderBookmarks(data.items || []);

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        loadingEl.classList.add('hidden');
        errorEl.textContent = `Error: ${error.message}`;
        errorEl.classList.remove('hidden');
    }
}

function showLoginPrompt() {
    const loadingEl = document.getElementById('loading');
    const bookmarksEl = document.getElementById('bookmarks');

    loadingEl.classList.add('hidden');

    bookmarksEl.innerHTML = `
        <div style="text-align: center; color: white; padding: 3rem;">
            <h2 style="margin-bottom: 1rem;">Welcome!</h2>
            <p style="margin-bottom: 2rem; opacity: 0.9;">Sign in with Raindrop.io to see your bookmarks</p>
            <button id="loginBtn" style="
                background: white;
                color: #667eea;
                border: none;
                padding: 1rem 2rem;
                font-size: 1rem;
                font-weight: 600;
                border-radius: 8px;
                cursor: pointer;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                Sign in with Raindrop.io
            </button>
        </div>
    `;

    document.getElementById('loginBtn').addEventListener('click', () => {
        window.location.href = '/.netlify/functions/auth-start';
    });
}

function renderBookmarks(bookmarks) {
    const bookmarksEl = document.getElementById('bookmarks');

    if (bookmarks.length === 0) {
        bookmarksEl.innerHTML = '<p style="color: white; text-align: center;">No bookmarks found.</p>';
        return;
    }

    bookmarksEl.innerHTML = bookmarks.map(bookmark => `
        <a href="${bookmark.link}" class="bookmark-card" target="_blank" rel="noopener noreferrer">
            <div class="bookmark-title">${escapeHtml(bookmark.title)}</div>
            ${bookmark.excerpt ? `<div class="bookmark-description">${escapeHtml(bookmark.excerpt)}</div>` : ''}
            <div class="bookmark-domain">${extractDomain(bookmark.link)}</div>
        </a>
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
