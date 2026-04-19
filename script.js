/**
 * COOL NECK — Main JavaScript
 * Cart, Checkout, UPI/COD Payment, Supabase Orders
 */
(function () {
  'use strict';

  /* ========== SUPABASE CONFIG ========== */
  const SUPABASE_URL = 'https://rubbrgrzvanrigatpmto.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1YmJyZ3J6dmFucmlnYXRwbXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzUwMjAsImV4cCI6MjA4NTQ1MTAyMH0.yUs7UPqmnMY5m8XIXp8Kmvj8IawbfNyDH3TLI8JVENI';
  const EDGE_FUNCTION_URL = SUPABASE_URL + '/functions/v1/process-order';

  /* ========== PRODUCT DATA ========== */
  const PRODUCT = {
    name: 'Cool Neck — Bladeless Neck Fan',
    price: 849,
    comparePrice: 1499,
    image: 'assets/A_professional_product_202604171306.png',
    images: [
      'assets/A_professional_product_202604171306.png',
      'assets/A_pastel_pink_202604141322.png',
      'assets/Subject__A_professional_202604171320.png',
      'assets/Professional_e-commerce_product_202604140917.png'
    ]
  };

  /* ========== STATE ========== */
  let cart = [];
  let quantity = 1;
  let selectedPayment = null;
  let checkoutStep = 1; // 1 = info, 2 = payment, 3 = success
  let appliedCouponDiscount = 0;
  let appliedCouponCode = '';

  /* ========== HELPERS ========== */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const money = (n) => '₹' + n.toLocaleString('en-IN');

  /* ========== SUPABASE CLIENT ========== */
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
      script.onerror = () => { 
        console.warn('⚠️ Supabase CDN failed'); 
        resolve(); 
      };
      document.head.appendChild(script);
    });
  }

  /* ========== HEADER ========== */
  function initHeader() {
    const header = $('.header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    }, { passive: true });

    const toggle = $('.header__menu-toggle');
    const nav = $('.header__nav');
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
    const mainImg = $('#main-product-image');
    const thumbs = $$('.product-gallery__thumb');
    if (!mainImg || !thumbs.length) return;
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        mainImg.src = thumb.dataset.src;
        thumbs.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
      });
    });
  }

  /* ========== QUANTITY ========== */
  function initQuantity() {
    const minus = $('#qty-minus');
    const plus = $('#qty-plus');
    const display = $('#qty-value');
    if (!minus || !plus || !display) return;
    minus.addEventListener('click', () => { if (quantity > 1) { quantity--; display.textContent = quantity; } });
    plus.addEventListener('click', () => { if (quantity < 10) { quantity++; display.textContent = quantity; } });
  }

  /* ========== CART ========== */
  function addToCart() {
    const existing = cart.find(i => i.name === PRODUCT.name);
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.push({ ...PRODUCT, quantity });
    }
    updateCartUI();
    showToast('Added to cart! 🎉');

    // Meta Pixel Tracking
    if (typeof fbq !== 'undefined') {
      fbq('track', 'AddToCart', {
        content_name: PRODUCT.name,
        value: PRODUCT.price * quantity,
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

      // Bind cart item buttons
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

    // Expose globally
    window.CoolNeck = { openCart: open, closeCart: close };
  }

  /* ========== ADD TO CART / BUY NOW BUTTONS ========== */
  function initProductActions() {
    const addBtn = $('#add-to-cart-btn');
    const buyBtn = $('#buy-now-btn');

    addBtn?.addEventListener('click', () => {
      addToCart();
    });

    buyBtn?.addEventListener('click', () => {
      addToCart();
      openCheckout();
    });
  }

  /* ========== CHECKOUT MODAL ========== */
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

    // Update order summary
    const summary = $('#order-summary');
    if (summary) {
      const baseTotal = getCartTotal();
      const shipping = 0;
      let finalTotal = baseTotal;
      let extraDiscountHtml = '';
      if (appliedCouponDiscount > 0) {
        const discountAmount = Math.floor(baseTotal * (appliedCouponDiscount / 100));
        finalTotal -= discountAmount;
        extraDiscountHtml = `<div class="order-summary__row order-summary__row--discount" style="color:var(--clr-success, green)"><span>Coupon (${appliedCouponCode})</span><span>-${money(discountAmount)}</span></div>`;
      }
      summary.innerHTML = `
        <div class="order-summary__row"><span>Cool Neck × ${getCartTotalQty()}</span><span>${money(baseTotal)}</span></div>
        <div class="order-summary__row order-summary__row--discount"><span>Discount (MRP ₹1,499)</span><span>-${money((1499 - 849) * getCartTotalQty())}</span></div>
        ${extraDiscountHtml}
        <div class="order-summary__row"><span>Shipping</span><span style="color:var(--clr-success)">FREE</span></div>
        <div class="order-summary__row" style="font-weight:700"><span>Total</span><span>${money(finalTotal + shipping)}</span></div>`;
    }

    // Payment selection
    $$('.payment-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.method === selectedPayment);
    });
  }

  function initCheckout() {
    // Close
    $('#checkout-close')?.addEventListener('click', closeCheckout);
    $('#checkout-overlay')?.addEventListener('click', e => { if (e.target === e.currentTarget) closeCheckout(); });

    // Step 1 → Step 2
    $('#checkout-next')?.addEventListener('click', () => {
      if (!validateForm()) return;
      checkoutStep = 2;
      updateCheckoutUI();
      // Update amounts on payment step
      const baseTotal = getCartTotal();
      let finalTotal = baseTotal;
      if (appliedCouponDiscount > 0) {
        finalTotal -= Math.floor(baseTotal * (appliedCouponDiscount / 100));
      }
      const upiAmt = $('#upi-amount');
      const codAmt = $('#cod-amount');
      if (upiAmt) upiAmt.textContent = money(finalTotal);
      if (codAmt) codAmt.textContent = money(finalTotal);
      // Copy order summary to step 2
      const s1 = $('#order-summary');
      const s2 = $('#order-summary-2');
      if (s1 && s2) s2.innerHTML = s1.innerHTML;
    });

    // Back
    $('#checkout-back')?.addEventListener('click', () => {
      checkoutStep = 1;
      updateCheckoutUI();
    });

    // Payment method selection
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

    // Place Order
    $('#place-order-btn')?.addEventListener('click', placeOrder);

    // Checkout from cart drawer
    $('#cart-checkout-btn')?.addEventListener('click', openCheckout);

    // Coupon logic
    $('#apply-coupon-btn')?.addEventListener('click', () => {
      const input = $('#coupon-input');
      const msg = $('#coupon-message');
      if (!input || !msg) return;
      const code = input.value.trim().toUpperCase();
      if (code === 'NEW19') {
        appliedCouponDiscount = 19;
        appliedCouponCode = code;
        msg.textContent = 'Coupon applied! 19% discount.';
        msg.style.color = 'var(--clr-success, green)';
        updateCheckoutUI();
        
        // Trigger cool glow animation
        const summary = $('#order-summary');
        if(summary) {
          summary.classList.remove('coupon-success-anim');
          void summary.offsetWidth; // trigger reflow
          summary.classList.add('coupon-success-anim');
        }
      } else if (code === 'COOL20') {
        appliedCouponDiscount = 20;
        appliedCouponCode = code;
        msg.textContent = 'Coupon applied! 20% discount.';
        msg.style.color = 'var(--clr-success, green)';
        updateCheckoutUI();
        
        // Trigger cool glow animation
        const summary = $('#order-summary');
        if(summary) {
          summary.classList.remove('coupon-success-anim');
          void summary.offsetWidth; // trigger reflow
          summary.classList.add('coupon-success-anim');
        }
      } else if (code === 'NEW25') {
        appliedCouponDiscount = 25;
        appliedCouponCode = code;
        msg.textContent = 'Coupon applied! 25% discount.';
        msg.style.color = 'var(--clr-success, green)';
        updateCheckoutUI();
        
        // Trigger cool glow animation
        const summary = $('#order-summary');
        if(summary) {
          summary.classList.remove('coupon-success-anim');
          void summary.offsetWidth; // trigger reflow
          summary.classList.add('coupon-success-anim');
        }
      } else if (code) {
        msg.textContent = 'Invalid coupon code.';
        msg.style.color = 'red';
        appliedCouponDiscount = 0;
        appliedCouponCode = '';
        updateCheckoutUI();
      } else {
        msg.textContent = '';
        appliedCouponDiscount = 0;
        appliedCouponCode = '';
        updateCheckoutUI();
      }
    });

    // Close success
    $('#success-close-btn')?.addEventListener('click', () => {
      closeCheckout();
      cart = [];
      quantity = 1;
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

    // Phone validation
    const phone = $('#customer-phone');
    if (phone && phone.value.trim() && !/^[6-9]\d{9}$/.test(phone.value.trim())) {
      phone.classList.add('error');
      valid = false;
    }

    // Email validation
    const email = $('#customer-email');
    if (email && email.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.classList.add('error');
      valid = false;
    }

    // Pincode validation
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
    let finalTotal = baseTotal;
    if (appliedCouponDiscount > 0) {
      finalTotal -= Math.floor(baseTotal * (appliedCouponDiscount / 100));
    }

    const orderData = {
      customer_name: $('#customer-name').value.trim(),
      customer_phone: $('#customer-phone').value.trim(),
      customer_email: $('#customer-email').value.trim(),
      customer_address: $('#customer-address').value.trim(),
      customer_pincode: $('#customer-pincode').value.trim(),
      customer_city: $('#customer-city')?.value.trim() || '',
      payment_method: selectedPayment,
      quantity: getCartTotalQty(),
      unit_price: PRODUCT.price,
      total_amount: finalTotal,
      product_name: PRODUCT.name
    };

    try {
      // Send order to Edge Function (handles DB + email + verification)
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

      // Meta Pixel Purchase Tracking
      if (typeof fbq !== 'undefined') {
        fbq('track', 'Purchase', {
          value: getCartTotal(),
          currency: 'INR',
          content_name: PRODUCT.name,
          num_items: getCartTotalQty()
        });
      }

      // Show success
      checkoutStep = 3;
      updateCheckoutUI();
      const orderIdEl = $('#success-order-id');
      if (orderIdEl) orderIdEl.textContent = result.order_id;

      const paymentNote = $('#success-payment-note');
      if (paymentNote) {
        paymentNote.innerHTML = selectedPayment === 'upi'
          ? '📧 A verification email has been sent to <strong>' + orderData.customer_email + '</strong>. Please complete the UPI payment and click the verify link in the email to confirm your order.'
          : '✅ Your Cash on Delivery order is confirmed! Pay ₹' + getCartTotal().toLocaleString('en-IN') + ' at delivery. Confirmation email sent to <strong>' + orderData.customer_email + '</strong>.';
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
    $$('.faq__item').forEach(item => {
      const q = item.querySelector('.faq__question');
      q?.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        $$('.faq__item').forEach(i => i.classList.remove('active'));
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
    updateCartUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
