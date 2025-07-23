<template>
  <div 
    class="support-section"
    @mouseenter="handleSectionMouseEnter"
    @mousemove="handleSectionMouseMove"
    @mouseleave="handleSectionMouseLeave"
    ref="sectionRef"
  >
    <div class="support-content">
      <div class="support-header">
        <div class="support-text">
          <h3 class="support-title">Support Gemini MCP Tool</h3>
          <p class="support-description">
            Does gemini-mcp-tool help you?<br><br>Your support helps maintain & improve this open source project.
          </p>
        </div>
        <a 
          href="/gemini-mcp-tool/funding" 
          class="transparency-link"
          @mouseenter="handleMouseEnter"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
          ref="linkRef"
        >
          <span class="link-text">See how funds are used →</span>
        </a>
      </div>
      
      <div class="support-options">
        <a 
          href="https://github.com/sponsors/jamubc" 
          target="_blank" 
          rel="noopener"
          class="support-button support-button--primary"
          title="Sponsor on GitHub"
        >
          <svg class="support-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span class="button-text">Sponsor on GitHub</span>
        </a>

        <a 
          href="https://ko-fi.com/jamubc" 
          target="_blank" 
          rel="noopener"
          class="support-button support-button--secondary"
          title="Buy me a coffee"
        >
          <span class="support-icon">☕</span>
          <span class="button-text">Buy me a coffee</span>
        </a>
      </div>

      <div class="support-benefits">
        <p class="support-benefit">
          <span class="benefit-icon">✓</span>
          <span>Funds testing & development</span>
        </p>
        <p class="support-benefit">
          <span class="benefit-icon">✓</span>
          <span>Keeps the project actively maintained as CLI tools evolve </span>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const linkRef = ref(null)
const sectionRef = ref(null)

const handleMouseEnter = (e) => {
  if (!linkRef.value) return
  
  const rect = linkRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = (x / rect.width) * 100
  
  linkRef.value.style.setProperty('--mouse-x', `${percentage}%`)
  linkRef.value.classList.add('mouse-over')
}

const handleMouseMove = (e) => {
  if (!linkRef.value) return
  
  const rect = linkRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const percentage = (x / rect.width) * 100
  
  linkRef.value.style.setProperty('--mouse-x', `${percentage}%`)
}

const handleMouseLeave = () => {
  if (!linkRef.value) return
  // Keep the last mouse position, just remove the hover class
  linkRef.value.classList.remove('mouse-over')
}

const handleSectionMouseEnter = (e) => {
  if (!sectionRef.value) return
  
  const rect = sectionRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  sectionRef.value.style.setProperty('--section-mouse-x', `${x}px`)
  sectionRef.value.style.setProperty('--section-mouse-y', `${y}px`)
  sectionRef.value.classList.add('mouse-over')
}

const handleSectionMouseMove = (e) => {
  if (!sectionRef.value) return
  
  const rect = sectionRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  
  sectionRef.value.style.setProperty('--section-mouse-x', `${x}px`)
  sectionRef.value.style.setProperty('--section-mouse-y', `${y}px`)
}

const handleSectionMouseLeave = () => {
  if (!sectionRef.value) return
  // Keep the last mouse position, just remove the hover class
  sectionRef.value.classList.remove('mouse-over')
}
</script>

<style scoped>
.support-section {
  --section-mouse-x: 50%;
  --section-mouse-y: 50%;
  margin: 36px 0 24px;
  padding: 24px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  max-width: 640px;
  margin-left: auto;
  margin-right: auto;
  position: relative;
}

.support-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(
    600px circle at var(--section-mouse-x) var(--section-mouse-y),
    rgba(255, 140, 0, 0.06),
    rgba(255, 107, 53, 0.04) 40%,
    transparent 65%
  );
  pointer-events: none;
  transition: opacity 0.6s ease-out;
  opacity: 0;
  border-radius: 12px;
  overflow: hidden;
}

.support-section.mouse-over::before {
  opacity: 1;
  transition: opacity 0.2s ease-in;
}

.support-section:not(.mouse-over)::before {
  transition: opacity 1s ease-out;
}

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.support-section::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: radial-gradient(
    400px circle at var(--section-mouse-x) var(--section-mouse-y),
    rgba(255, 140, 0, 0.3),
    rgba(255, 107, 53, 0.1) 40%,
    transparent 65%
  );
  border-radius: 12px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.6s ease-out;
  z-index: -1;
}

.support-section.mouse-over::after {
  opacity: 0.5;
  transition: opacity 0.2s ease-in;
}

.support-section:not(.mouse-over)::after {
  transition: opacity 1s ease-out;
}

.support-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: relative;
  z-index: 1;
}

.support-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.support-text {
  flex: 1;
  min-width: 200px;
}

.support-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--vp-c-text-1);
  transition: all 0.3s ease;
}

.support-section.mouse-over .support-title {
  text-shadow: 0 0 20px rgba(255, 140, 0, 0.3);
}

.support-description {
  font-size: 0.95rem;
  color: var(--vp-c-text-2);
  margin: 0;
  line-height: 1.5;
}

