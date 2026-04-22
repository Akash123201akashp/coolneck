/**
 * COOL NECK — Two Product Store JavaScript
 * Multi-product Cart, Checkout, UPI/COD Payment
 */
(function() {
  'use strict';

  /* ========== SUPABASE CONFIG ========== */
  const SUPABASE_URL = 'https://rubbrgrzvanrigatpmto.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YmJyZ3J6dmFucmlnYXRwbXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzUwMjAsImV4cCI6MjA4NTQ1MTAyMH0.yUs7UPqmnMY5m8XIXp8Kmvj8IawbfNyDH3TLI8JVENI';
  const EDGE_FUNCTION_URL = SUPABASE_URL + '/functions/v1/process-order';
  const ANALYTICS_TABLE = 'analytics';

  /* ========== PRODUCTS DATA ========== */
  const PRODUCTS = {
    1: {
      id: 1,
      name: 'Cool Neck — Bladeless Neck Fan',
      price: 649,
      comparePrice: 1499,
      image: 'assets/product 1/A_professional_product_202604171306.png',
      images: [
        'assets/product 1/A_professional_product_202604171306.png',
        'assets/product 1/A_pastel_pink_202604141322.png',
        'assets/product 1/Subject__A_professional_202604171320.png'
      ]
    },
    2: {
      id: 2,
      name: 'Mini Air Cooler — Portable',
      price: 899,
      comparePrice: 1999,
      image: 'assets/product 2/Mini_air_cooler_202604202034.png',
      images: [
        'assets/product 2/Mini_air_cooler_202604202034.png',
        'assets/product 2/A_small_air_202604202034.png',
        'assets/product 2/product_photography_of_202604211543.png'
      ]
    }
  };

  /* ========== BUNDLE ========== */
  const BUNDLE = {
    name: 'Cool Neck + Mini Air Cooler Bundle',
    price: 1299,
    comparePrice: 1849,
    image: 'assets/product 1/A_professional_product_202604171306.png'
  };

  /* ========== STATE ========== */
  let cart = [];
  let quantities = { 1: 1, 2: 1 };
  let selectedPayment = null;
  let checkoutStep = 1;
  let appliedCouponDiscount = 0;
  let appliedCouponCode = '';

  /* ========== HELPERS ========== */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const money = (n) => '₹' + n.toLocaleString('en-IN');

  /* ========== SUPABASE ========== */
  let supabase = null;

  async function initSupabase() {
    if (typeof window.supabase !== 'undefined') return;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.onload = () => {
        if (window.supabase) {
          supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          console.log('✅ Supabase connected');
        }
        resolve();
      };
      script.onerror = () => { console.warn('⚠️ Supabase CDN failed'); resolve(); };
      document.head.appendChild(script);
    });
  }

  /* ========== ANALYTICS TRACKING ========== */
  async function trackEvent(eventType, data = {}) {
    if (!supabase) return;
    try {
      const eventData = {
        event_type: eventType,
        product_id: data.productId || null,
        product_name: data.productName || null,
        quantity: data.quantity || 1,
        amount: data.amount || 0,
        page_url: window.location.href,
        referrer: document.referrer || 'direct',
        user_agent: navigator.userAgent.substring(0, 200),
        session_id: sessionStorage.getItem('session_id') || generateSessionId()
      };
      await supabase.from(ANALYTICS_TABLE).insert(eventData);
    } catch (e) { console.warn('Analytics error:', e); }
  }

  function generateSessionId() {
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('session_id', id);
    return id;
  }

  function initAnalytics() {
    trackEvent('page_view', { page: 'home' });
    
    document.querySelectorAll('.product-card__add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = btn.dataset.product;
        const product = PRODUCTS[pid];
        trackEvent('add_to_cart', { productId: pid, productName: product.name, quantity: quantities[pid], amount: product.price * quantities[pid] });
      });
    });

    const checkoutBtn = document.getElementById('cart-checkout-btn');
    if (checkoutBtn) {
      const originalClick = checkoutBtn.onclick;
      checkoutBtn.addEventListener('click', () => {
        trackEvent('checkout_start', { amount: getCartTotal(), items: getCartTotalQty() });
      });
    }
  }

  function generateSessionId() {
    const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('session_id', id);
    return id;
  }

  /* ========== HEADER ========== */
  function initHeader() {
    const header = $('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    const toggle = $('#menu-toggle');
    const nav = $('#main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        nav.classList.toggle('active');
      });
      $$('.header__nav-link', nav).forEach(link => {
        link.addEventListener('click', () => {
          toggle.classList.remove('active');
          nav.classList.remove('active');
        });
      });
    }
  }

  /* ========== GALLERY ========== */
  function initGallery() {
    $$('.product-card__thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const productId = parseInt(thumb.dataset.product);
        const src = thumb.dataset.src;
        const mainImg = $(`#main-product-${productId}-image`);
        if (mainImg) mainImg.src = src;

        $$(`.product-card__thumb[data-product="${productId}"]`).forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  /* ========== QUANTITY ========== */
  function initQuantity() {
    $$('.product-card__qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = parseInt(btn.dataset.product);
        const action = btn.dataset.action;
        if (action === 'minus' && quantities[productId] > 1) quantities[productId]--;
        if (action === 'plus' && quantities[productId] < 10) quantities[productId]++;
        const display = $(`#qty-value-${productId}`);
        if (display) display.textContent = quantities[productId];
      });
    });
  }

  /* ========== CART ========== */
  function addToCart(productId, isBundle = false, bundleType = null) {
    if (isBundle) {
      const existing = cart.find(i => i.isBundle);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({ ...BUNDLE, quantity: 1, isBundle: true });
      }
      showToast('Bundle added to cart! 🎉');
    } else {
      const product = PRODUCTS[productId];
      const existing = cart.find(i => i.id === productId && !i.isBundle);
      if (existing) {
        existing.quantity += quantities[productId];
      } else {
        cart.push({ ...product, quantity: quantities[productId] });
      }
      showToast(`${product.name} added to cart! 🎉`);
    }
    updateCartUI();

    if (typeof fbq !== 'undefined') {
      fbq('track', 'AddToCart', {
        content_name: isBundle ? BUNDLE.name : PRODUCTS[productId].name,
        value: isBundle ? BUNDLE.price : PRODUCTS[productId].price * quantities[productId],
        currency: 'INR'
      });
    }
  }

  function updateCartUI() {
    const badge = $('.header__cart-count');
    const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
    if (badge) {
      badge.textContent = totalItems;
      badge.classList.toggle('has-items', totalItems > 0);
    }

    const itemsEl = $('.cart-drawer__items');
    if (!itemsEl) return;

    if (cart.length === 0) {
      itemsEl.innerHTML = '<div class="cart-drawer__empty"><div class="cart-drawer__empty-icon">🛒</div><p class="cart-drawer__empty-text">Your cart is empty</p></div>';
    } else {
      itemsEl.innerHTML = cart.map((item, idx) => `
        <div class="cart-item">
          <div class="cart-item__image"><img src="${item.image}" alt="${item.name}"></div>
          <div class="cart-item__info">
            <div class="cart-item__name">${item.name}</div>
            <div class="cart-item__price">${money(item.price * item.quantity)}</div>
            <div class="cart-item__qty-controls">
              <button class="cart-item__qty-btn" data-action="minus" data-idx="${idx}">−</button>
              <span class="cart-item__qty-value">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="plus" data-idx="${idx}">+</button>
            </div>
          </div>
          <button class="cart-item__remove" data-action="remove" data-idx="${idx}">✕</button>
        </div>`).join('');

      itemsEl.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          const action = btn.dataset.action;
          if (action === 'minus') { if (cart[idx].quantity > 1) cart[idx].quantity--; else cart.splice(idx, 1); }
          else if (action === 'plus') { if (cart[idx].quantity < 10) cart[idx].quantity++; }
          else if (action === 'remove') { cart.splice(idx, 1); }
          updateCartUI();
        });
      });
    }

    const subtotal = $('.cart-drawer__subtotal-value');
    if (subtotal) subtotal.textContent = money(getCartTotal());
  }

  function getCartTotal() {
    return cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  }

  function getCartTotalQty() {
    return cart.reduce((sum, i) => sum + i.quantity, 0);
  }

  /* ========== CART DRAWER ========== */
  function initCartDrawer() {
    const cartBtn = $('#cart-toggle');
    const overlay = $('.cart-overlay');
    const drawer = $('.cart-drawer');
    const closeBtn = $('.cart-drawer__close');

    function open() {
      overlay?.classList.add('active');
      drawer?.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function close() {
      overlay?.classList.remove('active');
      drawer?.classList.remove('active');
      document.body.style.overflow = '';
    }

    cartBtn?.addEventListener('click', open);
    overlay?.addEventListener('click', close);
    closeBtn?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    window.CoolNeck = { openCart: open, closeCart: close };
  }

  /* ========== PRODUCT ACTIONS ========== */
  function initProductActions() {
    $$('.product-card__add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = parseInt(btn.dataset.product);
        addToCart(productId);
      });
    });

    $$('.product-card__buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const productId = parseInt(btn.dataset.product);
        addToCart(productId);
        openCheckout();
      });
    });

    $('.bundle-offer__btn')?.addEventListener('click', function() {
      addToCart(null, true, 'both');
    });
  }

  /* ========== CHECKOUT ========== */
  function openCheckout() {
    if (cart.length === 0) { showToast('Your cart is empty', 'error'); return; }
    window.CoolNeck?.closeCart();
    checkoutStep = 1;
    selectedPayment = null;
    appliedCouponDiscount = 0;
    appliedCouponCode = '';
    const couponInput = $('#coupon-input');
    const msg = $('#coupon-message');
    if(couponInput) couponInput.value = '';
    if(msg) msg.textContent = '';
    updateCheckoutUI();
    const overlay = $('#checkout-overlay');
    overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeCheckout() {
    const overlay = $('#checkout-overlay');
    overlay?.classList.remove('active');
    document.body.style.overflow = '';
  }

  function updateCheckoutUI() {
    $$('.modal__step').forEach(s => s.classList.remove('active'));
    const step = $(`#checkout-step-${checkoutStep}`);
    step?.classList.add('active');

    const summary = $('#order-summary');
    if (summary) {
      const baseTotal = getCartTotal();
      const shipping = baseTotal >= 499 ? 0 : 50;
      let finalTotal = baseTotal + shipping;
      let extraDiscountHtml = '';
      
      if (appliedCouponDiscount > 0) {
        const discountAmount = Math.floor(baseTotal * (appliedCouponDiscount / 100));
        finalTotal -= discountAmount;
        extraDiscountHtml = `<div class="order-summary__row order-summary__row--discount" style="color:var(--clr-success)"><span>Coupon (${appliedCouponCode})</span><span>-${money(discountAmount)}</span></div>`;
      }

      const itemsList = cart.map(item => `<div class="order-summary__row"><span>${item.name} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></div>`).join('');

      summary.innerHTML = `
        ${itemsList}
        <div class="order-summary__row order-summary__row--discount"><span>Discount</span><span>-${money(baseTotal > 0 ? cart.reduce((s,i) => s + (i.comparePrice - i.price) * i.quantity, 0) : 0)}</span></div>
        ${extraDiscountHtml}
        <div class="order-summary__row"><span>Shipping</span><span style="color:${shipping === 0 ? 'var(--clr-success)' : 'inherit'}">${shipping === 0 ? 'FREE' : money(shipping)}</span></div>
        <div class="order-summary__row"><span>Total</span><span>${money(finalTotal)}</span></div>`;
    }

    $$('.payment-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.method === selectedPayment);
    });
  }

  function initCheckout() {
    $('#checkout-close')?.addEventListener('click', closeCheckout);
    $('#checkout-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCheckout(); });

    $('#checkout-next')?.addEventListener('click', () => {
      if (!validateForm()) return;
      checkoutStep = 2;
      updateCheckoutUI();
      
      const baseTotal = getCartTotal();
      const shipping = baseTotal >= 499 ? 0 : 50;
      let finalTotal = baseTotal + shipping;
      if (appliedCouponDiscount > 0) finalTotal -= Math.floor(baseTotal * (appliedCouponDiscount / 100));
      
      const upiAmt = $('#upi-amount');
      const codAmt = $('#cod-amount');
      if (upiAmt) upiAmt.textContent = money(finalTotal);
      if (codAmt) codAmt.textContent = money(finalTotal);
      
      const s1 = $('#order-summary');
      const s2 = $('#order-summary-2');
      if (s1 && s2) s2.innerHTML = s1.innerHTML;
    });

    $('#checkout-back')?.addEventListener('click', () => {
      checkoutStep = 1;
      updateCheckoutUI();
    });

    $$('.payment-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedPayment = card.dataset.method;
        updateCheckoutUI();
        const upiSection = $('.upi-section');
        const codSection = $('.cod-section');
        if (upiSection) upiSection.style.display = selectedPayment === 'upi' ? 'block' : 'none';
        if (codSection) codSection.style.display = selectedPayment === 'cod' ? 'block' : 'none';
      });
    });

    $('#place-order-btn')?.addEventListener('click', placeOrder);
    $('#cart-checkout-btn')?.addEventListener('click', openCheckout);

    $('#apply-coupon-btn')?.addEventListener('click', () => {
      const input = $('#coupon-input');
      const msg = $('#coupon-message');
      if (!input || !msg) return;
      const code = input.value.trim().toUpperCase();
      
      if (code === 'FIRST25') {
        appliedCouponDiscount = 25;
        appliedCouponCode = code;
        msg.textContent = 'Coupon applied! 25% discount.';
        msg.style.color = 'var(--clr-success)';
        updateCheckoutUI();
        const summary = $('#order-summary');
        if(summary) {
          summary.classList.remove('coupon-success-anim');
          void summary.offsetWidth;
          summary.classList.add('coupon-success-anim');
        }
      } else if (code === 'SAVE50') {
        appliedCouponDiscount = 15;
        appliedCouponCode = 'SAVE50';
        msg.textContent = 'Coupon applied! ₹50 off.';
        msg.style.color = 'var(--clr-success)';
        updateCheckoutUI();
      } else if (code) {
        msg.textContent = 'Invalid coupon code.';
        msg.style.color = 'red';
        appliedCouponDiscount = 0;
        appliedCouponCode = '';
      } else {
        msg.textContent = '';
        appliedCouponDiscount = 0;
        appliedCouponCode = '';
      }
      updateCheckoutUI();
    });

    $('#success-close-btn')?.addEventListener('click', () => {
      closeCheckout();
      cart = [];
      quantities = { 1: 1, 2: 1 };
      $$('.product-card__qty-value').forEach(el => {
        const id = el.id.replace('qty-value-', '');
        el.textContent = quantities[id];
      });
      updateCartUI();
    });
  }

  function validateForm() {
    let valid = true;
    const fields = ['customer-name', 'customer-phone', 'customer-email', 'customer-address', 'customer-pincode'];
    fields.forEach(id => {
      const input = $(`#${id}`);
      if (!input) return;
      const val = input.value.trim();
      if (!val) { input.classList.add('error'); valid = false; }
      else { input.classList.remove('error'); }
    });

    const phone = $('#customer-phone');
    if (phone && phone.value.trim() && !/^[6-9]\d{9}$/.test(phone.value.trim())) {
      phone.classList.add('error');
      valid = false;
    }

    const email = $('#customer-email');
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.classList.add('error');
      valid = false;
    }

    const pincode = $('#customer-pincode');
    if (pincode && pincode.value.trim() && !/^\d{6}$/.test(pincode.value.trim())) {
      pincode.classList.add('error');
      valid = false;
    }

    if (!valid) showToast('Please fill all fields correctly', 'error');
    return valid;
  }

  async function placeOrder() {
    if (!selectedPayment) { showToast('Please select a payment method', 'error'); return; }

    const btn = $('#place-order-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Placing Order...';
    btn.disabled = true;

    const baseTotal = getCartTotal();
    const shipping = baseTotal >= 499 ? 0 : 50;
    let finalTotal = baseTotal + shipping;
    if (appliedCouponDiscount > 0) finalTotal -= Math.floor(baseTotal * (appliedCouponDiscount / 100));

    const orderData = {
      customer_name: $('#customer-name').value.trim(),
      customer_phone: $('#customer-phone').value.trim(),
      customer_email: $('#customer-email').value.trim(),
      customer_address: $('#customer-address').value.trim(),
      customer_pincode: $('#customer-pincode').value.trim(),
      customer_city: $('#customer-city')?.value.trim() || '',
      payment_method: selectedPayment,
      quantity: getCartTotalQty(),
      unit_price: Math.floor(finalTotal / getCartTotalQty()),
      total_amount: finalTotal,
      product_name: cart.length > 1 ? 'Multiple Products' : cart[0]?.name || 'Order'
    };

    try {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Order failed');
      }

      console.log('✅ Order placed:', result);

      if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', {
          value: finalTotal,
          currency: 'INR',
          content_name: orderData.product_name,
          num_items: getCartTotalQty()
        });
      }

      checkoutStep = 3;
      updateCheckoutUI();
      const orderIdEl = $('#success-order-id');
      if (orderIdEl) orderIdEl.textContent = result.order_id;

      const paymentNote = $('#success-payment-note');
      if (paymentNote) {
        paymentNote.innerHTML = selectedPayment === 'upi'
          ? '📧 A verification email sent to <strong>' + orderData.customer_email + '</strong>. Please complete UPI payment.'
          : '✅ Your Cash on Delivery order is confirmed! Pay ₹' + finalTotal.toLocaleString('en-IN') + ' at delivery.';
      }

      showToast('Order placed successfully! 🎉');

    } catch (err) {
      console.error('Order error:', err);
      showToast('Something went wrong: ' + err.message, 'error');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  /* ========== FAQ ========== */
  function initFAQ() {
    $$('.faq-item').forEach(item => {
      const q = item.querySelector('.faq-question');
      q?.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        $$('.faq-item').forEach(i => i.classList.remove('active'));
        if (!isActive) item.classList.add('active');
      });
    });
  }

  /* ========== SCROLL REVEAL ========== */
  function initScrollReveal() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('active'); observer.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    $$('.reveal').forEach(el => observer.observe(el));
  }

  /* ========== SMOOTH SCROLL ========== */
  function initSmoothScroll() {
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const target = $(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ========== TOAST ========== */
  function showToast(msg, type = 'success') {
    let toast = $('#toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      toast.id = 'toast';
      document.body.appendChild(toast);
    }
    const icon = type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> ${msg}`;
    toast.classList.add('active');
    setTimeout(() => toast.classList.remove('active'), 3000);
  }

  /* ========== FAKE PURCHASE NOTIFICATIONS ========== */
  const fakePurchases = [
    { name: 'Priya from Mumbai', product: 'Cool Neck', qty: 1 },
    { name: 'Amit from Delhi', product: 'Mini Air Cooler', qty: 2 },
    { name: 'Sneha from Bangalore', product: 'Cool Neck Bundle', qty: 1 },
    { name: 'Rahul from Hyderabad', product: 'Cool Neck', qty: 1 },
    { name: 'Anjali from Chennai', product: 'Mini Air Cooler', qty: 1 },
    { name: 'Vikram from Pune', product: 'Cool Neck', qty: 2 },
    { name: 'Meera from Kolkata', product: 'Cool Neck Bundle', qty: 1 },
    { name: 'Arjun from Gurgaon', product: 'Mini Air Cooler', qty: 1 },
    { name: 'Divya from Mumbai', product: 'Cool Neck', qty: 1 },
    { name: 'Karthik from Chennai', product: 'Cool Neck', qty: 2 },
    { name: 'Neha from Bangalore', product: 'Mini Air Cooler', qty: 1 },
    { name: 'Raj from Delhi', product: 'Cool Neck Bundle', qty: 1 },
    { name: 'Sonia from Pune', product: 'Cool Neck', qty: 1 },
    { name: ' Aman from Noida', product: 'Mini Air Cooler', qty: 1 },
    { name: 'Pooja from Mumbai', product: 'Cool Neck', qty: 2 }
  ];

  const customerAvatars = ['P', 'A', 'S', 'R', 'M', 'K', 'D', 'V', 'N', 'R', 'P', 'A', 'S', 'A', 'P'];
  let purchaseIndex = 0;
  let purchaseTimer = null;

  function showPurchaseNotification() {
    const popup = $('#purchase-popup');
    const textEl = $('#purchase-popup-text');
    const closeBtn = $('#purchase-popup-close');
    if (!popup || !textEl) return;

    const purchase = fakePurchases[purchaseIndex % fakePurchases.length];
    const avatar = customerAvatars[purchaseIndex % customerAvatars.length];
    
    const iconEl = popup.querySelector('.purchase-popup__icon');
    if (iconEl) iconEl.textContent = avatar;

    textEl.innerHTML = `<strong>${purchase.name}</strong> just bought ${purchase.qty}x ${purchase.product}`;
    
    popup.classList.add('active');
    
    closeBtn?.addEventListener('click', () => {
      popup.classList.remove('active');
    });

    setTimeout(() => {
      popup.classList.remove('active');
    }, 5000);

    purchaseIndex++;
  }

  function startPurchaseNotifications() {
    showPurchaseNotification();
    
    const delay = Math.random() * 8000 + 5000;
    purchaseTimer = setInterval(() => {
      showPurchaseNotification();
    }, delay);
  }

  function stopPurchaseNotifications() {
    if (purchaseTimer) {
      clearInterval(purchaseTimer);
      purchaseTimer = null;
    }
  }

  /* ========== COUNTDOWN TIMER ========== */
  function initCountdownTimer() {
    let totalSeconds = 4 * 60 * 60 + 32 * 60 + 18;
    
    const updateTimer = () => {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      const h1 = document.getElementById('hours');
      const h2 = document.getElementById('hours-2');
      const m1 = document.getElementById('minutes');
      const m2 = document.getElementById('minutes-2');
      const s1 = document.getElementById('seconds');
      const s2 = document.getElementById('seconds-2');
      
      if (h1) h1.textContent = hours.toString().padStart(2, '0');
      if (h2) h2.textContent = hours.toString().padStart(2, '0');
      if (m1) m1.textContent = minutes.toString().padStart(2, '0');
      if (m2) m2.textContent = minutes.toString().padStart(2, '0');
      if (s1) s1.textContent = seconds.toString().padStart(2, '0');
      if (s2) s2.textContent = seconds.toString().padStart(2, '0');
      
      if (totalSeconds > 0) totalSeconds--;
    };
    
    updateTimer();
    setInterval(updateTimer, 1000);
  }

  /* ========== LIVE VISITORS & DELIVERY DATE ========== */
  function initLiveVisitors() {
    const visitorsEl = document.getElementById('live-visitors');
    const stockEl = document.getElementById('stock-left');
    const stockCount = document.getElementById('stock-count');
    const stockCount2 = document.getElementById('stock-count-2');
    const deliveryEl = document.getElementById('delivery-date');
    
    if (visitorsEl) {
      let visitors = 27;
      setInterval(() => {
        visitors = Math.floor(Math.random() * 15) + 20;
        visitorsEl.textContent = visitors;
      }, 8000);
    }
    
    if (stockEl && stockCount && stockCount2) {
      let stock = parseInt(stockCount.textContent);
      setInterval(() => {
        if (Math.random() > 0.7 && stock > 3) {
          stock--;
          stockEl.textContent = stock;
          stockCount.textContent = stock;
          stockCount2.textContent = stock - 2;
        }
      }, 25000);
    }
    
    if (deliveryEl) {
      const today = new Date();
      const delivery = new Date(today);
      delivery.setDate(delivery.getDate() + 3);
      const options = { weekday: 'short', month: 'short', day: 'numeric' };
      deliveryEl.textContent = delivery.toLocaleDateString('en-IN', options);
    }
  }

  /* ========== INIT ========== */
  async function init() {
    await initSupabase();
    initHeader();
    initGallery();
    initQuantity();
    initProductActions();
    initCartDrawer();
    initCheckout();
    initFAQ();
    initScrollReveal();
    initSmoothScroll();
    initCountdownTimer();
    initLiveVisitors();
    updateCartUI();
    startPurchaseNotifications();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();