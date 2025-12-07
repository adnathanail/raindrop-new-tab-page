// Main application logic

// Autocomplete state
let autocompleteData = [];
let filteredSuggestions = [];
let selectedIndex = -1;

// Handle search form submission
function setupSearch() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const query = searchInput.value.trim();
        if (!query) return;

        // If there's a selected autocomplete item, use it
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
            navigateToSuggestion(filteredSuggestions[selectedIndex]);
            return;
        }

        // Check if input looks like a URL
        if (isURL(query)) {
            // Redirect to the URL
            let url = query;
            // Add protocol if missing
            if (!url.match(/^https?:\/\//i)) {
                url = `https://${url}`;
            }
            window.location.href = url;
        } else {
            // Search Google
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    });

    // Setup autocomplete
    setupAutocomplete();
}

function navigateToSuggestion(suggestion) {
    let url = suggestion.link;
    if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }
    window.location.href = url;
}

function setupAutocomplete() {
    const searchInput = document.getElementById('searchInput');
    const dropdown = document.getElementById('autocompleteDropdown');

    // Fetch autocomplete data
    fetchAutocompleteData();

    // Handle input changes
    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.trim().toLowerCase();

        if (query.length === 0) {
            hideAutocomplete();
            return;
        }

        // Filter suggestions
        filteredSuggestions = [];
        autocompleteData.forEach(folder => {
            folder.bookmarks.forEach(bookmark => {
                const titleMatch = bookmark.title.toLowerCase().includes(query);
                const linkMatch = bookmark.link.toLowerCase().includes(query);

                if (titleMatch || linkMatch) {
                    filteredSuggestions.push({
                        ...bookmark,
                        folderTitle: folder.title
                    });
                }
            });
        });

        if (filteredSuggestions.length > 0) {
            showAutocomplete(filteredSuggestions);
            selectedIndex = 0; // Select first item by default
        } else {
            hideAutocomplete();
        }
    });

    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        if (dropdown.classList.contains('show')) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredSuggestions.length - 1);
                updateSelectedItem();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedItem();
            } else if (e.key === 'Escape') {
                hideAutocomplete();
            }
        }
    });

    // Click outside to close
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            hideAutocomplete();
        }
    });
}

function showAutocomplete(suggestions) {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.innerHTML = '';

    suggestions.forEach((suggestion, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.className = 'dropdown-item';
        link.href = '#';
        if (index === selectedIndex) {
            link.classList.add('active');
        }

        link.innerHTML = `
            <div class="autocomplete-folder text-muted">${suggestion.folderTitle}</div>
            <div class="autocomplete-item-title">${suggestion.title}</div>
            <div class="autocomplete-item-url text-muted">${suggestion.link}</div>
        `;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToSuggestion(suggestion);
        });

        item.appendChild(link);
        dropdown.appendChild(item);
    });

    dropdown.classList.add('show');
}

function hideAutocomplete() {
    const dropdown = document.getElementById('autocompleteDropdown');
    dropdown.classList.remove('show');
    selectedIndex = -1;
}

function updateSelectedItem() {
    const dropdown = document.getElementById('autocompleteDropdown');
    const items = dropdown.querySelectorAll('.dropdown-item');

    items.forEach((item, index) => {
        if (index === selectedIndex) {
            item.classList.add('active');
            item.scrollIntoView({ block: 'nearest' });
        } else {
            item.classList.remove('active');
        }
    });
}

async function fetchAutocompleteData() {
    try {
        const response = await fetch('/.netlify/functions/get-autocomplete');

        if (response.ok) {
            const data = await response.json();
            autocompleteData = data.folders || [];
        }
    } catch (error) {
        console.error('Error fetching autocomplete data:', error);
        // Silently fail - autocomplete just won't work
    }
}

// Check if string looks like a URL
function isURL(str) {
    // Check if it starts with http:// or https://
    if (str.match(/^https?:\/\//i)) {
        return true;
    }

    // Check if it looks like a domain with optional path/port
    // Must contain a dot, and match domain pattern with optional path
    if (!str.includes('.')) {
        return false;
    }

    // Match domain.tld or domain.tld/path or domain.tld:port
    const domainWithPathPattern = /^[\da-z\.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i;

    return domainWithPathPattern.test(str);
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

    if (folders.length === 0) {
        bookmarksEl.querySelector("div").classList.remove("d-none");
        return;
    }

    bookmarksEl.innerHTML = '';

    folders.forEach(folder => {
        const template = document.getElementById('folder-template');
        const clone = template.content.cloneNode(true);

        // Set the title
        const title = clone.querySelector('[data-field="folder-title"]');;
        title.textContent = folder.title;
        bookmarksEl.appendChild(clone);

        // Render bookmarks in this folder
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
