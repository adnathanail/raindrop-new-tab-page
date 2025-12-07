// Main application logic

// Handle search form submission
function setupSearch() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const query = searchInput.value.trim();
        if (!query) return;

        // Check if input looks like a URL
        if (isURL(query)) {
            // Redirect to the URL
            let url = query;
            // Add protocol if missing
            if (!url.match(/^https?:\/\//i)) {
                url = 'https://' + url;
            }
            window.location.href = url;
        } else {
            // Search Google
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    });
}

// Check if string looks like a URL
function isURL(str) {
    // Check for common URL patterns
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    const domainPattern = /^[\da-z\.-]+\.[a-z\.]{2,6}$/i;

    // Check if it starts with http:// or https://
    if (str.match(/^https?:\/\//i)) {
        return true;
    }

    // Check if it looks like a domain (contains a dot and valid TLD)
    if (str.includes('.') && domainPattern.test(str)) {
        return true;
    }

    return false;
}

async function fetchBookmarks() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

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

        // Display folders with bookmarks
        renderFolders(data.folders || []);

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

function renderFolders(folders) {
    const bookmarksEl = document.getElementById('bookmarks');
    bookmarksEl.innerHTML = '';

    if (folders.length === 0) {
        return;
    }

    folders.forEach(folder => {
        const template = document.getElementById('folder-template');
        const clone = template.content.cloneNode(true);

        // Set the title
        const title = clone.querySelector('[data-field="folder-title"]');;
        title.textContent = folder.title;
        bookmarksEl.appendChild(clone);

        // Render bookmarks in this folder
        console.log(bookmarksEl.querySelector("div:last-child"))
        renderBookmarksInFolder(folder.bookmarks, bookmarksEl.querySelector('[data-field="bookmarks"]:last-child'));
    });
}

function renderBookmarksInFolder(bookmarks, container) {
    const template = document.getElementById('bookmark-template');

    bookmarks.forEach(bookmark => {
        const clone = template.content.cloneNode(true);

        // Set the link
        const link = clone.querySelector('a');
        link.href = bookmark.link;

        // Set the title
        const title = clone.querySelector('[data-field="title"]');
        title.textContent = bookmark.title;

        // Set the domain
        const domain = clone.querySelector('[data-field="domain"]');
        domain.textContent = extractDomain(bookmark.link);

        container.appendChild(clone);
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
    document.addEventListener('DOMContentLoaded', () => {
        setupSearch();
        fetchBookmarks();
    });
} else {
    setupSearch();
    fetchBookmarks();
}
