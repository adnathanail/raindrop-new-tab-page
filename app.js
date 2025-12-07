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
    const loginEl = document.getElementById('login');

    loadingEl.classList.add('d-none');
    loginEl.classList.remove('d-none');

    document.getElementById('loginBtn').addEventListener('click', () => {
        window.location.href = '/.netlify/functions/auth-start';
    });
}

function renderBookmarks(bookmarks) {
    const bookmarksEl = document.getElementById('bookmarks');
    bookmarksEl.innerHTML = '';

    if (bookmarks.length === 0) {
        const emptyTemplate = document.getElementById('empty-template');
        bookmarksEl.appendChild(emptyTemplate.content.cloneNode(true));
        return;
    }

    const template = document.getElementById('bookmark-template');

    bookmarks.forEach(bookmark => {
        const clone = template.content.cloneNode(true);

        // Set the link
        const link = clone.querySelector('a');
        link.href = bookmark.link;

        // Set the title
        const title = clone.querySelector('[data-field="title"]');
        title.textContent = bookmark.title;

        // Set the excerpt (hide if empty)
        const excerpt = clone.querySelector('[data-field="excerpt"]');
        if (bookmark.excerpt) {
            excerpt.textContent = bookmark.excerpt;
        } else {
            excerpt.remove();
        }

        // Set the domain
        const domain = clone.querySelector('[data-field="domain"]');
        domain.textContent = extractDomain(bookmark.link);

        bookmarksEl.appendChild(clone);
    });
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
