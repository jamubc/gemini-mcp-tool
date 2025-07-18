<template>
  <Layout>
    <template #nav-bar-title-after>
      <span v-if="!isHomePage" class="short-title">Documentation</span>
    </template>
    <template #nav-bar-content-before>
      <div class="nav-warning">
        🏷️ <span>1.1.3</span>
      </div>
    </template>
  </Layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

const { Layout } = DefaultTheme
const route = useRoute()

const isHomePage = computed(() => route.path === '/' || route.path === '/gemini-mcp-tool/')
</script>

<style>
.short-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
}

/* Hide original title on non-home pages */
.has-sidebar .VPNavBarTitle .text {
  display: none;
}

/* Position the nav bar title container for replacement */
.has-sidebar .VPNavBarTitle {
  position: relative;
}

.nav-warning {
  display: inline-flex;
  align-items: center;
  margin-right: auto;
  margin-left: 28px;
  padding: 4px 12px;
  background-color: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
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