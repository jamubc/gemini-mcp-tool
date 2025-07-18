import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import DiagramModal from '../components/DiagramModal.vue'
import CodeBlock from '../components/CodeBlock.vue'
import ClientGrid from '../components/ClientGrid.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('DiagramModal', DiagramModal)
    app.component('CodeBlock', CodeBlock)
    app.component('ClientGrid', ClientGrid)
  },
  setup() {
    // Force dark mode on initial load
    if (typeof window !== 'undefined' && !localStorage.getItem('vitepress-theme-appearance')) {
      localStorage.setItem('vitepress-theme-appearance', 'dark')
    }
  }
}