// Main application logic

// Bookmarks data, used to build the main search bar's autocomplete suggestions
let autocompleteData = [];

// Generic autocomplete: filters getItems(query) as the user types, renders results into
// `dropdown` using the shared autocomplete-item-template, and calls onSelect(item) on
// click/Enter. Returns { getSelected, refresh } — refresh() re-runs the current query, e.g.
// after the underlying data has been reloaded.
// `noResultsItems`, if given, is a list of fallback rows ({ fields, onSelect }) shown when
// getItems() comes back empty, instead of just hiding the dropdown.
function createAutocomplete({ input, dropdown, getItems, getFields, onSelect, noResultsItems }) {
    const template = document.getElementById('autocomplete-item-template');
    let filtered = [];
    let showingNoResults = false;
    let selectedIndex = -1;

    function activate(item) {
        if (showingNoResults) {
            item.onSelect();
        } else {
            onSelect(item);
        }
    }

    function show(items, isNoResults) {
        showingNoResults = isNoResults;
        filtered = items;
        dropdown.innerHTML = '';

        items.forEach((item, index) => {
            const clone = template.content.cloneNode(true);
            const link = clone.querySelector('a');
            const fields = isNoResults ? item.fields : getFields(item);

            clone.querySelector('[data-field="title"]').textContent = fields.title;
            clone.querySelector('[data-field="url"]').textContent = fields.subtitle;
            clone.querySelector('[data-field="folder"]').textContent = fields.meta || '';

            if (index === selectedIndex) {
                link.classList.add('active');
            }

            link.addEventListener('click', (e) => {
                e.preventDefault();
                activate(item);
            });

            dropdown.appendChild(clone);
        });

        dropdown.classList.add('show');
    }

    function hide() {
        dropdown.classList.remove('show');
        showingNoResults = false;
        selectedIndex = -1;
    }

    function updateSelected() {
        dropdown.querySelectorAll('.dropdown-item').forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }

    function runQuery(query) {
        if (query.length === 0) {
            hide();
            return;
        }

        const items = getItems(query);
        selectedIndex = 0; // Select first item (or the first no-results row) by default

        if (items.length > 0) {
            show(items, false);
        } else if (noResultsItems && noResultsItems.length > 0) {
            show(noResultsItems, true);
        } else {
            hide();
        }
    }

    input.addEventListener('input', (e) => runQuery(e.target.value.trim().toLowerCase()));

    // Reopen autocomplete if there are suggestions
    input.addEventListener('focus', () => {
        const query = input.value.trim();
        if (query.length > 0) {
            runQuery(query.toLowerCase());
        }
    });

    input.addEventListener('keydown', (e) => {
        if (!dropdown.classList.contains('show')) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = selectedIndex === filtered.length - 1 ? 0 : selectedIndex + 1;
            updateSelected();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = selectedIndex === 0 ? filtered.length - 1 : selectedIndex - 1;
            updateSelected();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && selectedIndex < filtered.length) {
                e.preventDefault();
                activate(filtered[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            hide();
        }
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            hide();
        }
    });

    return {
        getSelected: () => (!showingNoResults && selectedIndex >= 0 && selectedIndex < filtered.length ? filtered[selectedIndex] : null),
        refresh: () => runQuery(input.value.trim().toLowerCase())
    };
}

function navigateTo(url) {
    if (!url.match(/^https?:\/\//i)) {
        url = `https://${url}`;
    }
    window.location.href = url;
}

// Handle main search form submission
function setupSearch() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');

    const autocomplete = createAutocomplete({
        input: searchInput,
        dropdown: document.getElementById('autocompleteDropdown'),
        getItems: (query) => {
            const results = [];
            autocompleteData.forEach(folder => {
                folder.bookmarks.forEach(bookmark => {
                    const titleMatch = bookmark.title.toLowerCase().includes(query);
                    const linkMatch = bookmark.link.toLowerCase().includes(query);
                    if (titleMatch || linkMatch) {
                        results.push({ ...bookmark, folderTitle: folder.title });
                    }
                });
            });
            return results;
        },
        getFields: (bookmark) => ({
            title: bookmark.title,
            subtitle: bookmark.link,
            meta: bookmark.folderTitle
        }),
        onSelect: (bookmark) => navigateTo(bookmark.link)
    });

    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const query = searchInput.value.trim();
        if (!query) return;

        // If there's a selected autocomplete item, use it
        const selected = autocomplete.getSelected();
        if (selected) {
            navigateTo(selected.link);
            return;
        }

        if (isURL(query)) {
            navigateTo(query);
        } else {
            // Search Google
            window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }
    });
}

