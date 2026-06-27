/**
 * SoporteCero - Main Client-Side Logic
 * Handles real-time search filtering, category filtering, and code snippet copy action.
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- 1. Search & Category Filtering ---
  const searchInput = document.getElementById('search-input');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const articleCards = document.querySelectorAll('.article-card');
  const articlesGrid = document.querySelector('.articles-grid');

  let currentCategory = 'all';
  let searchQuery = '';

  // Filter main controller
  function filterArticles() {
    let matchCount = 0;

    // Check if we already have a 'no-results' element in the grid
    let noResultsEl = document.getElementById('no-results-msg');
    if (noResultsEl) {
      noResultsEl.remove();
    }

    articleCards.forEach(card => {
      const cardCategory = card.getAttribute('data-category');
      const cardTitle = card.getAttribute('data-title').toLowerCase();
      const cardTags = card.getAttribute('data-tags').toLowerCase();
      const cardSummary = card.getAttribute('data-summary').toLowerCase();

      const matchesCategory = currentCategory === 'all' || cardCategory === currentCategory;
      const matchesSearch = cardTitle.includes(searchQuery) || 
                            cardTags.includes(searchQuery) || 
                            cardSummary.includes(searchQuery);

      if (matchesCategory && matchesSearch) {
        card.style.display = '';
        matchCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // If no articles match, display a helpful message
    if (matchCount === 0 && articlesGrid) {
      const msgDiv = document.createElement('div');
      msgDiv.id = 'no-results-msg';
      msgDiv.className = 'no-results';
      msgDiv.innerHTML = `
        <h3>No se encontraron resultados</h3>
        <p>Intenta buscar con otros términos o cambia la categoría seleccionada.</p>
      `;
      articlesGrid.appendChild(msgDiv);
    }
  }

  // Bind Search Input Event
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      filterArticles();
    });
  }

  // Bind Category Buttons
  if (filterButtons.length > 0) {
    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Toggle active class
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update current category and filter
        currentCategory = btn.getAttribute('data-filter');
        filterArticles();
      });
    });
  }

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
    if (linkHref && currentPath.includes(linkHref) && !linkHref.startsWith('index.html') && linkHref !== '/' && !linkHref.startsWith('../index.html')) {
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
      const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '' || currentPath.includes('index.html');
      if (isHome && (linkHref === 'index.html' || linkHref === '../index.html')) {
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
