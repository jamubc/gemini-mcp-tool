<template>
  <div class="code-block-container">
    <span class="language-indicator">{{ language }}</span>
    <div class="code-lines">
      <div 
        v-for="(line, index) in lines" 
        :key="index"
        class="code-line"
        @mouseenter="hoveredLine = index"
        @mouseleave="hoveredLine = null"
      >
        <span class="line-number">{{ index + 1 }}</span>
        <button 
          v-show="hoveredLine === index"
          @click="copyLine(line, index)"
          class="copy-line-button"
          :title="`Copy line ${index + 1}`"
        >
          {{ copiedLine === index ? '✓' : '📋' }}
        </button>
        <span class="line-content" v-html="line || '\u00A0'"></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-yaml'

const props = defineProps({
  code: {
    type: String,
    default: '// No code provided'
  },
  language: {
    type: String,
    default: 'javascript'
  }
})

const hoveredLine = ref(null)
const copiedLine = ref(null)

const highlightedCode = ref('')

const lines = computed(() => {
  return highlightedCode.value.split('\n')
})

const highlightCode = () => {
  const grammar = Prism.languages[props.language] || Prism.languages.plaintext
  highlightedCode.value = Prism.highlight(props.code, grammar, props.language)
}

onMounted(highlightCode)
watch(() => [props.code, props.language], highlightCode)

const copyLine = async (line, index) => {
  try {
    const plainLine = props.code.split('\n')[index]
    await navigator.clipboard.writeText(plainLine)
    copiedLine.value = index
    setTimeout(() => {
      copiedLine.value = null
    }, 1500)
  } catch (err) {
    console.error('Failed to copy line:', err)
  }
}
</script>

<style scoped>
.code-block-container {
  background-color: #1e1e1e;
  border-radius: 6px;
  overflow: hidden;
  margin: 16px 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  position: relative;
}

.language-indicator {
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 11px;
  color: #858585;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  z-index: 10;
  user-select: none;
}

.code-lines {
  overflow-x: auto;
  position: relative;
}

.code-line {
  display: flex;
  align-items: center;
  position: relative;
  min-height: 24px;
  line-height: 1.5;
}

.code-line:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.line-number {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  width: 40px;
  padding: 0 8px;
  text-align: right;
  color: #858585;
  font-size: 12px;
  flex-shrink: 0;
}

.copy-line-button {
  position: absolute;
  left: 40px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
  color: #cccccc;
  opacity: 0.8;
  transition: opacity 0.2s;
  z-index: 10;
}

.copy-line-button:hover {
  opacity: 1;
}

.line-content {
  padding-left: 32px;
  padding-right: 16px;
  color: #d4d4d4;
  font-size: 14px;
  white-space: pre;
  flex: 1;
}

/* Override Prism styles for our dark theme */
.line-content :deep(.token.comment),
.line-content :deep(.token.prolog),
.line-content :deep(.token.doctype),
.line-content :deep(.token.cdata) {
  color: #6a9955;
}

.line-content :deep(.token.punctuation) {
  color: #d4d4d4;
}

.line-content :deep(.token.property),
.line-content :deep(.token.tag),
.line-content :deep(.token.boolean),
.line-content :deep(.token.number),
.line-content :deep(.token.constant),
.line-content :deep(.token.symbol),
.line-content :deep(.token.deleted) {
  color: #b5cea8;
}

.line-content :deep(.token.selector),
.line-content :deep(.token.attr-name),
.line-content :deep(.token.string),
.line-content :deep(.token.char),
.line-content :deep(.token.builtin),
.line-content :deep(.token.inserted) {
  color: #ce9178;
}

.line-content :deep(.token.operator),
.line-content :deep(.token.entity),
.line-content :deep(.token.url),
.line-content :deep(.language-css .token.string),
.line-content :deep(.style .token.string) {
  color: #d4d4d4;
}

.line-content :deep(.token.atrule),
.line-content :deep(.token.attr-value),
.line-content :deep(.token.keyword) {
  color: #569cd6;
}

.line-content :deep(.token.function),
.line-content :deep(.token.class-name) {
  color: #dcdcaa;
}

.line-content :deep(.token.regex),
.line-content :deep(.token.important),
.line-content :deep(.token.variable) {
  color: #9cdcfe;
}
</style>