.transparency-link {
  --mouse-x: 50%;
  color: var(--vp-c-brand);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
  align-self: flex-start;
  margin-top: 4px;
  position: relative;
  display: inline-block;
  transition: color 0.3s ease;
}

.link-text {
  position: relative;
  display: inline-block;
  color: var(--vp-c-brand);
  transition: all 0.3s ease;
}

.transparency-link.mouse-over .link-text {
  background: radial-gradient(
    ellipse 150% 100% at var(--mouse-x) 50%,
    #ffee00 0%,
    #ffc700 10%,
    #ffa500 20%,
    #ff8c00 30%,
    #ff6b35 40%,
    var(--vp-c-brand) 60%
  );
  background-size: 150% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: contrast(1.2) brightness(1.1);
  animation: pulse 2s ease-in-out infinite;
  transition: opacity 0.2s ease-in;
}

.transparency-link:not(.mouse-over) .link-text {
  transition: opacity 0.8s ease-out;
}

@keyframes pulse {
  0%, 100% { filter: contrast(1.2) brightness(1.1); }
  50% { filter: contrast(1.3) brightness(1.2); }
}

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
  border-color: rgba(255, 140, 0, 0.6);
  transform: translateY(-2px);
  box-shadow: 
    0 0 20px rgba(255, 140, 0, 0.2),
    inset 0 0 20px rgba(255, 140, 0, 0.05);
}

.support-icon {
  width: 18px;
  height: 18px;
  font-size: 18px;
}

.support-benefits {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.support-benefit {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin: 0;
}

.benefit-icon {
  color: var(--vp-c-brand);
  font-weight: bold;
  flex-shrink: 0;
}

/* Mobile responsive */
@media (max-width: 640px) {
  .support-section {
    padding: 20px 16px;
    margin: 24px 0 16px;
  }
  
  .support-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .support-options {
    width: 100%;
    flex-direction: column;
  }
  
  .support-button {
    width: 100%;
    justify-content: center;
  }
  
  .support-benefits {
    padding-top: 12px;
  }
}

/* Dark theme adjustments */
html.dark .support-section {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .support-section::before {
  background: radial-gradient(
    600px circle at var(--section-mouse-x) var(--section-mouse-y),
    rgba(255, 140, 0, 0.08),
    rgba(255, 107, 53, 0.05) 40%,
    transparent 65%
  );
}

html.dark .support-section.mouse-over .support-title {
  text-shadow: 0 0 25px rgba(255, 140, 0, 0.4);
}

html.dark .support-button--secondary {
  border-color: rgba(255, 255, 255, 0.1);
}


html.dark .support-button--primary {
  background: rgba(58, 80, 172, 0.05);
}

/* Light theme adjustments */
html:not(.dark) .support-button--primary {
  color: #ffffff;
}

html:not(.dark) .support-button--primary:hover {
  color: #000000;
  box-shadow: 
    0 4px 12px rgba(71, 150, 227, 0.5),
    0 0 25px rgba(218, 119, 86, 0.7),
    0 0 35px rgba(66, 139, 202, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  background: linear-gradient(135deg, var(--vp-c-brand-dark) 0%, var(--vp-c-brand) 100%);
}

/* Light mode specific adjustments for mouse effects */
html:not(.dark) .support-section::before {
  background: radial-gradient(
    600px circle at var(--section-mouse-x) var(--section-mouse-y),
    rgba(66, 139, 202, 0.08),  /* Blue instead of orange */
    rgba(71, 150, 227, 0.05) 40%,
    transparent 65%
  );
}

html:not(.dark) .support-section::after {
  background: radial-gradient(
    400px circle at var(--section-mouse-x) var(--section-mouse-y),
    rgba(66, 139, 202, 0.15),  /* Blue accent */
    rgba(71, 150, 227, 0.08) 40%,
    transparent 65%
  );
}


html:not(.dark) .transparency-link.mouse-over .link-text {
  background: radial-gradient(
    ellipse 150% 100% at var(--mouse-x) 50%,
    #1e3a8a 0%,   /* Very dark blue */
    #1d4ed8 10%,  /* Dark blue */
    #1e40af 20%,  /* Muted dark blue */
    #0c2a5d 30%,  /* Deep navy blue */
    #082f49 40%,  /* Midnight blue */
    var(--vp-c-brand) 60%
  );
  background-size: 150% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: contrast(1.2) brightness(1.1);
  animation: pulse 2s ease-in-out infinite;
  transition: opacity 0.2s ease-in;
}

html:not(.dark) .transparency-link:not(.mouse-over) .link-text {
  transition: opacity 0.8s ease-out;
}

html:not(.dark) .support-section.mouse-over .support-title {
  text-shadow: 0 0 20px rgba(66, 139, 202, 0.2);  /* Blue shadow */
}

html:not(.dark) .support-button--secondary:hover {
  border-color: rgba(66, 139, 202, 0.6);  /* Blue border */
  box-shadow: 
    0 0 20px rgba(66, 139, 202, 0.15),
    inset 0 0 20px rgba(66, 139, 202, 0.03);
}
</style>