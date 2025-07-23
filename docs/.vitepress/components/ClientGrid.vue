<template>
  <div class="client-grid">
    <slot />
  </div>
</template>

<style scoped>
.client-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin: 2rem 0;
}

@media (max-width: 768px) {
  .client-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
}

:deep(.client-card) {
  display: flex;
  flex-direction: column;
  text-align: center;
  padding: 1.5rem;
  border: 2px solid var(--vp-c-border);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  transition: all 0.3s ease;
  height: 100%;
}

:deep(.client-card:hover) {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  box-shadow: 0 4px 12px rgba(66, 184, 131, 0.15);
}

:deep(.client-card--recommended) {
  border-color: var(--vp-c-brand-1);
}

:deep(.client-card h3) {
  margin: 0 0 0.5rem 0;
  color: var(--vp-c-text-1);
}

:deep(.client-badge) {
  font-weight: 600;
  font-size: 0.875rem;
  margin-bottom: 1rem;
  color: var(--vp-c-brand-1);
}

:deep(.client-card p) {
  margin: 0 0 auto 0;
  color: var(--vp-c-text-2);
  flex-grow: 1;
}

:deep(.client-button) {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  margin-top: 1rem;
  transition: all 0.3s ease;
  opacity: 0.8;
}

:deep(.client-card:hover .client-button) {
  opacity: 1;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

/* Light theme */
html:not(.dark) :deep(.client-button) {
  background: var(--vp-c-brand-1);
  color: white;
}

html:not(.dark) :deep(.client-button:hover) {
  background: var(--vp-c-brand-2);
  color: white;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(66, 184, 131, 0.4), 0 4px 8px rgba(0, 0, 0, 0.15);
  filter: brightness(1.1);
}

/* Dark theme */
.dark :deep(.client-button) {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-bg);
}

.dark :deep(.client-button:hover) {
  background: var(--vp-c-brand-2);
  color: white;
  transform: translateY(-3px);
  box-shadow: 0 8px 20px rgba(66, 184, 131, 0.6), 0 4px 8px rgba(66, 184, 131, 0.3);
  filter: brightness(1.1);
}

/* Claude Code styling */
:deep(.claude-code-card h3) {
  color: #ff8c00 !important;
}

:deep(.snowflake) {
  display: inline-block;
  animation: spin 2s linear infinite paused;
  transition: animation-play-state 0.3s ease;
}

:deep(.claude-code-card:hover .snowflake) {
  animation-play-state: running;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>