import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import FundingLayout from './FundingLayout.vue'
import DiagramModal from '../components/DiagramModal.vue'
import CodeBlock from '../components/CodeBlock.vue'
import ClientGrid from '../components/ClientGrid.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout: Layout,
  enhanceApp({ app, router }) {
    app.component('DiagramModal', DiagramModal)
    app.component('CodeBlock', CodeBlock)
    app.component('ClientGrid', ClientGrid)
    app.component('FundingLayout', FundingLayout)
  },
  setup() {
    // Force dark mode on initial load
    if (typeof window !== 'undefined' && !localStorage.getItem('vitepress-theme-appearance')) {
      localStorage.setItem('vitepress-theme-appearance', 'dark')
    }
  }
}