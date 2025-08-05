<template>
  <div v-if="shouldShowAd" class="ad-banner" :class="bannerClass">
    <!-- GitHub Sponsors -->
    <div v-if="type === 'github-sponsors'" class="sponsor-banner">
      <div class="sponsor-content">
        <span class="sponsor-icon">💖</span>
        <span class="sponsor-text">Support this project on GitHub Sponsors</span>
        <a :href="githubSponsorsUrl" target="_blank" rel="noopener" class="sponsor-button">
          Sponsor
        </a>
      </div>
    </div>

    <!-- Carbon Ads -->
    <div v-else-if="type === 'carbon'" class="carbon-ads">
      <div id="carbonads">
        <!-- Carbon will inject content here -->
      </div>
    </div>
    

    <!-- Dismissible close button -->
    <button v-if="dismissible" @click="dismissAd" class="ad-close" aria-label="Close ad">
      ×
    </button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'github-sponsors', // 'github-sponsors', 'carbon'
    validator: (value) => ['github-sponsors', 'carbon'].includes(value)
  },
  position: {
    type: String,
    default: 'top', // 'top', 'bottom', 'sidebar', 'inline'
    validator: (value) => ['top', 'bottom', 'sidebar', 'inline'].includes(value)
  },
  githubSponsorsUrl: {
    type: String,
    default: 'https://github.com/sponsors/jamubc'
  },
  dismissible: {
    type: Boolean,
    default: true
  },
  showOnPaths: {
    type: Array,
    default: () => [] // Empty array means show on all paths
  },
  hideOnPaths: {
    type: Array,
    default: () => ['/'] // Hide on home page by default
  },
})

const isDismissed = ref(false)
const storageKey = `ad-dismissed-${props.type}-${props.position}`

const bannerClass = computed(() => `ad-banner--${props.position}`)

const shouldShowAd = computed(() => {
  if (isDismissed.value) return false
  
  // Check if we're in browser environment
  if (typeof window === 'undefined') return false
  
  const currentPath = window.location.pathname
  
  // If showOnPaths is specified, only show on those paths
  if (props.showOnPaths.length > 0) {
    return props.showOnPaths.some(path => currentPath.includes(path))
  }
  
  // If hideOnPaths is specified, hide on those paths
  if (props.hideOnPaths.length > 0) {
    return !props.hideOnPaths.some(path => currentPath.includes(path))
  }
  
  return true
})

const dismissAd = () => {
  isDismissed.value = true
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(storageKey, 'true')
  }
}

onMounted(() => {
  // Check if ad was previously dismissed
  if (typeof localStorage !== 'undefined') {
    const dismissed = localStorage.getItem(storageKey)
    if (dismissed === 'true') {
      isDismissed.value = true
    }
  }
  
  // Load Carbon Ads script if needed
  if (props.type === 'carbon' && !document.getElementById('carbon-script')) {
    const script = document.createElement('script')
    script.id = 'carbon-script'
    script.async = true
    script.type = 'text/javascript'
    script.src = '//cdn.carbonads.com/carbon.js?serve=YOUR_CARBON_ID&placement=YOUR_PLACEMENT'
    script.setAttribute('id', '_carbonads_js')
    document.head.appendChild(script)
  }
})
</script>

<style scoped>
.ad-banner {
  position: relative;
  margin: 16px 0;
  border-radius: 8px;
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
  transition: all 0.3s ease;
}

.ad-banner:hover {
  border-color: var(--vp-c-brand);
}

/* Position variants */
.ad-banner--top {
  margin: 0 0 24px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(12px);
  background-color: rgba(20, 20, 20, 0.95);
}

.ad-banner--bottom {
  margin: 24px 0 0 0;
  position: fixed;
  bottom: 24px;
  right: 24px;
  max-width: 400px;
  z-index: 100;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.ad-banner--sidebar {
  margin: 16px 0;
  max-width: 250px;
}

.ad-banner--inline {
  margin: 24px auto;
  max-width: 600px;
}

/* Sponsor Banner */
.sponsor-banner {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, rgba(66, 184, 131, 0.1) 0%, rgba(53, 73, 94, 0.1) 100%);
}

.sponsor-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.sponsor-icon {
  font-size: 18px;
}

.sponsor-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.sponsor-button {
  padding: 6px 12px;
  background-color: var(--vp-c-brand);
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.sponsor-button:hover {
  background-color: var(--vp-c-brand-dark);
  transform: translateY(-1px);
}

/* Carbon Ads */
.carbon-ads {
  padding: 16px;
  text-align: center;
}

#carbonads {
  font-family: var(--vp-font-family-base);
  line-height: 1.5;
  max-width: 330px;
  margin: 0 auto;
}

#carbonads span {
  display: block;
  padding: 0;
  margin: 0;
}

#carbonads .carbon-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

#carbonads .carbon-img {
  display: block;
  margin: 0 0 8px;
  line-height: 1;
}

#carbonads .carbon-img img {
  border-radius: 4px;
  max-width: 130px;
}

#carbonads .carbon-text {
  display: block;
  padding: 0;
  color: var(--vp-c-text-1);
  text-decoration: none;
  font-size: 13px;
  line-height: 1.4;
}

#carbonads .carbon-text:hover {
  color: var(--vp-c-brand);
}

#carbonads .carbon-poweredby {
  display: block;
  margin-top: 8px;
  color: var(--vp-c-text-3);
  font-size: 11px;
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Close button */
.ad-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.ad-close:hover {
  opacity: 1;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .ad-banner--bottom {
    position: relative;
    bottom: auto;
    right: auto;
    max-width: none;
    margin: 16px;
  }
  
  .sponsor-content {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .sponsor-text {
    font-size: 13px;
  }
}

/* Dark theme specific adjustments */
html.dark .ad-banner--top {
  background-color: rgba(10, 10, 10, 0.95);
}

html.dark .sponsor-banner {
  background: linear-gradient(135deg, rgba(66, 184, 131, 0.15) 0%, rgba(53, 73, 94, 0.15) 100%);
}
</style>