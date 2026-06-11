const STORAGE_KEY = "rh-zone-creator-products";
const PLACEHOLDER_PRODUCT_NAMES = new Set([
  "Nebula RTX Battle PC",
  "Nova X Console Bundle",
  "Forge TKL RGB Keyboard",
  "PulseFire Pro Mouse",
  "PulseFire Wireless Mouse",
  "Spectra 7.1 Headset",
  "StrikePad Elite",
  "Apex Carbon Chair",
  "Crimson Logo Hoodie",
]);

const state = {
  products: loadProducts(),
  filter: "All",
  sort: "featured",
  query: "",
  cart: [],
  wishlist: new Set(),
};

const grid = document.querySelector("#productGrid");
const creatorPicks = document.querySelector("#creatorPicks");
const productForm = document.querySelector("#productForm");
const clearProducts = document.querySelector("#clearProducts");
const filterButtons = document.querySelector("#filterButtons");
const sortSelect = document.querySelector("#sortSelect");
const searchInput = document.querySelector("#searchInput");
const cartCount = document.querySelector("#cartCount");
const wishlistCount = document.querySelector("#wishlistCount");
const cartDrawer = document.querySelector("#cartDrawer");
const cartItems = document.querySelector("#cartItems");
const cartSubtotal = document.querySelector("#cartSubtotal");
const heroProductCount = document.querySelector("#heroProductCount");
const saleStatus = document.querySelector("#saleStatus");
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector("#navLinks");
const header = document.querySelector(".site-header");

function loadProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const products = JSON.parse(saved);
    if (!Array.isArray(products)) return [];

    const creatorProducts = products.filter((product) => !PLACEHOLDER_PRODUCT_NAMES.has(product?.name));
    if (creatorProducts.length !== products.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(creatorProducts));
    }

    return creatorProducts;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function saveProducts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.products));
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getVisibleProducts() {
  const query = state.query.trim().toLowerCase();
  const filtered = state.products.filter((product) => {
    const matchesFilter = state.filter === "All" || product.category === state.filter;
    const matchesQuery = !query || `${product.name} ${product.category} ${product.desc}`.toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });

  return filtered.sort((a, b) => {
    if (state.sort === "price-low") return a.price - b.price;
    if (state.sort === "price-high") return b.price - a.price;
    if (state.sort === "name") return a.name.localeCompare(b.name);
    return b.createdAt - a.createdAt;
  });
}

function productImage(product) {
  if (product.image) {
    return `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" />`;
  }

  return `
    <div class="product-placeholder" aria-label="Product image pending">
      <i data-lucide="image-plus"></i>
      <span>Creator image pending</span>
    </div>
  `;
}

function renderProducts() {
  const visible = getVisibleProducts();
  heroProductCount.textContent = state.products.length;

  grid.innerHTML = visible
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-media">
            ${productImage(product)}
            ${product.sale ? `<span class="sale-badge">${escapeHtml(product.sale)}</span>` : ""}
            <button class="icon-button wishlist ${state.wishlist.has(product.id) ? "active" : ""}" type="button" data-wishlist="${product.id}" aria-label="Add ${escapeHtml(product.name)} to wishlist">
              <i data-lucide="heart"></i>
            </button>
          </div>
          <div class="product-info">
            <span class="listing-badge">Creator listing</span>
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.desc)}</p>
            <div class="price-row">
              <span class="price">${formatPrice(product.price)}</span>
              <span>${escapeHtml(product.category)}</span>
            </div>
            <button class="button primary full" type="button" data-cart="${product.id}">Add to Cart</button>
          </div>
        </article>
      `
    )
    .join("");

  if (!visible.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <strong>No creator products listed yet.</strong>
        <p>Use the Creator Console to add real products before customers can shop.</p>
        <a class="button primary" href="#creator">Add First Product</a>
      </div>
    `;
  }

  renderCreatorPicks();
  updateSaleStatus();
  if (window.lucide) window.lucide.createIcons();
}

