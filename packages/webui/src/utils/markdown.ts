import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({
  highlight(str, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
    try {
      return hljs.highlight(str, { language }).value
    } catch {
      return hljs.highlight(str, { language: 'plaintext' }).value
    }
  },
  linkify: true,
})

// 自定义代码块渲染，添加复制按钮和 aria-label
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx]
  const code = token.content
  const lang = token.info || 'plaintext'
  const highlighted = md.options.highlight?.(code, lang) || code
  const encodedCode = encodeURIComponent(code)

  return `<pre class="hljs"><div class="code-header"><span class="lang-label">${lang}</span><button class="copy-btn" aria-label="复制代码" data-code="${encodedCode}">复制</button></div><code class="hljs">${highlighted}</code></pre>`
}

export function renderMarkdown(content: string): string {
  const raw = md.render(content)
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'hr',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'pre', 'code',
      'strong', 'em', 's', 'del',
      'a', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'span',
    ],
    ALLOWED_ATTR: [
      'href', 'title', 'target', 'rel',
      'src', 'alt', 'title',
      'class', 'data-code',
    ],
  }) as string
}
