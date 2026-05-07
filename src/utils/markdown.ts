import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'

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

export function renderMarkdown(content: string): string {
  return md.render(content)
}
