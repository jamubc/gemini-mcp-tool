<template>
  <div class="diagram-wrapper">
    <!-- Always visible diagram -->
    <div 
      class="diagram-container" 
      @click="openModal"
      :style="containerStyle"
    >
      <div class="diagram-preview">
        <slot />
      </div>
      <div class="zoom-hint">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="21 21l-4.35-4.35"/>
          <path d="15 11h-8"/>
          <path d="11 15v-8"/>
        </svg>
        <span>Click to enlarge</span>
      </div>
    </div>
    
    <!-- Modal overlay -->
    <div 
      v-if="isOpen" 
      class="diagram-modal"
      @click="closeModal"
    >
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-controls">
            <div class="zoom-controls">
              <button @click="zoomOut" class="control-btn" title="Zoom out" :disabled="scale <= 0.1">
                <span class="zoom-symbol">−</span>
              </button>
              <span class="zoom-info">{{ Math.round(scale * 100) }}%</span>
              <button @click="zoomIn" class="control-btn" title="Zoom in" :disabled="scale >= maxZoom">
                <span class="zoom-symbol">+</span>
              </button>
            </div>
            <div class="action-controls">
              <button @click="fitToScreen" class="control-btn" title="Fit to screen">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                </svg>
              </button>
              <button @click="closeModal" class="close-btn" title="Close">&times;</button>
            </div>
          </div>
        </div>
        <div 
          class="diagram-zoom-container"
          ref="zoomContainer"
          @wheel="handleZoom"
          @mousedown="startPan"
          @mousemove="handlePan"
          @mouseup="endPan"
          @touchstart="startPan"
          @touchmove="handlePan"
          @touchend="endPan"
        >
          <div class="diagram-content">
            <div 
              class="diagram-transform-wrapper"
              :style="contentStyle"
              ref="modalContent"
            >
              <slot />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const isOpen = ref(false)
const scale = ref(1)
const translateX = ref(0)
const translateY = ref(0)
const fitScale = ref(1)
const isPanning = ref(false)
const startX = ref(0)
const startY = ref(0)
const zoomContainer = ref(null)

const maxZoom = computed(() => {
  return Math.max(5, fitScale.value * 5) // At least 5x, or 5x the fit scale
})

const containerStyle = computed(() => ({
  cursor: 'pointer',
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '10px',
  margin: '10px 0',
  transition: 'all 0.2s ease',
  ':hover': {
    borderColor: '#999'
  }
}))

const contentStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  transformOrigin: 'center',
  transition: isPanning.value ? 'none' : 'transform 0.2s ease'
}))

const openModal = () => {
  isOpen.value = true
  document.body.style.overflow = 'hidden'
  // Start by fitting to screen
  setTimeout(() => {
    calculateFitScale()
    fitToScreen()
  }, 100)
}

const closeModal = () => {
  isOpen.value = false
  document.body.style.overflow = ''
  // Reset zoom and pan for next time
  scale.value = 1
  translateX.value = 0
  translateY.value = 0
}


const zoomIn = () => {
  scale.value = Math.min(maxZoom.value, scale.value + 0.2)
}

const zoomOut = () => {
  scale.value = Math.max(0.1, scale.value - 0.2)
}

const fitToScreen = () => {
  const container = zoomContainer.value
  if (!container) return
  
  // Only calculate fit scale once per modal session
  if (fitScale.value === 1) {
    calculateFitScale()
  }
  
  // Always use the stored fit scale
  scale.value = fitScale.value
  translateX.value = 0
  translateY.value = 0
}

