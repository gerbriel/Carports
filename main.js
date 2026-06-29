// Mobile menu toggle
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

// Close mobile menu on link click
mobileMenu.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => mobileMenu.classList.remove('open'));
});

// Smooth scroll offset for fixed nav
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 80;
      window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
    }
  });
});

// Nav shadow on scroll
const nav = document.querySelector('.nav-wrapper');
window.addEventListener('scroll', () => {
  nav.style.boxShadow = window.scrollY > 20 ? '0 2px 24px rgba(0,0,0,0.3)' : 'none';
});

// Fade-in on scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.service-card, .pillar, .step, .faq-item, .info-card').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(24px)';
  el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  observer.observe(el);
});

// Contact form
function handleSubmit(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  setTimeout(() => {
    document.getElementById('form-success').classList.remove('hidden');
    btn.textContent = 'Message Sent ✓';
    btn.style.background = '#22c55e';
    btn.style.borderColor = '#22c55e';
  }, 1000);
}
