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
  }

  // Bind Category Buttons
  if (filterButtons.length > 0) {
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentCategory = btn.getAttribute('data-filter');
        currentPage = 1;
        updatePagination();
      });
    });
  }

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
      // Find the sibling pre code element
      const preElement = button.closest('.code-container').querySelector('pre');
      if (!preElement) return;

      const codeText = preElement.textContent;

      try {
        await navigator.clipboard.writeText(codeText);
        
        // Visual feedback
        const originalText = button.textContent;
        button.textContent = '¡Copiado!';
        button.style.borderColor = '#10b981'; // Green accent on success
        button.style.color = '#10b981';

        setTimeout(() => {
          button.textContent = originalText;
          button.style.borderColor = '';
          button.style.color = '';
        }, 1500);
      } catch (err) {
        console.error('Error al copiar el código: ', err);
        button.textContent = 'Error';
        setTimeout(() => {
          button.textContent = 'Copiar';
        }, 1500);
      }
    });
  });

  // --- 3. Set Active Navigation Page Link ---
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('nav a');
  
  // Highlight active static page link (e.g. posts, legal)
  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (!linkHref) return;
    
    // Ignore home links for generic highlight
    const isHomeLink = linkHref === './' || linkHref === '../' || linkHref === 'index.html' || linkHref === '../index.html' || linkHref.includes('?cat=');
    
    if (!isHomeLink && currentPath.includes(linkHref) && linkHref !== '/') {
      link.classList.add('active');
    }
  });

  // Handle category query parameter from URL (e.g. ?cat=sistemas) on the homepage
  const urlParams = new URLSearchParams(window.location.search);
  const catParam = urlParams.get('cat');
  if (catParam) {
    const targetBtn = document.querySelector(`.filter-btn[data-filter="${catParam}"]`);
    if (targetBtn) {
      targetBtn.click();
    }
    // Also highlight matching nav link
    navLinks.forEach(link => {
      const linkHref = link.getAttribute('href');
      if (linkHref && linkHref.includes(`cat=${catParam}`)) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  } else {
    // If no category param, highlight standard "Inicio" if we are on the home page
    navLinks.forEach(link => {
      const linkHref = link.getAttribute('href');
      const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '' || currentPath.endsWith('./') || currentPath.endsWith('../');
      const isHomeLink = linkHref === './' || linkHref === '../' || linkHref === 'index.html' || linkHref === '../index.html';
      if (isHome && isHomeLink) {
        link.classList.add('active');
      }
    });
  }

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
});
