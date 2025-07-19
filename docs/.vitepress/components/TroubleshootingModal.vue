<template>
  <div class="issue-card" @click="openModal">
    <div class="issue-header">
      <h3>{{ title }}</h3>
      <span class="expand-hint">Click to see solution →</span>
    </div>
    <div class="issue-preview">
      {{ preview }}
    </div>
  </div>

  <!-- Modal overlay -->
  <div v-if="isOpen" class="issue-modal" @click="closeModal">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <div class="modal-title">
          <span class="problem-badge">Problem</span>
          <h2>{{ title }}</h2>
        </div>
        <button @click="closeModal" class="close-btn" title="Close">&times;</button>
      </div>
      
      <div class="modal-body">
        <div class="solution-section">
          <h3 class="solution-title">
            <span class="solution-badge">Solution</span>
          </h3>
          <div class="solution-content">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  preview: {
    type: String,
    required: true
  }
})

const isOpen = ref(false)

const openModal = async () => {
  isOpen.value = true
  document.body.style.overflow = 'hidden'
  
  // Wait for modal to render, then add copy buttons
  await nextTick()
  setTimeout(addCopyButtons, 100)
}

const closeModal = () => {
  isOpen.value = false
  document.body.style.overflow = ''
}

const addCopyButtons = () => {
  const modal = document.querySelector('.issue-modal')
  if (!modal) return
  
  // Look for all code blocks (pre elements or code elements)
  const codeBlocks = modal.querySelectorAll('pre, code')
  
  codeBlocks.forEach((block) => {
    // Skip inline code elements
    if (block.tagName === 'CODE' && block.parentElement.tagName !== 'PRE') {
      return
    }
    
    // Skip if copy button already exists
    if (block.querySelector('.copy-btn') || block.parentElement?.querySelector('.copy-btn')) return
    
    // Use pre element for block code, code element for inline
    const targetElement = block.tagName === 'PRE' ? block : block.parentElement
    if (!targetElement) return
    
    const copyButton = document.createElement('button')
    copyButton.className = 'copy-btn'
    copyButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `
    copyButton.title = 'Copy code'
    copyButton.type = 'button'
    
    copyButton.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      
      // Get the code content
      const codeElement = targetElement.querySelector('code') || targetElement
      if (!codeElement) return
      
      let textToCopy = codeElement.textContent || codeElement.innerText || ''
      
      // Clean up the text (remove extra whitespace, etc.)
      textToCopy = textToCopy.trim()
      
      console.log('Attempting to copy:', textToCopy) // Debug log
      
      try {
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(textToCopy)
        } else {
          // Fallback for older browsers
          const textArea = document.createElement('textarea')
          textArea.value = textToCopy
          textArea.style.position = 'fixed'
          textArea.style.left = '-9999px'
          document.body.appendChild(textArea)
          textArea.select()
          document.execCommand('copy')
          document.body.removeChild(textArea)
        }
        
        // Visual feedback
        copyButton.classList.add('copied')
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polyline points="20,6 9,17 4,12"></polyline>
          </svg>
        `
        
        // Reset after 2 seconds
        setTimeout(() => {
          copyButton.classList.remove('copied')
          copyButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          `
        }, 2000)
        
        console.log('Copy successful!') // Debug log
        
      } catch (err) {
        console.error('Failed to copy code:', err)
        
        // Show error feedback
        copyButton.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        `
        
        setTimeout(() => {
          copyButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          `
        }, 2000)
      }
    })
    
    // Position the target element and add the button
    targetElement.style.position = 'relative'
    targetElement.appendChild(copyButton)
  })
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
.issue-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--vp-c-bg-soft);
  border-left: 4px solid #ff6b6b;
}

.issue-card:hover {
  border-color: var(--vp-c-brand);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.issue-header h3 {
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

.issue-card:hover .expand-hint {
  opacity: 1;
}

.issue-preview {
  font-size: 14px;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.issue-modal {
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
  max-width: 800px;
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

.problem-badge {
  background: #ff6b6b;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  width: fit-content;
}

.solution-badge {
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

.solution-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.solution-title {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.solution-content {
  line-height: 1.6;
}

.solution-content :deep(pre) {
  margin: 16px 0;
  border-radius: 6px;
  position: relative;
}

.solution-content :deep(code) {
  font-size: 13px;
}

.solution-content :deep(.language-bash),
.solution-content :deep(.language-json),
.solution-content :deep(.language-javascript),
.solution-content :deep([class*="language-"]) {
  position: relative;
}

.solution-content :deep(.copy-btn) {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  width: 32px;
  height: 32px;
  background-color: var(--vp-c-bg);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vp-c-text-2);
  opacity: 0;
}

.solution-content :deep(pre:hover .copy-btn),
.solution-content :deep(code:hover .copy-btn) {
  opacity: 1;
}

.solution-content :deep(.copy-btn:hover) {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.solution-content :deep(.copy-btn.copied) {
  border-color: var(--vp-c-brand);
  background-color: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
  opacity: 1;
}

.solution-content :deep(.copy-btn:active) {
  transform: scale(0.95);
}

.solution-content :deep(ul), 
.solution-content :deep(ol) {
  margin: 12px 0;
  padding-left: 20px;
}

.solution-content :deep(li) {
  margin: 6px 0;
  line-height: 1.5;
}

.solution-content :deep(p) {
  margin: 12px 0;
}

.solution-content :deep(strong) {
  color: var(--vp-c-brand);
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
  
  .issue-card {
    padding: 14px;
  }
  
  .issue-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .expand-hint {
    opacity: 1;
    font-size: 11px;
  }
}
</style>