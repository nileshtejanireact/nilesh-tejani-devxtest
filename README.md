# Loomhaus - Shopify Developer Assignment

Custom Shopify OS 2.0 theme built for the **Loomhaus** homepage assignment, engineered strictly using Liquid, vanilla JavaScript, and modern CSS without external dependencies, libraries, or page builders.

## 🚀 Live Demo & Store
- **Store URL**: `https://nilesh-tejani-devx-jcphgz-gfxra2aw.myshopify.com`
- **Figma Design Reference**: `devx-Shopify-Assignment (1440px Desktop / 390px Mobile)`

---

## 🛠️ Key Features & Architecture

### 1. Announcement Bar & Navigation Header
- Announcement banner with promotional highlight.
- Clean header with brand logo, navigation links, and real-time AJAX cart item counter badge.

### 2. The Winter Edit - Hero Section
- Curved arch image mask rendering with high-resolution responsive photography.
- Verified review badges (`4.8★ 20k+ reviews`, `100% organic cotton`, `30 days free returns`).
- Infinite CSS smooth marquee bar (`Organic cotton ✦ Made to last ✦ Sizes XS to L`).

### 3. "Loomhaus in the wild" Hotspots Grid
- 6-item curated lifestyle gallery (2-column layout on mobile, 3-column on desktop).
- Interactive `+` hotspot buttons that trigger the interactive **Quick View** drawer/modal.

### 4. Quick View (Desktop Modal & Mobile Bottom Sheet)
- **100% Dynamic Options & Swatches**: Color swatches are dynamically extracted from product options. Products without color options automatically omit swatch selectors.
- **Strict Option Validation**: Prevents cart addition until required size/variant options are selected, displaying contextual inline errors.
- **Pure CSS / JS Transitions**: Smooth mobile slide-up sheet with drag handle and backdrop blur.

### 5. Featured Product Section ("Classic Varsity Top")
- Dynamic thumbnail gallery with zero-lag instant image preview switching and arrow navigation.
- Dynamic option selection updating variant IDs, prices, compare-at prices, and "SAVE %" badges.
- One-click copyable offer codes (`LOOM10` for 10% off and `LOOM15` for 15% off).

### 6. AJAX Cart Drawer & Auto-Gift Pairing Engine
- Slide-out cart drawer supporting asynchronous quantity adjustments, deletions, and subtotal calculation.
- **Auto-Gift Promotion Rule**: Automatically adds the **Soft Winter Jacket** (`dark-winter-jacket`) when any product in **Black & M** is present in the cart, and removes it if the qualifying item is removed.

---

## 💻 Tech Stack
- **Liquid**: Shopify Online Store 2.0 theme architecture
- **CSS3**: Custom design tokens, CSS Grid, Flexbox, hardware-accelerated animations
- **JavaScript**: Pure Vanilla JS (ES6+) — Strictly **no jQuery**, no frameworks, no third-party libraries
