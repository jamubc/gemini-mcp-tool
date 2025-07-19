<template>
  <div class="ad-placeholder">
    <div class="placeholder-content">
      <span class="placeholder-icon">📢</span>
      <div class="placeholder-text">
        <p class="placeholder-title">Support Open Source</p>
        <p class="placeholder-description">
          Ad space pending approval from EthicalAds
        </p>
      </div>
    </div>
    <a 
      href="https://github.com/sponsors/jamubc" 
      class="placeholder-cta"
      target="_blank"
      rel="noopener"
    >
      Sponsor for ad-free docs →
    </a>
  </div>
</template>

<style scoped>
.ad-placeholder {
  background: var(--vp-c-bg-soft);
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  text-align: center;
}

.placeholder-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 12px;
}

.placeholder-icon {
  font-size: 24px;
  opacity: 0.5;
}

.placeholder-text {
  text-align: left;
}

.placeholder-title {
  font-weight: 600;
  font-size: 14px;
  margin: 0 0 4px;
  color: var(--vp-c-text-1);
}

.placeholder-description {
  font-size: 12px;
  margin: 0;
  color: var(--vp-c-text-3);
}

.placeholder-cta {
  font-size: 12px;
  color: var(--vp-c-brand);
  text-decoration: none;
  font-weight: 500;
}

.placeholder-cta:hover {
  color: var(--vp-c-brand-dark);
}

/* Sidebar specific styling */
.VPSidebar .ad-placeholder {
  max-width: 250px;
}
</style>