const calculateFitScale = () => {
  const container = zoomContainer.value
  if (!container) return
  
  try {
    const containerRect = container.getBoundingClientRect()
    
    // Try multiple selectors to find the diagram
    const selectors = [
      'svg',
      '.mermaid',
      '.mermaid svg',
      '[data-processed="true"]',
      'pre[class*="mermaid"]',
      'div[class*="mermaid"]'
    ]
    
    let diagramElement = null
    let diagramRect = null
    
    for (const selector of selectors) {
      diagramElement = container.querySelector(selector)
      if (diagramElement) {
        diagramRect = diagramElement.getBoundingClientRect()
        // Make sure we found a valid element with dimensions
        if (diagramRect.width > 0 && diagramRect.height > 0) {
          break
        }
      }
    }
    
    if (!diagramElement || !diagramRect || diagramRect.width === 0 || diagramRect.height === 0) {
      // Final fallback: use the container content
      const content = container.querySelector('.diagram-content')
      if (content) {
        diagramRect = content.getBoundingClientRect()
      }
    }
    
    if (!diagramRect || diagramRect.width === 0 || diagramRect.height === 0) {
      // Ultimate fallback
      fitScale.value = 1.2
      return
    }
    
    // Calculate scale to fit with padding
    const padding = 40
    const availableWidth = containerRect.width - padding
    const availableHeight = containerRect.height - padding
    
    const scaleX = availableWidth / diagramRect.width
    const scaleY = availableHeight / diagramRect.height
    
    // Use the smaller scale to ensure it fits both dimensions
    const optimalScale = Math.min(scaleX, scaleY)
    
    // Apply reasonable bounds
    fitScale.value = Math.max(0.3, Math.min(optimalScale, 4))
    
  } catch (error) {
    console.warn('Error calculating fit scale:', error)
    fitScale.value = 1.2
  }
}

const handleZoom = (e) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  scale.value = Math.max(0.1, Math.min(maxZoom.value, scale.value + delta))
}

const startPan = (e) => {
  isPanning.value = true
  const clientX = e.clientX || e.touches[0].clientX
  const clientY = e.clientY || e.touches[0].clientY
  startX.value = clientX - translateX.value
  startY.value = clientY - translateY.value
}

const handlePan = (e) => {
  if (!isPanning.value) return
  e.preventDefault()
  const clientX = e.clientX || e.touches[0].clientX
  const clientY = e.clientY || e.touches[0].clientY
  translateX.value = clientX - startX.value
  translateY.value = clientY - startY.value
}

const endPan = () => {
  isPanning.value = false
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
.diagram-wrapper {
  position: relative;
}

.diagram-container {
  position: relative;
  cursor: pointer;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 10px;
  margin: 10px 0;
  transition: all 0.2s ease;
  background: var(--vp-c-bg);
}

.diagram-container:hover {
  border-color: #999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.diagram-container:hover .zoom-hint {
  opacity: 1;
}

.diagram-preview {
  position: relative;
  overflow: hidden;
}

.diagram-content {
  width: 100%;
  height: 100%;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.diagram-transform-wrapper {
  transform-origin: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-hint {
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 12px;
  align-items: center;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  display: none;
}

@media (hover: hover) {
  .zoom-hint {
    display: flex;
  }
}

.diagram-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(3px);
}

.modal-content {
  position: relative;
  background: var(--vp-c-bg);
  border-radius: 12px;
  width: 95vw;
  height: 95vh;
  max-width: 1200px;
  max-height: 900px;
  overflow: hidden;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 15px 20px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-alt);
  flex-shrink: 0;
}

.modal-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  flex-wrap: wrap;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.action-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.control-btn {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  color: var(--vp-c-text-1);
}

.control-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-soft);
  border-color: var(--vp-c-brand);
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-symbol {
  font-size: 18px;
  font-weight: bold;
  line-height: 1;
}

.zoom-info {
  font-size: 14px;
  color: var(--vp-c-text-2);
  font-weight: 500;
  min-width: 50px;
  text-align: center;
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
}

.close-btn:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.diagram-zoom-container {
  flex: 1;
  overflow: hidden;
  cursor: grab;
  position: relative;
  background: var(--vp-c-bg);
  background-image: radial-gradient(circle, var(--vp-c-border) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0;
}

.diagram-zoom-container:active {
  cursor: grabbing;
}

.diagram-content {
  width: 100%;
  height: 100%;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Mobile optimizations */
@media (max-width: 768px) {
  .modal-content {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }
  
  .modal-header {
    padding: 10px 15px;
  }
  
  .modal-controls {
    justify-content: center;
    flex-wrap: wrap;
    gap: 10px;
  }
  
  .zoom-controls {
    order: 1;
  }
  
  .action-controls {
    order: 2;
  }
  
  .zoom-hint {
    top: 5px;
    right: 5px;
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .zoom-hint span {
    display: none;
  }
}

@media (max-width: 480px) {
  .modal-controls {
    gap: 8px;
  }
  
  .zoom-controls, .action-controls {
    gap: 8px;
  }
  
  .control-btn {
    padding: 10px;
    min-width: 44px;
    min-height: 44px;
  }
  
  .close-btn {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>