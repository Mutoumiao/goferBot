import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MarkdownRender from '@/components/MarkdownRender.vue'

describe('MarkdownRender', () => {
  it('renders plain text in paragraph', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: 'hello world' },
    })
    expect(wrapper.html()).toContain('<p>hello world</p>')
  })

  it('renders bold text', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '**bold**' },
    })
    expect(wrapper.html()).toContain('<strong>bold</strong>')
  })

  it('renders code block with highlight class', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '```js\nconst x = 1;\n```' },
    })
    expect(wrapper.html()).toContain('<pre')
    expect(wrapper.html()).toContain('hljs')
  })

  it('renders inline code', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '使用 `npm install`' },
    })
    expect(wrapper.html()).toContain('<code>npm install</code>')
  })

  it('renders unordered list', () => {
    const wrapper = mount(MarkdownRender, {
      props: { content: '- a\n- b' },
    })
    expect(wrapper.html()).toContain('<ul>')
    expect(wrapper.html()).toContain('<li>a</li>')
    expect(wrapper.html()).toContain('<li>b</li>')
  })
})
