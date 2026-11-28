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
      if (item.handle === jacketHandle || item.variant_id == jacketVariantId) return false;
      const title = (item.variant_title || '').toLowerCase();
      const options = item.options_with_values ? item.options_with_values.map(o => (o.value || '').toLowerCase()) : [];
      const hasBlack = title.includes('black') || options.includes('black');
      const hasM = title.split(/[\s\/]+/).includes('m') || options.includes('m');
      return hasBlack && hasM;
    });

    const jacketItem = cart.items.find(item => item.handle === jacketHandle || item.variant_id == jacketVariantId);

    if (hasBlackAndM && !jacketItem) {
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

    dom.cartCountBadges.forEach(b => {
      b.textContent = cart.item_count || 0;
    });

    if (dom.cartSubtotal) {
      dom.cartSubtotal.textContent = formatMoney(cart.total_price);
    }

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
     100% Matching Image 2 and Figma Specs with Size Validation
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
    if (c === 'navy' || c === 'navy blue') return { hex: '#1b2c4e', isWhite: false };
    if (c === 'blue' || c === 'royal blue') return { hex: '#26547c', isWhite: false };
    if (c === 'light blue' || c === 'sky blue') return { hex: '#a0c4e2', isWhite: false };
    if (c === 'olive' || c === 'olive green' || c === 'green') return { hex: '#48523c', isWhite: false };
    if (c === 'dark green' || c === 'forest green') return { hex: '#1d3e26', isWhite: false };
    if (c === 'red' || c === 'crimson') return { hex: '#b83232', isWhite: false };
    if (c === 'maroon' || c === 'burgundy' || c === 'wine') return { hex: '#58111a', isWhite: false };
    if (c === 'yellow' || c === 'mustard') return { hex: '#d4a234', isWhite: false };
    if (c === 'cream' || c === 'beige' || c === 'sand') return { hex: '#ded9cc', isWhite: false };
    if (c === 'tan' || c === 'khaki' || c === 'camel') return { hex: '#c29b6e', isWhite: false };
    if (c === 'brown' || c === 'chocolate') return { hex: '#5a3825', isWhite: false };
    if (c === 'grey' || c === 'gray' || c === 'heather') return { hex: '#8a8a8a', isWhite: false };
    if (c === 'charcoal') return { hex: '#333333', isWhite: false };
    if (c === 'pink' || c === 'blush' || c === 'rose') return { hex: '#e8a598', isWhite: false };
    if (c === 'orange') return { hex: '#e66b27', isWhite: false };
    if (c === 'purple' || c === 'violet') return { hex: '#6b3e8c', isWhite: false };
    return { hex: '#222222', isWhite: false };
  }

  function renderQuickView(product) {
    const qvImage = document.getElementById('LhQvImage');
    const qvTitle = document.getElementById('LhQvTitle');
    const qvPrice = document.getElementById('LhQvPrice');
    const qvDesc = document.getElementById('LhQvDesc');
    const qvColorGroup = document.getElementById('LhQvColorGroup');
    const qvColorLabel = document.getElementById('LhQvColorLabel');
    const qvColorSwatches = document.getElementById('LhQvColorSwatches');
    const qvSizeGroup = document.getElementById('LhQvSizeGroup');
    const qvSizeLabel = document.getElementById('LhQvSizeLabel');
    const qvSelect = document.getElementById('LhQvSelect');
    const qvSizeError = document.getElementById('LhQvSizeError');
    const qvAddBtn = document.getElementById('LhQvAddToCart');

    if (qvImage) qvImage.src = product.featured_image || (product.images && product.images[0]) || '';
    if (qvTitle) qvTitle.textContent = product.title;
    if (qvPrice) qvPrice.textContent = formatMoney(product.price);
    if (qvDesc) {
      const temp = document.createElement('div');
      temp.innerHTML = product.description || 'Crafted with premium materials for timeless wear and unmatched comfort.';
      qvDesc.textContent = temp.textContent || temp.innerText || '';
    }

    // Reset validation error state
    if (qvSizeError) qvSizeError.style.display = 'none';
    if (qvSelect) qvSelect.style.borderColor = '#d8d4ca';

    // Parse product options dynamically
    const normalizedOptions = (product.options || []).map((opt, idx) => {
      const pos = idx + 1;
      if (typeof opt === 'string') {
        const valSet = [];
        (product.variants || []).forEach(v => {
          const vVal = v.options ? v.options[idx] : v['option' + pos];
          if (vVal && !valSet.includes(vVal)) valSet.push(vVal);
        });
        return { name: opt, position: pos, index: idx, values: valSet };
      }
      return {
        name: opt.name || `Option ${pos}`,
        position: opt.position || pos,
        index: (opt.position ? opt.position - 1 : idx),
        values: opt.values || []
      };
    }).filter(opt => opt.name.toLowerCase() !== 'title' || (opt.values && opt.values[0] !== 'Default Title'));

    // Check for Color option
    const colorOpt = normalizedOptions.find(o => /colou?r/i.test(o.name));
    // Check for Secondary/Size option
    const otherOpt = normalizedOptions.find(o => !/colou?r/i.test(o.name));

    let qvSelectedColor = '';
    let qvSelectedOther = '';

    // 1. Dynamic Color Swatches (100% dynamic: hidden if product has no color option)
    if (colorOpt && colorOpt.values && colorOpt.values.length > 0) {
      if (qvColorGroup) qvColorGroup.style.display = 'block';
      if (qvColorLabel) qvColorLabel.textContent = colorOpt.name.toUpperCase();
      qvSelectedColor = colorOpt.values[0];

      if (qvColorSwatches) {
        qvColorSwatches.innerHTML = colorOpt.values.map((col, idx) => {
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
    } else {
      // Product has NO color option - completely hide swatch group
      if (qvColorGroup) qvColorGroup.style.display = 'none';
      if (qvColorSwatches) qvColorSwatches.innerHTML = '';
      qvSelectedColor = '';
    }

    // 2. Dynamic Size / Secondary Option (100% dynamic)
    if (otherOpt && otherOpt.values && otherOpt.values.length > 0) {
      if (qvSizeGroup) qvSizeGroup.style.display = 'block';
      if (qvSizeLabel) qvSizeLabel.textContent = otherOpt.name.toUpperCase();
      qvSelectedOther = ''; // Must remain unselected until user explicitly picks

      if (qvSelect) {
        const optionName = otherOpt.name.toLowerCase();
        qvSelect.innerHTML = `
          <option value="" disabled selected>Choose your ${optionName}</option>
          ${otherOpt.values.map(val => `<option value="${val}">${val}</option>`).join('')}
        `;

        qvSelect.onchange = function() {
          qvSelectedOther = qvSelect.value;
          if (qvSizeError) qvSizeError.style.display = 'none';
          qvSelect.style.borderColor = '#d8d4ca';
          updateQvVariant();
        };
      }
    } else {
      // Product has no size/secondary option (e.g. single variant)
      if (qvSizeGroup) qvSizeGroup.style.display = 'none';
      qvSelectedOther = '';
    }

    // Dynamic Variant Matching
    function findMatchingVariant(requireAll = false) {
      if (requireAll && otherOpt && !qvSelectedOther) {
        return null; // Enforce user selection
      }

      return (product.variants || []).find(v => {
        if (colorOpt && qvSelectedColor) {
          const colVal = v.options ? v.options[colorOpt.index] : v['option' + colorOpt.position];
          if ((colVal || '').toLowerCase() !== qvSelectedColor.toLowerCase()) return false;
        }
        if (otherOpt && qvSelectedOther) {
          const othVal = v.options ? v.options[otherOpt.index] : v['option' + otherOpt.position];
          if ((othVal || '').toLowerCase() !== qvSelectedOther.toLowerCase()) return false;
        }
        return true;
      }) || product.variants[0];
    }

    function updateQvVariant() {
      const match = findMatchingVariant(false);
      if (match) {
        if (qvPrice) qvPrice.textContent = formatMoney(match.price);
        if (match.featured_image && match.featured_image.src && qvImage) {
          qvImage.src = match.featured_image.src;
        }
      }
    }

    // Initial variant sync
    updateQvVariant();

    // Add to Cart with STRICT Option/Size Validation
    if (qvAddBtn) {
      qvAddBtn.onclick = async function() {
        if (otherOpt && !qvSelectedOther) {
          if (qvSizeError) {
            qvSizeError.textContent = `Please select a ${otherOpt.name.toLowerCase()} to continue`;
            qvSizeError.style.display = 'block';
          }
          if (qvSelect) {
            qvSelect.style.borderColor = '#c25e40';
            qvSelect.focus();
          }
          return;
        }

        const match = findMatchingVariant(true);
        if (!match) {
          if (qvSizeError) {
            qvSizeError.textContent = 'This variant combination is currently unavailable.';
            qvSizeError.style.display = 'block';
          }
          return;
        }

        closeQuickView();
        await addToCart(match.id, 1);
      };
    }
  }

  function setupQuickViewEvents() {
    document.querySelectorAll('[data-hotspot-product]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const handle = btn.dataset.hotspotProduct;
        if (handle) openQuickView(handle);
      });
    });

    const closeBtn = document.getElementById('LhQvClose');
    if (closeBtn) closeBtn.addEventListener('click', closeQuickView);
    if (dom.quickViewBackdrop) {
      dom.quickViewBackdrop.addEventListener('click', (e) => {
        if (e.target === dom.quickViewBackdrop) closeQuickView();
      });
    }
  }

  /* ==========================================================================
     Featured Product (100% Dynamic Options, Savings & Offers)
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

    const mainImg = document.getElementById('LhFeaturedMainImg');
    const priceCurrent = document.getElementById('LhFeaturedPriceCurrent');
    const priceCompare = document.getElementById('LhFeaturedPriceCompare');
    const saveBadge = document.getElementById('LhFeaturedSaveBadge');
    const variantIdInput = document.getElementById('LhFeaturedVariantId');
    const qtyInput = document.getElementById('LhFeaturedQty');
    const offer1Price = document.getElementById('LhOffer1Price');
    const offer2Price = document.getElementById('LhOffer2Price');
    const colorLabel = document.getElementById('LhSelectedColorLabel');

    // Dynamic map of selected options: { "0": "val1", "1": "val2", ... }
    const selectedOptions = {};
    section.querySelectorAll('.lh-featured-option-group').forEach(group => {
      const idx = group.dataset.optionIndex;
      const activeBtn = group.querySelector('.is-selected');
      if (activeBtn) {
        selectedOptions[idx] = activeBtn.dataset.value || activeBtn.dataset.color || activeBtn.dataset.size;
      }
    });

    function updateVariant() {
      const variant = productData.variants.find(v => {
        return Object.keys(selectedOptions).every(idx => {
          const val = selectedOptions[idx];
          if (!val) return true;
          const optVal = v.options ? v.options[idx] : v['option' + (parseInt(idx) + 1)];
          return (optVal || '').toLowerCase() === val.toLowerCase();
        });
      }) || productData.variants[0];

      if (!variant) return;

      if (variantIdInput) variantIdInput.value = variant.id;

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

      if (offer1Price) {
        const discounted = variant.price * 0.9;
        offer1Price.textContent = `Get it for ${formatMoney(discounted)}`;
      }
      if (offer2Price) {
        const discounted = variant.price * 0.85;
        offer2Price.textContent = `Get it for ${formatMoney(discounted)}`;
      }

      if (variant.featured_image && variant.featured_image.src && mainImg) {
        mainImg.removeAttribute('srcset');
        mainImg.src = variant.featured_image.src;
      }
    }

    // Attach click handlers dynamically to all option buttons across all option groups
    section.querySelectorAll('.lh-featured-option-group').forEach(group => {
      const idx = group.dataset.optionIndex;
      const buttons = group.querySelectorAll('button[data-value], .lh-color-swatch-btn, .lh-size-btn');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          const val = btn.dataset.value || btn.dataset.color || btn.dataset.size;
          selectedOptions[idx] = val;
          if (btn.classList.contains('lh-color-swatch-btn') && colorLabel) {
            colorLabel.textContent = val.toUpperCase();
          }
          updateVariant();
        });
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

// DOM Ready Handler (Handles both deferred scripts and already loaded DOM)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window.Loomhaus.init();
  });
} else {
  window.Loomhaus.init();
}
