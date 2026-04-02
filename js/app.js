// ── State ──
const STORAGE_KEY = 'budget_transactions';
const CATEGORIES_KEY = 'budget_categories';
const LIMIT_KEY = 'budget_limit';
const THEME_KEY = 'budget_theme';

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];
const CATEGORY_COLORS = {
  Food: '#6c63ff',
  Transport: '#06b6d4',
  Fun: '#f59e0b',
};
const EXTRA_COLORS = ['#10b981','#ef4444','#ec4899','#8b5cf6','#f97316','#14b8a6'];

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let customCategories = JSON.parse(localStorage.getItem(CATEGORIES_KEY)) || [];
let spendingLimit = parseFloat(localStorage.getItem(LIMIT_KEY)) || 0;
let sortMode = 'date-desc';
let chartInstance = null;

// ── DOM refs ──
const form = document.getElementById('transaction-form');
const itemNameInput = document.getElementById('item-name');
const amountInput = document.getElementById('amount');
const categorySelect = document.getElementById('category');
const formError = document.getElementById('form-error');
const totalBalanceEl = document.getElementById('total-balance');
const transactionList = document.getElementById('transaction-list');
const listEmpty = document.getElementById('list-empty');
const chartEmpty = document.getElementById('chart-empty');
const sortSelect = document.getElementById('sort-select');
const themeToggle = document.getElementById('theme-toggle');
const spendLimitInput = document.getElementById('spend-limit');
const addCategoryBtn = document.getElementById('add-category-btn');
const customCategoryInput = document.getElementById('custom-category-input');
const customCategoryField = document.getElementById('custom-category');
const saveCategoryBtn = document.getElementById('save-category-btn');

// ── Init ──
function init() {
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  if (spendingLimit > 0) spendLimitInput.value = spendingLimit;
  populateCategorySelect();
  render();
}

// ── Theme ──
themeToggle.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Spending Limit ──
spendLimitInput.addEventListener('change', () => {
  spendingLimit = parseFloat(spendLimitInput.value) || 0;
  localStorage.setItem(LIMIT_KEY, spendingLimit);
  render();
});

// ── Custom Categories ──
addCategoryBtn.addEventListener('click', () => {
  customCategoryInput.classList.toggle('hidden');
  if (!customCategoryInput.classList.contains('hidden')) {
    customCategoryField.focus();
  }
});

saveCategoryBtn.addEventListener('click', () => {
  const name = customCategoryField.value.trim();
  if (!name) return;
  const allCats = getAllCategories();
  if (allCats.map(c => c.toLowerCase()).includes(name.toLowerCase())) {
    customCategoryField.value = '';
    customCategoryInput.classList.add('hidden');
    return;
  }
  customCategories.push(name);
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(customCategories));
  populateCategorySelect();
  categorySelect.value = name;
  customCategoryField.value = '';
  customCategoryInput.classList.add('hidden');
});

function getAllCategories() {
  return [...DEFAULT_CATEGORIES, ...customCategories];
}

function populateCategorySelect() {
  const current = categorySelect.value;
  categorySelect.innerHTML = '<option value="">Select category</option>';
  getAllCategories().forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
  if (current) categorySelect.value = current;
}

function getCategoryColor(cat) {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  const idx = customCategories.indexOf(cat);
  return EXTRA_COLORS[idx % EXTRA_COLORS.length] || '#9ca3af';
}

// ── Form Submit ──
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = itemNameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categorySelect.value;

  if (!name || !amount || !category || amount <= 0) {
    showError('Please fill in all fields with valid values.');
    return;
  }

  hideError();
  const tx = { id: Date.now(), name, amount, category, date: new Date().toISOString() };
  transactions.unshift(tx);
  save();
  render();
  form.reset();
});

// ── Sort ──
sortSelect.addEventListener('change', () => {
  sortMode = sortSelect.value;
  renderList();
});

// ── Delete ──
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
}

// ── Save ──
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// ── Render ──
function render() {
  renderBalance();
  renderList();
  renderChart();
}

function renderBalance() {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);
  totalBalanceEl.textContent = `$${total.toFixed(2)}`;
  const isOver = spendingLimit > 0 && total > spendingLimit;
  totalBalanceEl.classList.toggle('over-limit', isOver);
}

function getSortedTransactions() {
  const list = [...transactions];
  switch (sortMode) {
    case 'date-asc':    return list.sort((a, b) => new Date(a.date) - new Date(b.date));
    case 'amount-desc': return list.sort((a, b) => b.amount - a.amount);
    case 'amount-asc':  return list.sort((a, b) => a.amount - b.amount);
    case 'category':    return list.sort((a, b) => a.category.localeCompare(b.category));
    default:            return list; // date-desc (already newest first)
  }
}

function renderList() {
  const sorted = getSortedTransactions();
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (sorted.length === 0) {
    listEmpty.classList.remove('hidden');
    transactionList.innerHTML = '';
    transactionList.appendChild(listEmpty);
    return;
  }

  listEmpty.classList.add('hidden');
  transactionList.innerHTML = '';

  sorted.forEach(tx => {
    const isOver = spendingLimit > 0 && total > spendingLimit;
    const color = getCategoryColor(tx.category);
    const li = document.createElement('li');
    li.className = `transaction-item${isOver ? ' over-limit' : ''}`;
    li.innerHTML = `
      <div class="tx-info">
        <div class="tx-name">${escapeHtml(tx.name)}</div>
        <div class="tx-category">
          <span class="tx-badge" style="background:${color}">${escapeHtml(tx.category)}</span>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount${isOver ? ' over-limit' : ''}">$${tx.amount.toFixed(2)}</span>
        <button class="delete-btn" aria-label="Delete transaction" data-id="${tx.id}">✕</button>
      </div>
    `;
    transactionList.appendChild(li);
  });

  transactionList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTransaction(Number(btn.dataset.id)));
  });
}

function renderChart() {
  const totals = {};
  transactions.forEach(tx => {
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);
  const colors = labels.map(getCategoryColor);

  const hasData = labels.length > 0;
  chartEmpty.classList.toggle('hidden', hasData);

  const canvas = document.getElementById('spending-chart');
  canvas.style.display = hasData ? 'block' : 'none';

  if (!hasData) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = data;
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
  } else {
    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: 'transparent' }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, font: { size: 12 }, color: getComputedStyle(document.documentElement).getPropertyValue('--text') }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` $${ctx.parsed.toFixed(2)} (${Math.round(ctx.parsed / data.reduce((a,b)=>a+b,0)*100)}%)`
            }
          }
        },
        cutout: '60%'
      }
    });
  }
}

// ── Helpers ──
function showError(msg) {
  formError.textContent = msg;
  formError.classList.remove('hidden');
}

function hideError() {
  formError.classList.add('hidden');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Start ──
init();
