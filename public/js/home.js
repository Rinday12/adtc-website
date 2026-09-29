/**
 * home.js
 * Mengatur dua fitur halaman Beranda:
 *   1. Hero Slider — auto-play 5s, panah kiri/kanan, dot indicator
 *   2. Scroll-reveal — card fade+slide dari bawah saat masuk viewport
 */

;(function () {
  'use strict'

  // ─── 1. HERO SLIDER ──────────────────────────────────────────────────────────

  const slider    = document.getElementById('hero-slider')
  if (!slider) return

  const slides    = Array.from(slider.querySelectorAll('.hero-slide'))
  const dots      = Array.from(document.querySelectorAll('.hero-dot'))
  const btnPrev   = document.getElementById('slider-prev')
  const btnNext   = document.getElementById('slider-next')
  const totalSlides = slides.length

  if (totalSlides === 0) return

  let current   = 0
  let autoTimer = null

  function goTo(index) {
    // Wrap around
    current = (index + totalSlides) % totalSlides

    slides.forEach((slide, i) => {
      if (i === current) {
        slide.classList.remove('opacity-0', 'pointer-events-none')
        slide.classList.add('opacity-100', 'pointer-events-auto')
        slide.setAttribute('aria-hidden', 'false')
      } else {
        slide.classList.add('opacity-0', 'pointer-events-none')
        slide.classList.remove('opacity-100', 'pointer-events-auto')
        slide.setAttribute('aria-hidden', 'true')
      }
    })

    dots.forEach((dot, i) => {
      if (i === current) {
        dot.classList.add('bg-white', 'w-5')
        dot.classList.remove('bg-white/50', 'w-2.5')
      } else {
        dot.classList.remove('bg-white', 'w-5')
        dot.classList.add('bg-white/50', 'w-2.5')
      }
    })
  }

  function startAuto() {
    stopAuto()
    autoTimer = setInterval(() => goTo(current + 1), 5000)
  }

  function stopAuto() {
    if (autoTimer) clearInterval(autoTimer)
  }

  // Init: show first slide
  goTo(0)
  startAuto()

  if (btnPrev) {
    btnPrev.addEventListener('click', () => { goTo(current - 1); startAuto() })
  }
  if (btnNext) {
    btnNext.addEventListener('click', () => { goTo(current + 1); startAuto() })
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { goTo(i); startAuto() })
  })

  // Pause on hover
  slider.addEventListener('mouseenter', stopAuto)
  slider.addEventListener('mouseleave', startAuto)

  // Touch swipe support
  let touchStartX = 0
  slider.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX }, { passive: true })
  slider.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX
    if (Math.abs(diff) > 50) {
      goTo(diff > 0 ? current + 1 : current - 1)
      startAuto()
    }
  })

  // ─── 2. SCROLL-REVEAL ────────────────────────────────────────────────────────

  // Tambahkan class awal ke semua .reveal-card
  const cards = document.querySelectorAll('.reveal-card')

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('reveal-visible')
          observer.unobserve(entry.target) // animasi hanya sekali
        }
      })
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    })

    cards.forEach(card => observer.observe(card))
  } else {
    // Fallback: langsung tampilkan semua
    cards.forEach(card => card.classList.add('reveal-visible'))
  }

})()