function renderCreatorPicks() {
  const latest = [...state.products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  creatorPicks.innerHTML = latest.length
    ? latest
        .map(
          (item) => `
            <article>
              ${item.sale ? `<span class="discount">${escapeHtml(item.sale)}</span>` : `<span class="discount">Listed</span>`}
              <h3>${escapeHtml(item.name)}</h3>
              <p>${escapeHtml(item.desc)}</p>
            </article>
          `
        )
        .join("")
    : `
      <article class="empty-state">
        <h3>No creator picks yet</h3>
        <p>Add real products and the newest listings will appear here automatically.</p>
      </article>
    `;
}

function updateSaleStatus() {
  const dealCount = state.products.filter((product) => product.sale).length;
  saleStatus.textContent = dealCount
    ? `${dealCount} creator discount${dealCount === 1 ? " is" : "s are"} active.`
    : "No creator discounts are active yet.";
}

function updateCart() {
  state.cart = state.cart.filter((id) => state.products.some((product) => product.id === id));
  state.wishlist = new Set([...state.wishlist].filter((id) => state.products.some((product) => product.id === id)));
  cartCount.textContent = state.cart.length;
  wishlistCount.textContent = state.wishlist.size;

  const grouped = state.cart.reduce((acc, id) => {
    acc[id] = (acc[id] || 0) + 1;
    return acc;
  }, {});

  const lines = Object.entries(grouped)
    .map(([id, quantity]) => {
      const product = state.products.find((item) => item.id === Number(id));
      return product ? { ...product, quantity } : null;
    })
    .filter(Boolean);

  cartItems.innerHTML = lines.length
    ? lines
        .map(
          (item) => `
            <div class="cart-line">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <small>${quantityLabel(item.quantity)} x ${formatPrice(item.price)}</small>
              </div>
              <strong>${formatPrice(item.price * item.quantity)}</strong>
            </div>
          `
        )
        .join("")
    : `<p class="empty-state">Your cart is empty until you add a creator-listed product.</p>`;

  const subtotal = lines.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartSubtotal.textContent = formatPrice(subtotal);
}

function quantityLabel(quantity) {
  return quantity.toString().padStart(2, "0");
}

function updateCountdown() {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const remaining = Math.max(0, end - new Date());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  document.querySelector("#days").textContent = String(days).padStart(2, "0");
  document.querySelector("#hours").textContent = String(hours).padStart(2, "0");
  document.querySelector("#minutes").textContent = String(minutes).padStart(2, "0");
  document.querySelector("#seconds").textContent = String(seconds).padStart(2, "0");
}

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(productForm);
  const product = {
    id: Date.now(),
    name: formData.get("name").trim(),
    category: formData.get("category"),
    price: Number(formData.get("price")),
    image: formData.get("image").trim(),
    sale: formData.get("sale").trim(),
    desc: formData.get("desc").trim(),
    createdAt: Date.now(),
  };

  if (!product.name || !product.desc || !Number.isFinite(product.price) || product.price <= 0) {
    return;
  }

  state.products.unshift(product);
  saveProducts();
  productForm.reset();
  renderProducts();
  updateCart();
});

clearProducts.addEventListener("click", () => {
  state.products = [];
  state.cart = [];
  state.wishlist.clear();
  saveProducts();
  renderProducts();
  updateCart();
});

filterButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  filterButtons.querySelectorAll(".chip").forEach((chip) => chip.classList.toggle("active", chip === button));
  renderProducts();
});

sortSelect.addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderProducts();
});

searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderProducts();
});

grid.addEventListener("click", (event) => {
  const cartButton = event.target.closest("[data-cart]");
  const wishlistButton = event.target.closest("[data-wishlist]");

  if (cartButton) {
    state.cart.push(Number(cartButton.dataset.cart));
    updateCart();
    cartDrawer.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");
  }

  if (wishlistButton) {
    const id = Number(wishlistButton.dataset.wishlist);
    if (state.wishlist.has(id)) {
      state.wishlist.delete(id);
    } else {
      state.wishlist.add(id);
    }
    updateCart();
    renderProducts();
  }
});

document.querySelector("#cartButton").addEventListener("click", () => {
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
});

document.querySelector("#closeCart").addEventListener("click", () => {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
});

cartDrawer.addEventListener("click", (event) => {
  if (event.target === cartDrawer) {
    cartDrawer.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");
  }
});

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  header.classList.toggle("menu-open", isOpen);
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelector(".newsletter form").addEventListener("submit", (event) => {
  event.preventDefault();
  event.currentTarget.reset();
});

renderProducts();
updateCart();
updateCountdown();
setInterval(updateCountdown, 1000);

window.addEventListener("load", () => {
  if (window.lucide) window.lucide.createIcons();
});
