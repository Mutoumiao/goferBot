import { describe, it, expect } from 'vitest'
import { renderMarkdown } from '@/utils/markdown'

describe('renderMarkdown', () => {
  it('renders plain text as paragraph', () => {
    const result = renderMarkdown('hello world')
    expect(result).toContain('<p>hello world</p>')
  })

  it('renders bold text with strong tag', () => {
    const result = renderMarkdown('**bold**')
    expect(result).toContain('<strong>bold</strong>')
  })

  it('renders code block with highlight', () => {
    const result = renderMarkdown('```js\nconst x = 1;\n```')
    expect(result).toContain('<pre>')
    expect(result).toContain('<code')
    expect(result).toContain('hljs-keyword')
    expect(result).toContain('const')
  })

  it('renders inline code', () => {
    const result = renderMarkdown('use `renderMarkdown`')
    expect(result).toContain('<code>renderMarkdown</code>')
  })

  it('renders unordered list', () => {
    const result = renderMarkdown('- item 1\n- item 2')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>item 1</li>')
  })

  it('renders ordered list', () => {
    const result = renderMarkdown('1. first\n2. second')
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>first</li>')
  })

  it('renders link as anchor', () => {
    const result = renderMarkdown('[link](https://example.com)')
    expect(result).toContain('<a href="https://example.com">link</a>')
  })

  it('renders heading', () => {
    const result = renderMarkdown('# Title')
    expect(result).toContain('<h1>Title</h1>')
  })
})