// GitHub repo search: disables the input and turns the button into a sign-in link when not
// authed; otherwise loads the user's repos (public + private) and wires up autocomplete.
async function setupGithubSearch() {
    const searchForm = document.getElementById('githubSearchForm');
    const searchInput = document.getElementById('githubSearchInput');
    const searchBtn = document.getElementById('githubSearchBtn');

    function showSignedOutState() {
        searchInput.disabled = true;
        searchBtn.type = 'button';
        searchBtn.innerHTML = '<i class="fa-brands fa-github"></i> Sign In';
        searchBtn.addEventListener('click', () => {
            window.location.href = '/.netlify/functions/github-auth-start';
        });
    }

    async function showSignedInState() {
        function updateRepoCount(count) {
            document.getElementById('githubSearchIcon').innerHTML = `<i class="fa-brands fa-github"></i> (${count})`;
        }

        // Server response is cached for 5 minutes (see get-github-repos.js); pass
        // { cache: 'no-store' } to force a fresh fetch, e.g. after adding/renaming a repo.
        async function loadRepos(fetchOptions) {
            const response = await fetch('/.netlify/functions/get-github-repos', fetchOptions);

            if (response.status === 401) {
                showSignedOutState();
                return null;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch GitHub repos: ${response.statusText}`);
            }

            const { repos } = await response.json();
            return repos;
        }

        let repos = await loadRepos();
        if (!repos) return; // showSignedOutState() already ran

        updateRepoCount(repos.length);

        const autocomplete = createAutocomplete({
            input: searchInput,
            dropdown: document.getElementById('githubAutocompleteDropdown'),
            getItems: (query) => repos.filter(repo =>
                repo.name.toLowerCase().includes(query) || repo.fullName.toLowerCase().includes(query)
            ),
            getFields: (repo) => ({
                title: repo.name,
                subtitle: repo.fullName,
                meta: repo.private ? 'Private' : 'Public'
            }),
            onSelect: (repo) => navigateTo(repo.url),
            noResultsItems: [
                {
                    fields: { title: 'Refresh cache', subtitle: 'No repos found' },
                    onSelect: async () => {
                        const fresh = await loadRepos({ cache: 'no-store' });
                        if (fresh) {
                            repos = fresh;
                            updateRepoCount(repos.length);
                            autocomplete.refresh();
                        }
                    }
                },
                {
                    fields: { title: 'Grant more access', subtitle: 'No repos found' },
                    // Goes to GitHub's connected-app settings, where org access can be requested.
                    // Re-running the OAuth flow won't help here — GitHub skips the consent screen
                    // once the current scope has already been granted.
                    onSelect: () => { window.location.href = '/.netlify/functions/github-manage-access'; }
                }
            ]
        });

        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const selected = autocomplete.getSelected();
            if (selected) {
                navigateTo(selected.url);
            }
        });
    }

    try {
        const response = await fetch('/.netlify/functions/github-auth-status');
        const data = await response.json();

        if (data.authed) {
            await showSignedInState();
        } else {
            showSignedOutState();
        }
    } catch (error) {
        console.error('Error setting up GitHub search:', error);
        showSignedOutState();
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

// UI state management
function showLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    const checkmark = document.getElementById('loadingCheckmark');
    spinner.classList.remove('d-none');
    checkmark.classList.add('d-none');
}

function showLoadingCheckmark() {
    const spinner = document.getElementById('loadingSpinner');
    const checkmark = document.getElementById('loadingCheckmark');
    spinner.classList.add('d-none');
    checkmark.classList.remove('d-none');

    // Hide checkmark after 2 seconds
    setTimeout(() => {
        checkmark.classList.add('d-none');
    }, 2000);
}

function hideLoadingIndicators() {
    const spinner = document.getElementById('loadingSpinner');
    const checkmark = document.getElementById('loadingCheckmark');
    spinner.classList.add('d-none');
    checkmark.classList.add('d-none');
}

// localStorage cache management
const CACHE_KEY = 'raindrop_bookmarks_cache';

function loadFromCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (error) {
        console.error('Error loading from cache:', error);
    }
    return null;
}

function saveToCache(data) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to cache:', error);
    }
}

function renderBookmarksData(data) {
    const loadingEl = document.getElementById('loading');

    // Hide loading
    loadingEl.classList.add('d-none');

    // Display folders with bookmarks on the page
    renderFolders(data.display || []);

    // Store autocomplete data (combine display and autocomplete groups)
    autocompleteData = [...(data.display || []), ...(data.autocomplete || [])];
}

async function fetchBookmarks() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

    // Try to load from cache first
    const cachedData = loadFromCache();
    if (cachedData) {
        console.log('Loading bookmarks from cache');
        renderBookmarksData(cachedData);
    }

    // Fetch fresh data in background
    showLoadingSpinner();

    try {
        // Call our Netlify Function
        const response = await fetch('/.netlify/functions/get-bookmarks');

        // Check if authentication is needed
        if (response.status === 401) {
            const data = await response.json();
            if (data.needsAuth) {
                hideLoadingIndicators();
                showLoginPrompt();
                return;
            }
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch bookmarks: ${response.statusText}`);
        }

        const data = await response.json();

        // Save to cache
        saveToCache(data);

        // Update the UI with fresh data
        renderBookmarksData(data);

        // Show checkmark
        showLoadingCheckmark();

    } catch (error) {
        console.error('Error fetching bookmarks:', error);
        hideLoadingIndicators();

        // Only show error if we didn't have cached data
        if (!cachedData) {
            loadingEl.classList.add('d-none');
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.classList.remove('d-none');
        }
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
        setupGithubSearch();
        fetchBookmarks();
    });
} else {
    setupSearch();
    setupGithubSearch();
    fetchBookmarks();
}
