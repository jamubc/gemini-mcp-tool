<template>
  <div class="funding-effects">
    <!-- Add subtle animations to funding cards -->
  </div>
</template>

<script setup>
import { onMounted } from 'vue'

onMounted(() => {
  // Add intersection observer for scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
      }
    })
  }, { threshold: 0.1 })
  
  // Observe all cards
  const cards = document.querySelectorAll('.funding-card, .contribute-card')
  cards.forEach(card => observer.observe(card))
  
  // Add hover effects to cards
  cards.forEach(card => {
    card.addEventListener('mouseenter', (e) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      card.style.setProperty('--card-mouse-x', `${x}px`)
      card.style.setProperty('--card-mouse-y', `${y}px`)
    })
    
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      
      card.style.setProperty('--card-mouse-x', `${x}px`)
      card.style.setProperty('--card-mouse-y', `${y}px`)
    })
  })
})
</script>

<style>
/* Global styles for funding page elements */
.funding-card {
  --card-mouse-x: 50%;
  --card-mouse-y: 50%;
  position: relative;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 24px;
  margin: 16px 0;
  overflow: hidden;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease-out;
}

.funding-card.visible {
  opacity: 1;
  transform: translateY(0);
}

.funding-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    400px circle at var(--card-mouse-x) var(--card-mouse-y),
    rgba(255, 140, 0, 0.06),
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.funding-card:hover::before {
  opacity: 1;
}

.funding-card:hover {
  border-color: rgba(255, 140, 0, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(255, 140, 0, 0.1);
}

/* Import support button styles from SupportSection */
.support-options {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.support-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  white-space: nowrap;
}

.support-button--primary {
  background: var(--vp-c-brand);
  color: var(--vp-c-white);
  border: 1px solid var(--vp-c-brand);
}

.support-button--primary:hover {
  background: var(--vp-c-brand-dark);
  transform: translateY(-2px);
  box-shadow: 
    0 4px 12px rgba(66, 184, 131, 0.3),
    0 0 20px rgba(218, 119, 86, 0.4),
    0 0 30px rgba(71, 150, 227, 0.3),
    0 0 40px rgba(255, 140, 0, 0.2);
  animation: glow 2s ease-in-out infinite;
}

@keyframes glow {
  0%, 100% { 
    box-shadow: 
      0 4px 12px rgba(66, 184, 131, 0.3),
      0 0 20px rgba(218, 119, 86, 0.4),
      0 0 30px rgba(71, 150, 227, 0.3),
      0 0 40px rgba(255, 140, 0, 0.2);
  }
  50% { 
    box-shadow: 
      0 4px 16px rgba(66, 184, 131, 0.4),
      0 0 25px rgba(218, 119, 86, 0.5),
      0 0 35px rgba(71, 150, 227, 0.4),
      0 0 50px rgba(255, 140, 0, 0.3);
  }
}

.support-button--secondary {
  background: transparent;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.support-button--secondary:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.support-icon {
  width: 18px;
  height: 18px;
  font-size: 18px;
}

/* Contribute cards */
.contribute-card {
  --card-mouse-x: 50%;
  --card-mouse-y: 50%;
  background: var(--vp-c-bg-soft);
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  transition: all 0.3s ease;
  opacity: 0;
  transform: translateY(20px);
}

.contribute-card.visible {
  opacity: 1;
  transform: translateY(0);
}

.contribute-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    300px circle at var(--card-mouse-x) var(--card-mouse-y),
    rgba(255, 140, 0, 0.08),
    transparent 50%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.contribute-card:hover::before {
  opacity: 1;
}

.contribute-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 140, 0, 0.3);
  box-shadow: 0 12px 32px rgba(255, 140, 0, 0.1);
}

.contribute-card .icon {
  font-size: 48px;
  margin-bottom: 16px;
  display: block;
  transition: transform 0.3s ease;
}

.contribute-card:hover .icon {
  transform: scale(1.1) rotate(5deg);
}

/* Progress indicators */
.progress-section {
  margin: 48px 0;
}

.progress-bar {
  height: 8px;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ff6b35 0%, #ff8c00 100%);
  border-radius: 4px;
  animation: progress 2s ease-out;
  position: relative;
  overflow: hidden;
}

.progress-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.3) 50%,
    transparent 100%
  );
  animation: shimmer-progress 2s ease-in-out infinite;
}

@keyframes progress {
  from { width: 0; }
}

@keyframes shimmer-progress {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Light mode adjustments */
html:not(.dark) .funding-card::before {
  background: radial-gradient(
    400px circle at var(--card-mouse-x) var(--card-mouse-y),
    rgba(66, 139, 202, 0.04),
    transparent 50%
  );
}

html:not(.dark) .funding-card:hover {
  border-color: rgba(66, 139, 202, 0.3);
  box-shadow: 0 8px 24px rgba(66, 139, 202, 0.08);
}

html:not(.dark) .contribute-card::before {
  background: radial-gradient(
    300px circle at var(--card-mouse-x) var(--card-mouse-y),
    rgba(66, 139, 202, 0.06),
    transparent 50%
  );
}

html:not(.dark) .contribute-card:hover {
  border-color: rgba(66, 139, 202, 0.3);
  box-shadow: 0 12px 32px rgba(66, 139, 202, 0.08);
}

html:not(.dark) .support-button-secondary:hover {
  border-color: rgba(66, 139, 202, 0.6);
  box-shadow: 
    0 0 30px rgba(66, 139, 202, 0.1),
    inset 0 0 20px rgba(66, 139, 202, 0.03);
}

html:not(.dark) .progress-fill {
  background: linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%);
}

/* Stagger animations */
.funding-card:nth-child(1) { transition-delay: 0.1s; }
.funding-card:nth-child(2) { transition-delay: 0.2s; }
.funding-card:nth-child(3) { transition-delay: 0.3s; }

.contribute-card:nth-child(1) { transition-delay: 0.1s; }
.contribute-card:nth-child(2) { transition-delay: 0.2s; }
.contribute-card:nth-child(3) { transition-delay: 0.3s; }
.contribute-card:nth-child(4) { transition-delay: 0.4s; }
</style>