<template>
  <div class="funding-layout">
    <transition name="fade">
      <button 
        v-if="showReturnButton"
        @click="goBack"
        class="return-button"
        title="Return to previous page"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M5 12L12 19M5 12L12 5"/>
        </svg>
        <span>Return</span>
      </button>
    </transition>
    
    <FundingHero />
    
    <div 
      class="funding-content"
      @mouseenter="handleMouseEnter"
      @mousemove="handleMouseMove"
      @mouseleave="handleMouseLeave"
      ref="contentRef"
    >
      <Content />
    </div>
    
    <FundingEffects />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Content, useRouter } from 'vitepress'
import FundingHero from './components/FundingHero.vue'
import FundingEffects from './components/FundingEffects.vue'

const contentRef = ref(null)
const showReturnButton = ref(false)
const router = useRouter()

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    router.go('/gemini-mcp-tool/')
  }
}

// Show return button after scroll
onMounted(() => {
  const handleScroll = () => {
    showReturnButton.value = window.scrollY > 100
  }
  
  window.addEventListener('scroll', handleScroll)
  
  // Add page transition class
  document.body.classList.add('page-transition-active')
  setTimeout(() => {
    document.body.classList.remove('page-transition-active')
  }, 600)
  
  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })
})

const handleMouseEnter = (e) => {
  if (!contentRef.value) return
  
  const rect = contentRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  contentRef.value.style.setProperty('--content-mouse-x', `${x}px`)
  contentRef.value.style.setProperty('--content-mouse-y', `${y}px`)
  contentRef.value.classList.add('mouse-over')
}

const handleMouseMove = (e) => {
  if (!contentRef.value) return
  
  const rect = contentRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  contentRef.value.style.setProperty('--content-mouse-x', `${x}px`)
  contentRef.value.style.setProperty('--content-mouse-y', `${y}px`)
}

const handleMouseLeave = () => {
  if (!contentRef.value) return
  contentRef.value.classList.remove('mouse-over')
}
</script>

<style scoped>
.funding-layout {
  min-height: 100vh;
  background: var(--vp-c-bg);
  animation: pageEnter 0.6s ease-out;
}

@keyframes pageEnter {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.return-button {
  position: fixed;
  bottom: 32px;
  right: 32px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: transparent;
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  z-index: 100;
}

.return-button:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand);
  transform: translateY(-2px);
}

.return-button svg {
  transition: transform 0.3s ease;
}

.return-button:hover svg {
  transform: translateX(-2px);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.funding-content {
  --content-mouse-x: 50%;
  --content-mouse-y: 50%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 48px 24px 96px;
  position: relative;
}

.funding-content::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100px;
  right: -100px;
  bottom: 0;
  background: radial-gradient(
    1000px circle at var(--content-mouse-x) var(--content-mouse-y),
    rgba(255, 140, 0, 0.03),
    transparent 65%
  );
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.6s ease;
}

.funding-content.mouse-over::before {
  opacity: 1;
}

/* Light mode adjustments */
html:not(.dark) .funding-content::before {
  background: radial-gradient(
    1000px circle at var(--content-mouse-x) var(--content-mouse-y),
    rgba(66, 139, 202, 0.02),
    transparent 65%
  );
}

@media (max-width: 768px) {
  .funding-content {
    padding: 32px 20px 64px;
  }
}
</style>

<style>
/* Global styles for funding content */
.funding-layout h1 {
  display: none; /* Hide the markdown title since we have the hero */
}

.funding-layout h2 {
  font-size: 36px;
  font-weight: 700;
  margin: 64px 0 32px;
  padding: 0 24px;
  text-align: center;
  background: linear-gradient(135deg, var(--vp-c-text-1) 0%, var(--vp-c-brand) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  line-height: 1.3;
}

.funding-layout h3 {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 16px;
}

.funding-layout p {
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.funding-layout ul {
  margin: 16px 0;
  padding-left: 24px;
}

.funding-layout li {
  margin: 8px 0;
  color: var(--vp-c-text-2);
}

.funding-layout strong {
  color: var(--vp-c-text-1);
}
</style>