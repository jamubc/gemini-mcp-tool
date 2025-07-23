<template>
  <FundingLayout v-if="frontmatter.layout === 'funding'" />
  <Layout v-else>
    <template #nav-bar-title-after>
      <span v-if="!isHomePage" class="replacement-title">Documentation</span>
    </template>
    <template #nav-bar-content-before>
      <div class="nav-warning">
        🏷️ <span>1.1.4</span>
      </div>
    </template>
    <template #sidebar-nav-after>
      <!-- Sidebar ad placement - most non-intrusive -->
      <AdBanner 
        v-if="!isHomePage"
        type="carbon" 
        position="sidebar"
        :dismissible="true"
        :hide-on-paths="['/', '/getting-started']"
      />
    </template>
    <template #doc-footer-before>
      <!-- Footer support section - shown after users find value -->
      <SupportSection v-if="!isHomePage && !isFundingPage" />
    </template>
  </Layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import AdBanner from './components/AdBanner.vue'
import SupportSection from './components/SupportSection.vue'
import FundingHero from './components/FundingHero.vue'
import FundingEffects from './components/FundingEffects.vue'
import FundingLayout from './FundingLayout.vue'

const { Layout } = DefaultTheme
const route = useRoute()
const { frontmatter } = useData()

const isHomePage = computed(() => route.path === '/' || route.path === '/gemini-mcp-tool/')
const isFundingPage = computed(() => route.path.includes('/funding'))
</script>

<style>
/* Hide original title text when sidebar is present */
.VPNavBar.has-sidebar .VPNavBarTitle .title > span:not(.replacement-title) {
  display: none;
}

/* Style the replacement title */
.replacement-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

/* Ensure version badge is visible in light mode */
.nav-warning {
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid var(--vp-c-border);
}

/* Ensure the nav bar title container accommodates our custom title */
.VPNavBar.has-sidebar .VPNavBarTitle {
  position: relative;
}

/* Restore original title on home page (no sidebar) */
.VPNavBar:not(.has-sidebar) .VPNavBarTitle .title > span {
  display: inline;
}

.nav-warning {
  display: inline-flex;
  align-items: center;
  margin-right: auto;
  margin-left: 28px;
  padding: 4px 12px;
  background-color: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow-darker);
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
  border: 1px solid var(--vp-c-yellow);
}

/* Ensure proper contrast in both themes */
:root {
  --vp-c-yellow-soft: #fef3c7;
  --vp-c-yellow: #f59e0b;
  --vp-c-yellow-darker: #92400e;
}

html.dark {
  --vp-c-yellow-soft: rgba(245, 158, 11, 0.15);
  --vp-c-yellow: #fbbf24;
  --vp-c-yellow-darker: #fde047;
}

/* Add extra spacing on home page to prevent overlap */
.VPNavBar:not(.has-sidebar) .nav-warning {
  margin-left: 32px;
}

/* Consistent spacing when sidebar is present */
.VPNavBar.has-sidebar .nav-warning {
  margin-left: 28px;
}

.nav-warning span {
  margin-left: 6px;
}

html.dark .nav-warning {
  background-color: rgba(251, 191, 36, 0.1);
  color: #fbbf24;
}

/* Hide on mobile to prevent navbar overflow */
@media (max-width: 768px) {
  .nav-warning {
    display: none;
  }
}
</style>