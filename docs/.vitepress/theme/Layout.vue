<template>
  <Layout>
    <template #nav-bar-content-before>
      <div class="nav-warning">
        🚧 <span>Docs under construction</span>
      </div>
    </template>
  </Layout>
</template>

<script setup>
import DefaultTheme from 'vitepress/theme'
const { Layout } = DefaultTheme
</script>

<style>
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


/* Test Feature Flag */
.nav-unstable {
  display: inline-flex;
  align-items: center;
  margin-right: auto;
  margin-left: 28px;
  padding: 4px 12px;
  background-color: #e8a649;
  color: #92400e;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

/* Add extra spacing on home page to prevent overlap */
.VPNavBar:not(.has-sidebar) .nav-unstable {
  margin-left: 32px;
}

/* Consistent spacing when sidebar is present */
.VPNavBar.has-sidebar .nav-unstable {
  margin-left: 28px;
}

.nav-unstable span {
  margin-left: 6px;
}

html.dark .nav-unstable {
  background-color: rgba(251, 191, 36, 0.1);
  color:rgb(233, 137, 2);
}

/* Hide on mobile to prevent navbar overflow */
@media (max-width: 768px) {
  .nav-unstable {
    display: none;
  }
}

/* Custom unstable callout styling */
.custom-container.unstable {
  background-color: #fff8dc;
  border-left: 2.5px solid #fa9302;
  padding: 12px;
  margin: 16px 0;
  border-radius: 15px;
}

.custom-container.unstable .custom-container-title {
  color: ##0d0601;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
  text-decoration-line: underline overline;
  text-decoration-thickness: 3px;

}

html.dark .custom-container.unstable {
  background-color: rgba(232, 166, 73, 0.1);
  border-left-color: #ef9c27;
}

html.dark .custom-container.unstable .custom-container-title {
  color: #ff6600;
  font-family: "Consolas", "Monaco", "Courier New", monospace;
  text-decoration-line: underline overline;
  text-decoration-thickness: 3px;
}

</style>