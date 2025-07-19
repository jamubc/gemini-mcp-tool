<template>
  <div class="support-section">
    <div class="support-content">
      <h3 class="support-title">Support Gemini MCP Tool</h3>
      
      <p class="support-description">
        Found this documentation helpful? Your support helps maintain and improve this open source project.
      </p>

      <div class="support-options">
        <!-- GitHub Sponsors (Primary) -->
        <a 
          href="https://github.com/sponsors/jamubc" 
          target="_blank" 
          rel="noopener"
          class="support-button support-button--primary"
        >
          <svg class="support-icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span>Sponsor on GitHub</span>
        </a>

        <!-- Ko-fi (Secondary) -->
        <a 
          href="https://ko-fi.com/jamubc" 
          target="_blank" 
          rel="noopener"
          class="support-button support-button--secondary"
        >
          <span class="support-icon">☕</span>
          <span>Buy me a coffee</span>
        </a>
      </div>

      <div class="support-benefits">
        <p class="support-benefit">
          <span class="benefit-icon">✓</span>
          <span>Your support directly funds development and hosting costs</span>
        </p>
        <p class="support-benefit">
          <span class="benefit-icon">✓</span>
          <span>Help keep this project actively maintained and improved</span>
        </p>
      </div>

      <!-- Transparency link -->
      <div class="support-transparency">
        <a href="/funding" class="transparency-link">
          See how funds are used →
        </a>
      </div>
    </div>
  </div>
</template>

<script setup>
// No complex logic needed - keep it simple
</script>

<style scoped>
.support-section {
  margin: 48px 0 24px;
  padding: 32px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-align: center;
}

.support-content {
  max-width: 600px;
  margin: 0 auto;
}

.support-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 12px;
  color: var(--vp-c-text-1);
}

.support-description {
  font-size: 1rem;
  color: var(--vp-c-text-2);
  margin: 0 0 24px;
  line-height: 1.6;
}

.support-options {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.support-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.95rem;
}

.support-button--primary {
  background: var(--vp-c-brand);
  color: white;
  border: 1px solid var(--vp-c-brand);
}

.support-button--primary:hover {
  background: var(--vp-c-brand-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.3);
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

.support-benefits {
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
  margin-bottom: 20px;
}

.support-benefit {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
  margin: 0;
}

.benefit-icon {
  color: var(--vp-c-brand);
  font-weight: bold;
  flex-shrink: 0;
}

.support-transparency {
  padding-top: 16px;
  border-top: 1px solid var(--vp-c-divider);
}

.transparency-link {
  color: var(--vp-c-brand);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.transparency-link:hover {
  color: var(--vp-c-brand-dark);
}

/* Mobile responsive */
@media (max-width: 640px) {
  .support-section {
    padding: 24px 16px;
  }
  
  .support-options {
    flex-direction: column;
    width: 100%;
  }
  
  .support-button {
    width: 100%;
    justify-content: center;
  }
}

/* Dark theme adjustments */
html.dark .support-section {
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.08);
}

html.dark .support-button--secondary {
  border-color: rgba(255, 255, 255, 0.1);
}

html.dark .support-button--secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}
</style>