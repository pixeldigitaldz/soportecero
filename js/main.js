/**
 * SoporteCero - Main Client-Side Logic
 * Handles real-time search filtering, category filtering, and code snippet copy action.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Search, Category Filtering & Pagination ---
  const searchInput = document.getElementById('search-input');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const articleCards = Array.from(document.querySelectorAll('.article-card'));
  const articlesGrid = document.querySelector('.articles-grid');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const pageIndicator = document.getElementById('page-indicator');
  const articlesSection = document.getElementById('section-title');

  let currentCategory = 'all';
  let searchQuery = '';
  let currentPage = 1;
  const itemsPerPage = 20;
  let matchingCards = [];

  function updatePagination() {
    // 1. Filter cards by search and category
    matchingCards = articleCards.filter(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardTitle = card.getAttribute('data-title').toLowerCase();
      const cardTags = card.getAttribute('data-tags').toLowerCase();
      const cardSummary = card.getAttribute('data-summary').toLowerCase();

      const matchesCategory = currentCategory === 'all' || cardCategory === currentCategory;
      const matchesSearch = cardTitle.includes(searchQuery) || 
                            cardTags.includes(searchQuery) || 
                            cardSummary.includes(searchQuery);

      const isMatch = matchesCategory && matchesSearch;
      
      if (!isMatch) {
        card.classList.add('hidden');
      } else {
        card.classList.remove('hidden');
      }

      return isMatch;
    });

    // 2. Remove any previous "no results" message
    let noResultsEl = document.getElementById('no-results-msg');
    if (noResultsEl) {
      noResultsEl.remove();
    }

    const totalItems = matchingCards.length;
    const paginationControls = document.querySelector('.pagination-controls');

    if (totalItems === 0) {
      if (articlesGrid) {
        const msgDiv = document.createElement('div');
        msgDiv.id = 'no-results-msg';
        msgDiv.className = 'no-results';
        msgDiv.innerHTML = `
          <h3>No se encontraron resultados</h3>
          <p>Intenta buscar con otros términos o cambia la categoría seleccionada.</p>
        `;
        articlesGrid.appendChild(msgDiv);
      }
      if (paginationControls) {
        paginationControls.style.display = 'none';
      }
      return;
    }

    if (paginationControls) {
      paginationControls.style.display = 'flex';
    }

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Adjust page bounds
    if (currentPage > totalPages) {
      currentPage = totalPages;
    }
    if (currentPage < 1) {
      currentPage = 1;
    }

    // 3. Toggle visibility based on page slice
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    matchingCards.forEach((card, index) => {
      if (index >= startIndex && index < endIndex) {
        card.classList.remove('hidden');
      } else {
        card.classList.add('hidden');
      }
    });

    // 4. Update controls
    if (pageIndicator) {
      pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;
    }

    if (btnPrev) {
      btnPrev.disabled = currentPage === 1;
    }
    if (btnNext) {
      btnNext.disabled = currentPage === totalPages;
    }
  }

  // Bind Search Input (keyup & input)
  if (searchInput) {
    const handleSearch = (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      currentPage = 1;
      updatePagination();
    };
    searchInput.addEventListener('input', handleSearch);
    searchInput.addEventListener('keyup', handleSearch);

    // Command Palette Keyboard Shortcut (Ctrl+K, Cmd+K, or /)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      } else if (e.key === '/' && document.activeElement !== searchInput && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
  }

  // --- Category Filtering & Header Dock Synchronization ---
  function setCategory(cat, updateUrl = true, shouldScroll = false) {
    currentCategory = cat || 'all';
    currentPage = 1;

    // 1. Synchronize filter buttons below search
    if (filterButtons.length > 0) {
      filterButtons.forEach(btn => {
        const filterVal = btn.getAttribute('data-filter');
        if (filterVal === currentCategory) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // 2. Synchronize header dock navigation links
    const headerNavLinks = document.querySelectorAll('header nav a');
    headerNavLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (currentCategory !== 'all' && href.includes(`cat=${currentCategory}`)) {
        link.classList.add('active');
      } else if (href.includes('?cat=')) {
        link.classList.remove('active');
      }
    });

    // 3. Update URL without reloading if supported
    if (updateUrl && window.history && window.history.pushState) {
      const newUrl = currentCategory === 'all' 
        ? window.location.pathname 
        : `${window.location.pathname}?cat=${currentCategory}`;
      window.history.pushState({ cat: currentCategory }, '', newUrl);
    }

    // 4. Filter cards and update pagination
    updatePagination();

    // 5. Smooth scroll if requested
    if (shouldScroll && articlesSection) {
      articlesSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // Bind Category Buttons
  if (filterButtons.length > 0) {
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-filter');
        setCategory(cat, true, false);
      });
    });
  }

  // Intercept Header Nav Category Clicks on Homepage for instant response
  const headerNavLinks = document.querySelectorAll('header nav a');
  if (filterButtons.length > 0) {
    headerNavLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href.includes('?cat=')) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const match = href.match(/cat=([^&]+)/);
          if (match && match[1]) {
            setCategory(match[1], true, true);
          }
        });
      }
    });
  }

  // Handle Initial Category Query Param & Browser Popstate
  const initialCatParam = new URLSearchParams(window.location.search).get('cat');
  if (initialCatParam && ['sistemas', 'gaming', 'web'].includes(initialCatParam)) {
    setCategory(initialCatParam, false, false);
  }

  window.addEventListener('popstate', () => {
    const poppedCat = new URLSearchParams(window.location.search).get('cat') || 'all';
    setCategory(poppedCat, false, false);
  });

  // Bind Pagination Navigation Buttons
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        updatePagination();
        if (articlesSection) {
          articlesSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      const totalPages = Math.ceil(matchingCards.length / itemsPerPage);
      if (currentPage < totalPages) {
        currentPage++;
        updatePagination();
        if (articlesSection) {
          articlesSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  }

  // Initial call on page load
  updatePagination();

  // --- 2. Copy Code to Clipboard ---
  const copyButtons = document.querySelectorAll('.copy-btn');

  copyButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const codeContainer = button.closest('.code-container');
      const preElement = codeContainer ? codeContainer.querySelector('pre') : null;
      if (!preElement) return;

      const codeText = preElement.textContent;
      const copyTextEl = button.querySelector('.copy-text');
      const copyIcon = button.querySelector('.copy-icon');

      const isEnglish = document.documentElement.lang === 'en' || window.location.pathname.includes('/en/');
      const defaultCopy = isEnglish ? 'Copy' : 'Copiar';
      const defaultCopied = isEnglish ? 'Copied' : 'Copiado';

      const copyLabel = button.getAttribute('data-copy-label') || (copyTextEl ? copyTextEl.textContent : defaultCopy);
      const copiedLabel = button.getAttribute('data-copied-label') || defaultCopied;

      try {
        await navigator.clipboard.writeText(codeText);
        
        button.classList.add('copied');
        if (copyTextEl) {
          copyTextEl.textContent = copiedLabel;
        }
        if (copyIcon) {
          copyIcon.innerHTML = '<polyline points="20 6 9 17 4 12"></polyline>';
          copyIcon.setAttribute('stroke', '#34D399');
          copyIcon.setAttribute('stroke-width', '2');
        }

        setTimeout(() => {
          button.classList.remove('copied');
          if (copyTextEl) {
            copyTextEl.textContent = copyLabel;
          }
          if (copyIcon) {
            copyIcon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>';
            copyIcon.setAttribute('stroke', 'currentColor');
            copyIcon.setAttribute('stroke-width', '1.75');
          }
        }, 1800);
      } catch (err) {
        console.error('Error al copiar el código: ', err);
        if (copyTextEl) copyTextEl.textContent = 'Error';
        setTimeout(() => {
          if (copyTextEl) copyTextEl.textContent = copyLabel;
        }, 1800);
      }
    });
  });

  // --- 3. Set Active Navigation Page Link ---
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('header nav a');
  
  // Highlight active static page link (e.g. /tools/, legal, contact)
  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (!linkHref) return;
    
    // Tools suite highlight
    if (linkHref === '/tools/' && currentPath.startsWith('/tools')) {
      link.classList.add('active');
    }
  });

  // --- 4. Theme Toggle Click Event Handler ---
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      if (currentTheme === 'light') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    });
  }

  // Prevent standard form submission on search form if wrapped in <form>
  const searchForm = document.querySelector('form.search-container');
  if (searchForm) {
    searchForm.addEventListener('submit', (e) => e.preventDefault());
  }

  // Register WebMCP tools
  initWebMcp();
});

// --- WebMCP (Web Model Context Protocol) Tools Registration ---
function initWebMcp() {
  const modelContext = (typeof document !== 'undefined' && document.modelContext) || 
                       (typeof navigator !== 'undefined' && navigator.modelContext);
  if (!modelContext || typeof modelContext.registerTool !== 'function') {
    return;
  }

  if (window.__webmcp_registered) return;
  window.__webmcp_registered = true;

  const abortController = new AbortController();

  // Tool 1: Search troubleshooting guides
  modelContext.registerTool({
    name: 'search_troubleshooting_guides',
    description: 'Search technical solutions, error fixes, command recipes, and articles on SoporteCero by keyword, error code, or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search keywords or error messages (e.g. "docker oomkiller", "vkd3d", "nginx 502")'
        },
        category: {
          type: 'string',
          description: 'Optional category filter: "sistemas", "gaming", or "web"',
          enum: ['sistemas', 'gaming', 'web']
        }
      },
      required: ['query']
    },
    execute: async ({ query, category }) => {
      const q = (query || '').toLowerCase();
      const cat = (category || 'all').toLowerCase();
      const cards = Array.from(document.querySelectorAll('.article-card'));
      const results = [];

      for (const card of cards) {
        const cardCat = card.getAttribute('data-category') || '';
        const title = (card.getAttribute('data-title') || '').toLowerCase();
        const tags = (card.getAttribute('data-tags') || '').toLowerCase();
        const summary = (card.getAttribute('data-summary') || '').toLowerCase();
        const linkEl = card.querySelector('a');
        const href = linkEl ? linkEl.getAttribute('href') : '';

        if ((cat === 'all' || cardCat === cat) && (title.includes(q) || tags.includes(q) || summary.includes(q))) {
          results.push({
            title: card.getAttribute('data-title'),
            category: cardCat,
            url: href.startsWith('http') ? href : new URL(href, window.location.href).href,
            summary: card.getAttribute('data-summary')
          });
          if (results.length >= 10) break;
        }
      }

      return {
        query,
        category: cat,
        totalFound: results.length,
        results
      };
    }
  }, { signal: abortController.signal }).catch(() => {});

  // Tool 2: List categories and site topics
  modelContext.registerTool({
    name: 'list_categories',
    description: 'List technical troubleshooting categories and available topics on SoporteCero.',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    execute: async () => {
      return {
        site: 'SoporteCero',
        url: 'https://soportecero.com',
        categories: [
          {
            id: 'sistemas',
            name: 'Sistemas y Servidores',
            description: 'Linux sysadmin, Docker, Proxmox, Nginx, SSH, Systemd, storage & backups',
            url: 'https://soportecero.com/?cat=sistemas'
          },
          {
            id: 'gaming',
            name: 'Gaming Tech',
            description: 'Linux gaming, Proton, Wine, Vulkan, Steam Deck, Gamescope, FPS optimization',
            url: 'https://soportecero.com/?cat=gaming'
          },
          {
            id: 'web',
            name: 'Web y Código',
            description: 'TypeScript, Node.js, React, Next.js, Vite, Git, databases, API integration',
            url: 'https://soportecero.com/?cat=web'
          }
        ]
      };
    }
  }, { signal: abortController.signal }).catch(() => {});
}

// Initial evaluation on load
initWebMcp();
