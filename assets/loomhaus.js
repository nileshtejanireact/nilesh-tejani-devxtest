/**
 * Loomhaus Custom Theme JavaScript - devx labs Assignment
 * Pure Vanilla JavaScript (Strictly No jQuery)
 * 100% Matching Figma Desktop & Mobile Interactions
 */

window.Loomhaus = (function() {
  'use strict';

  // State
  let cartData = null;
  let isCartBusy = false;
  let currentQvProduct = null;
  let qvSelectedColor = '';
  let qvSelectedSize = '';

  // Cache DOM
  const dom = {
    cartDrawer: null,
    cartOverlay: null,
    cartItemsList: null,
    cartSubtotal: null,
    cartCountBadges: [],
    quickViewBackdrop: null,
    quickViewModal: null
  };

  function init() {
    dom.cartDrawer = document.getElementById('LoomhausCartDrawer');
    dom.cartOverlay = document.getElementById('LoomhausCartOverlay');
    dom.cartItemsList = document.getElementById('LoomhausCartItems');
    dom.cartSubtotal = document.getElementById('LoomhausCartSubtotal');
    dom.cartCountBadges = Array.from(document.querySelectorAll('.lh-cart-count-badge'));
    dom.quickViewBackdrop = document.getElementById('LoomhausQuickViewBackdrop');

    setupCartDrawerEvents();
    setupQuickViewEvents();
    setupFeaturedProduct();
    setupCopyOfferCodes();

    // Initial cart load
    fetchCart();
  }

  /* ==========================================================================
     Cart AJAX API & Auto-Gift Pairing Logic
     ========================================================================== */
  async function fetchCart() {
    try {
      const res = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
      cartData = await res.json();
      await handleAutoGiftRule(cartData);
      renderCart(cartData);
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  }

  // Special Rule:
  // When any product in Black and M is added to the cart, Soft Winter Jacket is added automatically.
  // If that item is removed, Soft Winter Jacket is removed too.
  async function handleAutoGiftRule(cart) {
    if (isCartBusy) return;
    const config = window.LoomhausConfig || {};
    const jacketVariantId = config.jacketVariantId;
    const jacketHandle = config.jacketHandle || 'dark-winter-jacket';

    if (!jacketVariantId) return;

    // Check if any product in Black and M exists in cart
    const hasBlackAndM = cart.items.some(item => {
      // Don't treat the gift jacket itself as trigger
      if (item.handle === jacketHandle || item.variant_id == jacketVariantId) return false;
      const title = (item.variant_title || '').toLowerCase();
      const options = item.options_with_values ? item.options_with_values.map(o => (o.value || '').toLowerCase()) : [];
      const hasBlack = title.includes('black') || options.includes('black');
      const hasM = title.split(/[\s\/]+/).includes('m') || options.includes('m');
      return hasBlack && hasM;
    });

    // Check if jacket is currently in cart
    const jacketItem = cart.items.find(item => item.handle === jacketHandle || item.variant_id == jacketVariantId);

    if (hasBlackAndM && !jacketItem) {
      // Auto-add Soft Winter Jacket
      isCartBusy = true;
      try {
        await fetch('/cart/add.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            id: jacketVariantId,
            quantity: 1,
            properties: { '_auto_gift': 'true', 'Promotion': 'Free with Black + M item' }
          })
        });
        const updated = await (await fetch('/cart.js')).json();
        cartData = updated;
      } catch (e) {
        console.error('Failed to auto-add Soft Winter Jacket:', e);
      } finally {
        isCartBusy = false;
      }
    } else if (!hasBlackAndM && jacketItem) {
      // Auto-remove Soft Winter Jacket
      isCartBusy = true;
      try {
        await fetch('/cart/change.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            id: jacketItem.key,
            quantity: 0
          })
        });
        const updated = await (await fetch('/cart.js')).json();
        cartData = updated;
      } catch (e) {
        console.error('Failed to auto-remove Soft Winter Jacket:', e);
      } finally {
        isCartBusy = false;
      }
    }
  }

  async function addToCart(variantId, quantity = 1, properties = {}) {
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity: quantity, properties: properties })
      });
      if (!res.ok) throw new Error('Add to cart failed');
      await fetchCart();
      openCart();
    } catch (err) {
      console.error(err);
      alert('Could not add item to cart. Please check inventory.');
    }
  }

  async function changeCartItem(key, quantity) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ id: key, quantity: quantity })
      });
      cartData = await res.json();
      await handleAutoGiftRule(cartData);
      renderCart(cartData);
    } catch (err) {
      console.error('Error changing cart item:', err);
    }
  }

  function renderCart(cart) {
    if (!cart) return;

    // Update count badges
    dom.cartCountBadges.forEach(b => {
      b.textContent = cart.item_count || 0;
    });

    // Update subtotal
    if (dom.cartSubtotal) {
      dom.cartSubtotal.textContent = formatMoney(cart.total_price);
    }

    // Render line items
    if (!dom.cartItemsList) return;

    if (cart.items.length === 0) {
      dom.cartItemsList.innerHTML = `
        <div style="text-align: center; padding: 40px 0; color: #6b6d64;">
          <p style="font-size: 16px; margin-bottom: 16px;">Your cart is empty.</p>
          <a href="#loomhaus-featured" class="lh-btn-header-drop" onclick="Loomhaus.closeCart();">Start Shopping</a>
        </div>
      `;
      return;
    }

    const config = window.LoomhausConfig || {};
    const jacketHandle = config.jacketHandle || 'dark-winter-jacket';

    dom.cartItemsList.innerHTML = cart.items.map(item => {
      const isAutoGift = item.handle === jacketHandle || (item.properties && item.properties._auto_gift);
      return `
        <div class="lh-cart-item" data-key="${item.key}">
          <img src="${item.featured_image ? item.featured_image.url : ''}" alt="${item.title}" class="lh-cart-item-img">
          <div class="lh-cart-item-details">
            ${isAutoGift ? `<span class="lh-auto-gift-badge">🎁 Auto-added Gift (Black + M)</span>` : ''}
            <div class="lh-cart-item-title">${item.product_title}</div>
            ${item.variant_title ? `<div class="lh-cart-item-variant">${item.variant_title}</div>` : ''}
            <div class="lh-cart-item-price">${formatMoney(item.final_line_price)}</div>
            <div class="lh-item-actions">
              ${isAutoGift ? `
                <span style="font-size: 12px; color: #2e7d32; font-weight: 600;">Qty: ${item.quantity}</span>
              ` : `
                <div class="lh-drawer-qty-pill">
                  <button type="button" class="lh-drawer-qty-btn" onclick="Loomhaus.changeItem('${item.key}', ${item.quantity - 1})">-</button>
                  <span class="lh-drawer-qty-num">${item.quantity}</span>
                  <button type="button" class="lh-drawer-qty-btn" onclick="Loomhaus.changeItem('${item.key}', ${item.quantity + 1})">+</button>
                </div>
                <button type="button" class="lh-item-remove-btn" onclick="Loomhaus.changeItem('${item.key}', 0)">Remove</button>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function formatMoney(cents) {
    if (isNaN(cents)) return '₹0.00';
    const amount = (cents / 100).toFixed(2);
    return `₹${amount}`;
  }

  function openCart() {
    if (dom.cartDrawer) dom.cartDrawer.classList.add('is-open');
    if (dom.cartOverlay) dom.cartOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    if (dom.cartDrawer) dom.cartDrawer.classList.remove('is-open');
    if (dom.cartOverlay) dom.cartOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function setupCartDrawerEvents() {
    document.querySelectorAll('[data-cart-trigger]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCart();
      });
    });

    const closeBtn = document.getElementById('LoomhausCartClose');
    if (closeBtn) closeBtn.addEventListener('click', closeCart);
    if (dom.cartOverlay) dom.cartOverlay.addEventListener('click', closeCart);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeCart();
        closeQuickView();
      }
    });
  }

  /* ==========================================================================
     Quick View Popup (Desktop Modal / Mobile Bottom Sheet)
     100% Matching Image 2 and Figma Specs
     ========================================================================== */
  async function openQuickView(handle) {
    if (!dom.quickViewBackdrop) return;
    try {
      const res = await fetch(`/products/${handle}.js`);
      currentQvProduct = await res.json();
      renderQuickView(currentQvProduct);
      dom.quickViewBackdrop.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    } catch (e) {
      console.error('Failed to load quick view for', handle, e);
    }
  }

  function closeQuickView() {
    if (!dom.quickViewBackdrop) return;
    dom.quickViewBackdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function getColorHex(colorName) {
    const c = (colorName || '').toLowerCase().trim();
    if (c === 'black') return { hex: '#111111', isWhite: false };
    if (c === 'white') return { hex: '#ffffff', isWhite: true };
    if (c === 'navy' || c === 'blue') return { hex: '#1b2c4e', isWhite: false };
    if (c === 'olive' || c === 'green') return { hex: '#48523c', isWhite: false };
    if (c === 'red') return { hex: '#b83232', isWhite: false };
    if (c === 'yellow') return { hex: '#d4a234', isWhite: false };
    if (c === 'cream' || c === 'beige') return { hex: '#ded9cc', isWhite: false };
    return { hex: '#333333', isWhite: false };
  }

  function renderQuickView(product) {
    const qvImage = document.getElementById('LhQvImage');
    const qvTitle = document.getElementById('LhQvTitle');
    const qvPrice = document.getElementById('LhQvPrice');
    const qvDesc = document.getElementById('LhQvDesc');
    const qvColorSwatches = document.getElementById('LhQvColorSwatches');
    const qvSelect = document.getElementById('LhQvSelect');
    const qvAddBtn = document.getElementById('LhQvAddToCart');

    if (qvImage) qvImage.src = product.featured_image || '';
    if (qvTitle) qvTitle.textContent = product.title;
    if (qvPrice) qvPrice.textContent = formatMoney(product.price);
    if (qvDesc) {
      const temp = document.createElement('div');
      temp.innerHTML = product.description || 'Crafted with premium materials for timeless wear and unmatched comfort.';
      qvDesc.textContent = temp.textContent || temp.innerText || '';
    }

    // Extract Colors and Sizes from variants
    const colors = [];
    const sizes = [];

    product.variants.forEach(v => {
      const parts = (v.title || '').split('/').map(s => s.trim());
      parts.forEach(p => {
        const lower = p.toLowerCase();
        if (['black', 'white', 'navy', 'blue', 'green', 'olive', 'red', 'cream', 'yellow'].includes(lower)) {
          if (!colors.includes(p)) colors.push(p);
        } else if (['xs', 's', 'm', 'l', 'xl', 'xxl', '2xl'].includes(lower)) {
          if (!sizes.includes(p)) sizes.push(p);
        }
      });
    });

    if (colors.length === 0) colors.push('Black', 'White');
    if (sizes.length === 0) sizes.push('XS', 'S', 'M', 'L');

    qvSelectedColor = colors[0];
    qvSelectedSize = '';

    // Render Color Swatches [ ● Black ] [ ○ White ]
    if (qvColorSwatches) {
      qvColorSwatches.innerHTML = colors.map((col, idx) => {
        const { hex, isWhite } = getColorHex(col);
        const isSelected = idx === 0;
        return `
          <button type="button" class="lh-qv-swatch ${isSelected ? 'is-selected' : ''}" data-color="${col}">
            <span class="lh-qv-swatch-dot" style="background-color: ${hex}; ${isWhite ? 'border: 1px solid #d0ccc2;' : ''}"></span>
            <span class="lh-qv-swatch-name">${col}</span>
          </button>
        `;
      }).join('');

      qvColorSwatches.querySelectorAll('.lh-qv-swatch').forEach(btn => {
        btn.addEventListener('click', () => {
          qvColorSwatches.querySelectorAll('.lh-qv-swatch').forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          qvSelectedColor = btn.dataset.color;
          updateQvVariant();
        });
      });
    }

    // Render Size Dropdown
    if (qvSelect) {
      qvSelect.innerHTML = `
        <option value="" disabled selected>Choose your size</option>
        ${sizes.map(s => `<option value="${s}">${s}</option>`).join('')}
      `;

      qvSelect.onchange = function() {
        qvSelectedSize = qvSelect.value;
        updateQvVariant();
      };
    }

    function updateQvVariant() {
      let match = product.variants.find(v => {
        const t = v.title.toLowerCase();
        const hasCol = t.includes(qvSelectedColor.toLowerCase());
        const hasSize = qvSelectedSize ? t.split(/[\s\/]+/).includes(qvSelectedSize.toLowerCase()) : true;
        return hasCol && hasSize;
      });

      if (!match) match = product.variants[0];

      if (match && qvPrice) {
        qvPrice.textContent = formatMoney(match.price);
      }
      if (match && match.featured_image && match.featured_image.src && qvImage) {
        qvImage.src = match.featured_image.src;
      }
    }

    if (qvAddBtn) {
      qvAddBtn.onclick = async function() {
        let match = product.variants.find(v => {
          const t = v.title.toLowerCase();
          const hasCol = t.includes(qvSelectedColor.toLowerCase());
          const hasSize = qvSelectedSize ? t.split(/[\s\/]+/).includes(qvSelectedSize.toLowerCase()) : true;
          return hasCol && hasSize;
        });

        const variantId = match ? match.id : product.variants[0].id;
        closeQuickView();
        await addToCart(variantId, 1);
      };
    }
  }

  function setupQuickViewEvents() {
    // Hotspot clicks
    document.querySelectorAll('[data-hotspot-product]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = btn.dataset.hotspotProduct;
        if (handle) openQuickView(handle);
      });
    });

    // Close button & backdrop click
    const closeBtn = document.getElementById('LhQvClose');
    if (closeBtn) closeBtn.addEventListener('click', closeQuickView);
    if (dom.quickViewBackdrop) {
      dom.quickViewBackdrop.addEventListener('click', (e) => {
        if (e.target === dom.quickViewBackdrop) closeQuickView();
      });
    }
  }

  /* ==========================================================================
     Featured Product (Variant Switcher, Savings, Dynamic Offers)
     ========================================================================== */
  function setupFeaturedProduct() {
    const section = document.getElementById('LoomhausFeaturedProduct');
    if (!section) return;

    const productJsonEl = document.getElementById('LoomhausFeaturedProductJson');
    if (!productJsonEl) return;

    let productData = null;
    try {
      productData = JSON.parse(productJsonEl.textContent);
    } catch (e) {
      return;
    }

    let selectedColor = 'Black';
    let selectedSize = 'M';

    const mainImg = document.getElementById('LhFeaturedMainImg');
    const priceCurrent = document.getElementById('LhFeaturedPriceCurrent');
    const priceCompare = document.getElementById('LhFeaturedPriceCompare');
    const saveBadge = document.getElementById('LhFeaturedSaveBadge');
    const variantIdInput = document.getElementById('LhFeaturedVariantId');
    const qtyInput = document.getElementById('LhFeaturedQty');
    const offer1Price = document.getElementById('LhOffer1Price');
    const offer2Price = document.getElementById('LhOffer2Price');
    const colorLabel = document.getElementById('LhSelectedColorLabel');
    const dotsWrap = document.getElementById('LhGalleryDots');

    function updateVariant() {
      // Find matching variant
      const variant = productData.variants.find(v => {
        const title = v.title.toLowerCase();
        return title.includes(selectedColor.toLowerCase()) && title.includes(selectedSize.toLowerCase());
      }) || productData.variants[0];

      if (variantIdInput) variantIdInput.value = variant.id;

      // Update price display
      if (priceCurrent) priceCurrent.textContent = formatMoney(variant.price);
      if (priceCompare) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          priceCompare.textContent = formatMoney(variant.compare_at_price);
          priceCompare.style.display = 'inline-block';
          if (saveBadge) {
            const pct = Math.round(((variant.compare_at_price - variant.price) / variant.compare_at_price) * 100);
            saveBadge.textContent = `SAVE ${pct}%`;
            saveBadge.style.display = 'inline-block';
          }
        } else {
          priceCompare.style.display = 'none';
          if (saveBadge) saveBadge.style.display = 'none';
        }
      }

      // Update Dynamic Offers: 10% off and 15% off
      if (offer1Price) {
        const discounted = variant.price * 0.9;
        offer1Price.textContent = `Get it for ${formatMoney(discounted)}`;
      }
      if (offer2Price) {
        const discounted = variant.price * 0.85;
        offer2Price.textContent = `Get it for ${formatMoney(discounted)}`;
      }

      // Update image if variant has featured image
      if (variant.featured_image && variant.featured_image.src && mainImg) {
        mainImg.src = variant.featured_image.src;
      }
    }

    // Color Swatch buttons
    section.querySelectorAll('.lh-color-swatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        section.querySelectorAll('.lh-color-swatch-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedColor = btn.dataset.color || 'Black';
        if (colorLabel) colorLabel.textContent = selectedColor.toUpperCase();
        updateVariant();
      });
    });

    // Size Pill buttons
    section.querySelectorAll('.lh-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        section.querySelectorAll('.lh-size-btn').forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');
        selectedSize = btn.dataset.size || 'M';
        updateVariant();
      });
    });

    // Quantity selector
    const qtyMinus = document.getElementById('LhQtyMinus');
    const qtyPlus = document.getElementById('LhQtyPlus');
    if (qtyMinus && qtyPlus && qtyInput) {
      qtyMinus.onclick = () => {
        const val = Math.max(1, parseInt(qtyInput.value || 1) - 1);
        qtyInput.value = val < 10 ? `0${val}` : val;
      };
      qtyPlus.onclick = () => {
        const val = parseInt(qtyInput.value || 1) + 1;
        qtyInput.value = val < 10 ? `0${val}` : val;
      };
    }

    // Add to Cart
    const addBtn = document.getElementById('LhFeaturedAddToCart');
    if (addBtn) {
      addBtn.onclick = async () => {
        const vid = variantIdInput ? variantIdInput.value : productData.variants[0].id;
        const qty = qtyInput ? parseInt(qtyInput.value || 1) : 1;
        await addToCart(vid, qty);
      };
    }

    // Gallery Thumbnails & Mobile Dots
    const thumbs = Array.from(section.querySelectorAll('.lh-thumb-btn'));
    function setActiveGalleryIndex(idx) {
      thumbs.forEach((t, i) => t.classList.toggle('is-active', i === idx));
      if (thumbs[idx] && mainImg) {
        mainImg.src = thumbs[idx].dataset.src;
      }
      if (dotsWrap) {
        const dots = dotsWrap.querySelectorAll('.lh-dot');
        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
      }
    }

    thumbs.forEach((btn, idx) => {
      btn.addEventListener('click', () => setActiveGalleryIndex(idx));
    });

    // Gallery Arrows
    const prevArrow = document.getElementById('LhGalleryPrev');
    const nextArrow = document.getElementById('LhGalleryNext');
    if (prevArrow && nextArrow && thumbs.length > 0) {
      prevArrow.onclick = () => {
        const activeIdx = thumbs.findIndex(t => t.classList.contains('is-active'));
        const nextIdx = (activeIdx - 1 + thumbs.length) % thumbs.length;
        setActiveGalleryIndex(nextIdx);
      };
      nextArrow.onclick = () => {
        const activeIdx = thumbs.findIndex(t => t.classList.contains('is-active'));
        const nextIdx = (activeIdx + 1) % thumbs.length;
        setActiveGalleryIndex(nextIdx);
      };
    }

    // Initial variant calculation
    updateVariant();
  }

  /* ==========================================================================
     Promo Code Copy Buttons
     ========================================================================== */
  function setupCopyOfferCodes() {
    document.querySelectorAll('[data-copy-code]').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.dataset.copyCode;
        if (!code) return;
        navigator.clipboard.writeText(code).then(() => {
          const original = btn.innerHTML;
          btn.innerHTML = `<span style="font-size: 11px; font-weight: 700; color: #2e7d32;">COPIED!</span>`;
          setTimeout(() => { btn.innerHTML = original; }, 2000);
        });
      });
    });
  }

  // Public API
  return {
    init: init,
    openCart: openCart,
    closeCart: closeCart,
    changeItem: changeCartItem,
    openQuickView: openQuickView,
    closeQuickView: closeQuickView,
    addToCart: addToCart
  };
})();

// DOM Ready
document.addEventListener('DOMContentLoaded', function() {
  window.Loomhaus.init();
});
