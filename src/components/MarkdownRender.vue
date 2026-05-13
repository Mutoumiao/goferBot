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
  color: var(--color-text-primary);
}
.markdown-body :deep(h2) {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0.5rem 0;
  color: var(--color-text-primary);
}
.markdown-body :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.5rem 0;
  color: var(--color-text-primary);
}
.markdown-body :deep(p) {
  margin: 0.5rem 0;
  color: var(--color-text-primary);
}
.markdown-body :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}
.markdown-body :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin: 0.5rem 0;
}
.markdown-body :deep(li) {
  margin: 0.125rem 0;
  color: var(--color-text-primary);
}
.markdown-body :deep(pre) {
  background: var(--color-surface-2);
  padding: 0.875rem;
  border-radius: 0.75rem;
  overflow-x: auto;
  margin: 0.75rem 0;
  border: 1px solid var(--color-surface-4);
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
  background: var(--color-surface-3);
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;
  color: var(--color-accent-500);
}
.markdown-body :deep(a) {
  color: var(--color-accent-500);
  text-decoration: none;
}
.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--color-accent-500);
  padding-left: 0.875rem;
  margin: 0.75rem 0;
  color: var(--color-text-secondary);
}
.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
}
.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid var(--color-surface-4);
  padding: 0.5rem 0.625rem;
  text-align: left;
}
.markdown-body :deep(th) {
  background: var(--color-surface-2);
  font-weight: 600;
  color: var(--color-text-primary);
}
.markdown-body :deep(td) {
  color: var(--color-text-primary);
}
.markdown-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--color-surface-4);
  margin: 1rem 0;
}
.markdown-body :deep(.copy-btn) {
  float: right;
  margin: -0.25rem -0.25rem 0 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
  background: transparent;
  border: 1px solid var(--color-surface-4);
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.15s ease;
}
.markdown-body :deep(.copy-btn:hover) {
  color: var(--color-text-primary);
  background: var(--color-surface-3);
  border-color: var(--color-surface-4);
}
</style>
