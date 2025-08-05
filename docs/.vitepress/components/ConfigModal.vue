<template>
  <div class="config-card" @click="openModal">
    <div class="config-header">
      <h3>📍 Claude Desktop Config Files</h3>
      <span class="expand-hint">Click to view paths →</span>
    </div>
    <div class="config-preview">
      Configuration file locations for all platforms
    </div>
  </div>

  <!-- Modal overlay -->
  <div v-if="isOpen" class="config-modal" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <span class="config-badge">Config Files</span>
          <h2>Claude Desktop Configuration</h2>
        </div>
        <button @click="closeModal" class="close-btn" title="Close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="config-section">
          <h3 class="section-title">
            <span class="location-badge">File Locations</span>
          </h3>
          <div class="config-locations">
            <div class="location-item">
              <div class="platform-name">
                <strong>🍎 macOS</strong>
              </div>
              <div class="file-path">
                <code>~/Library/Application Support/Claude/claude_desktop_config.json</code>
                <button class="copy-path-btn" @click="copyPath('~/Library/Application Support/Claude/claude_desktop_config.json')" title="Copy path">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="location-item">
              <div class="platform-name">
                <strong>🪟 Windows</strong>
              </div>
              <div class="file-path">
                <code>%APPDATA%\Claude\claude_desktop_config.json</code>
                <button class="copy-path-btn" @click="copyPath('%APPDATA%\\Claude\\claude_desktop_config.json')" title="Copy path">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <div class="location-item">
              <div class="platform-name">
                <strong>🐧 Linux</strong>
              </div>
              <div class="file-path">
                <code>~/.config/claude/claude_desktop_config.json</code>
                <button class="copy-path-btn" @click="copyPath('~/.config/claude/claude_desktop_config.json')" title="Copy path">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)

const openModal = () => {
  isOpen.value = true
  document.body.style.overflow = 'hidden'
}

const closeModal = () => {
  isOpen.value = false
  document.body.style.overflow = ''
}

const copyPath = async (path) => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(path)
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = path
      textArea.style.position = 'fixed'
      textArea.style.left = '-9999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
    }
    
    // Visual feedback - find the button that was clicked
    const button = event.target.closest('.copy-path-btn')
    if (button) {
      const originalContent = button.innerHTML
      button.classList.add('copied')
      button.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
      `
      
      // Reset after 2 seconds
      setTimeout(() => {
        button.classList.remove('copied')
        button.innerHTML = originalContent
      }, 2000)
    }
  } catch (err) {
    console.error('Failed to copy path:', err)
  }
}

const handleKeydown = (e) => {
  if (e.key === 'Escape' && isOpen.value) {
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.config-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 20px;
  margin: 16px 0;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: linear-gradient(135deg, var(--vp-c-bg-soft) 0%, var(--vp-c-bg-alt) 100%);
  border-left: 4px solid var(--vp-c-brand);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  overflow: hidden;
}

.config-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px var(--vp-c-brand-light);
  background: linear-gradient(135deg, var(--vp-c-bg) 0%, var(--vp-c-bg-soft) 100%);
}

.config-card::before {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(45deg, var(--vp-c-brand), transparent, var(--vp-c-brand));
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.config-card:hover::before {
  opacity: 0.3;
}

.config-card::after {
  content: '✨';
  position: absolute;
  top: 10px;
  right: 15px;
  opacity: 0;
  transition: all 0.3s ease;
  transform: scale(0.8);
  font-size: 18px;
}

.config-card:hover::after {
  opacity: 1;
  transform: scale(1) rotate(10deg);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.config-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.expand-hint {
  font-size: 12px;
  color: var(--vp-c-text-3);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.config-card:hover .expand-hint {
  opacity: 1;
}

.config-preview {
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.config-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
}

.modal-content {
  background: var(--vp-c-bg);
  border-radius: 12px;
  width: 90vw;
  max-width: 700px;
  max-height: 80vh;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.modal-title {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.config-badge {
  background: var(--vp-c-brand);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}

.location-badge {
  background: #42b883;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--vp-c-text-2);
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
  margin-left: 16px;
}

.close-btn:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.config-locations {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.location-item {
  background: var(--vp-c-bg-alt);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
}

.location-item:hover {
  border-color: var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
}

.platform-name {
  margin-bottom: 8px;
}

.platform-name strong {
  color: var(--vp-c-text-1);
  font-size: 14px;
}

.file-path {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: space-between;
}

.file-path code {
  flex: 1;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: var(--vp-font-family-mono);
  word-break: break-all;
  color: var(--vp-c-text-1);
}

.copy-path-btn {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  width: 28px;
  height: 28px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
  flex-shrink: 0;
}

.copy-path-btn:hover {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.copy-path-btn.copied {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
}

.copy-path-btn:active {
  transform: scale(0.95);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .modal-content {
    width: 95vw;
    max-height: 90vh;
  }
  
  .modal-header {
    padding: 16px 20px;
  }
  
  .modal-title h2 {
    font-size: 18px;
  }
  
  .modal-body {
    padding: 20px;
  }
  
  .config-card {
    padding: 14px;
  }
  
  .config-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .expand-hint {
    opacity: 1;
    font-size: 11px;
  }
  
  .location-item {
    padding: 12px;
  }
  
  .file-path {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .copy-path-btn {
    align-self: flex-end;
    width: 32px;
    height: 32px;
  }
}
</style>