<script setup lang="ts">
import { computed } from 'vue'
import { renderMarkdown } from '@/utils/markdown'
import 'highlight.js/styles/github.css'

const props = defineProps<{
  content: string
}>()

const html = computed(() => renderMarkdown(props.content))

function handleClick(e: MouseEvent) {
  const btn = (e.target as HTMLElement).closest('.copy-btn')
  if (!btn) return

  const code = decodeURIComponent((btn as HTMLElement).dataset.code || '')
  navigator.clipboard.writeText(code).catch(() => {
    // ignore clipboard errors
  })

  const original = btn.textContent
  btn.textContent = '已复制'
  setTimeout(() => {
    btn.textContent = original
  }, 2000)
}
</script>

<template>
  <div class="markdown-body" @click="handleClick" v-html="html" />
</template>

<style scoped>
.markdown-body :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0.5rem 0;
}
.markdown-body :deep(h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.markdown-body :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0;
}
.markdown-body :deep(p) {
  margin: 0.375rem 0;
}
.markdown-body :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.375rem 0;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.375rem 0;
}
.markdown-body :deep(li) {
  margin: 0.125rem 0;
}
.markdown-body :deep(pre) {
  background: #f6f8fa;
  padding: 0.75rem;
  border-radius: 0.375rem;
  overflow-x: auto;
  margin: 0.5rem 0;
}
.markdown-body :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
}
.markdown-body :deep(:not(pre) > code) {
  background: #eff1f3;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
}
.markdown-body :deep(a) {
  color: #2563eb;
  text-decoration: underline;
}
.markdown-body :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 0.75rem;
  margin: 0.5rem 0;
  color: #4b5563;
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.5rem 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid #e5e7eb;
  padding: 0.375rem 0.5rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: #f9fafb;
  font-weight: 600;
}
</style>
