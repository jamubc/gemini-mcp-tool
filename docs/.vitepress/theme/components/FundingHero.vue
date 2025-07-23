<template>
  <div 
    class="funding-hero"
    @mouseenter="handleMouseEnter"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
    ref="heroRef"
  >
    <div class="hero-background">
      <div class="hero-glow"></div>
      <div class="hero-particles"></div>
    </div>
    
    <div class="hero-content">
      <h1 class="hero-title">
        <span class="title-main">Support Development</span>
        <span class="title-sub">of Gemini MCP Tool</span>
      </h1>
      
      <p class="hero-description">
        Every contribution helps maintain, improve and expand this project
      </p>
      
      <div class="hero-actions">
        <a 
          href="https://github.com/sponsors/jamubc" 
          target="_blank"
          rel="noopener"
          class="action-button action-primary"
        >
          <svg class="button-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Sponsor on GitHub
        </a>

        <a 
          href="https://github.com/jamubc/gemini-mcp-tool" 
          target="_blank"
          rel="noopener"
          class="action-button action-primary"
        >
          <svg class="button-icon" viewBox="0 0 22 22" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          Star on GitHub
        </a>
        
        <a 
          href="https://ko-fi.com/jamubc" 
          target="_blank"
          rel="noopener"
          class="action-button action-secondary"
        >
          <span class="button-icon">☕</span>
          Buy me a coffee
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const heroRef = ref(null)

const handleMouseEnter = (e) => {
  if (!heroRef.value) return
  
  const rect = heroRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  heroRef.value.style.setProperty('--mouse-x', `${x}px`)
  heroRef.value.style.setProperty('--mouse-y', `${y}px`)
  heroRef.value.classList.add('mouse-over')
}

const handleMouseMove = (e) => {
  if (!heroRef.value) return
  
  const rect = heroRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  heroRef.value.style.setProperty('--mouse-x', `${x}px`)
  heroRef.value.style.setProperty('--mouse-y', `${y}px`)
}

const handleMouseLeave = () => {
  if (!heroRef.value) return
  heroRef.value.classList.remove('mouse-over')
}

// Create floating particles
onMounted(() => {
  if (!heroRef.value) return
  
  const particlesContainer = heroRef.value.querySelector('.hero-particles')
  const particleCount = 20
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div')
    particle.className = 'particle'
    particle.style.setProperty('--delay', `${Math.random() * 10}s`)
    particle.style.setProperty('--duration', `${15 + Math.random() * 20}s`)
    particle.style.left = `${Math.random() * 100}%`
    particle.style.animationDelay = `${Math.random() * 10}s`
    particlesContainer.appendChild(particle)
  }
})
</script>

<style scoped>
.funding-hero {
  --mouse-x: 50%;
  --mouse-y: 50%;
  position: relative;
  overflow: hidden;
  padding: 80px 24px;
  margin: -32px -24px 48px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
}

.hero-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.hero-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    800px circle at var(--mouse-x) var(--mouse-y),
    rgba(255, 140, 0, 0.08),
    rgba(255, 107, 53, 0.04) 40%,
    transparent 65%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.funding-hero.mouse-over .hero-glow {
  opacity: 1;
}

.hero-particles {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  background: rgba(255, 140, 0, 0.6);
  border-radius: 50%;
  pointer-events: none;
  animation: float var(--duration) ease-in-out infinite;
  animation-delay: var(--delay);
  opacity: 0;
}

@keyframes float {
  0% {
    transform: translateY(100vh) translateX(0);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-100vh) translateX(100px);
    opacity: 0;
  }
}

.hero-content {
  position: relative;
  z-index: 1;
  max-width: 800px;
  margin: 0 auto;
  text-align: center;
}

.hero-title {
  margin: 0 0 24px;
  line-height: 1.2;
}

.title-main {
  display: block;
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, #ff6b35 50%, #ff8c00 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 3s ease-in-out infinite;
  background-size: 200% auto;
}

@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.title-sub {
  display: block;
  font-size: 24px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-top: 8px;
}

.hero-description {
  font-size: 18px;
  color: var(--vp-c-text-2);
  margin: 0 0 32px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.action-primary {
  background: var(--vp-c-brand);
  color: white;
  border: 1px solid var(--vp-c-brand);
}

.action-primary:hover {
  transform: translateY(-2px);
  box-shadow: 
    0 8px 24px rgba(66, 184, 131, 0.3),
    0 0 40px rgba(255, 140, 0, 0.2);
}

.action-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.action-secondary:hover {
  border-color: rgba(255, 140, 0, 0.6);
  transform: translateY(-2px);
  box-shadow: 
    0 0 30px rgba(255, 140, 0, 0.15),
    inset 0 0 20px rgba(255, 140, 0, 0.05);
}

.button-icon {
  width: 20px;
  height: 20px;
  font-size: 20px;
}

/* Light mode adjustments */
html:not(.dark) .hero-glow {
  background: radial-gradient(
    800px circle at var(--mouse-x) var(--mouse-y),
    rgba(66, 139, 202, 0.06),
    rgba(71, 150, 227, 0.03) 40%,
    transparent 65%
  );
}

html:not(.dark) .particle {
  background: rgba(66, 139, 202, 0.4);
}

html:not(.dark) .action-secondary:hover {
  border-color: rgba(66, 139, 202, 0.6);
  box-shadow: 
    0 0 30px rgba(66, 139, 202, 0.1),
    inset 0 0 20px rgba(66, 139, 202, 0.03);
}

/* Mobile responsive */
@media (max-width: 768px) {
  .funding-hero {
    padding: 60px 20px;
  }
  
  .title-main {
    font-size: 36px;
  }
  
  .title-sub {
    font-size: 20px;
  }
  
  .hero-description {
    font-size: 16px;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .action-button {
    width: 100%;
    max-width: 300px;
    justify-content: center;
  }
}
</style>