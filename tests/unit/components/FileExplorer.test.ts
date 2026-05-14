import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import FileExplorer from '@/components/FileExplorer.vue'
import { confirmDialog } from '@/utils/confirm'

vi.mock('@/utils/confirm')

const ContextMenuStub = {
  template: '<div v-if="visible" data-testid="context-menu"><slot /></div>',
  props: ['visible', 'x', 'y'],
  emits: ['close'],
}

function mountExplorer(props?: Record<string, unknown>) {
  return mount(FileExplorer, {
    props: {
      files: [],
      searchResults: [],
      searchQuery: '',
      breadcrumb: [],
      isSearchMode: false,
      isLoading: false,
      ...props,
    },
    global: {
      stubs: {
        ContextMenu: ContextMenuStub,
      },
    },
  })
}

describe('FileExplorer', () => {
  it('renders loading state', () => {
    const wrapper = mountExplorer({ isLoading: true })
    expect(wrapper.find('svg.lucide-loader').exists()).toBe(true)
  })

  it('renders empty state when no files', () => {
    const wrapper = mountExplorer()
    expect(wrapper.text()).toContain('暂无文件')
  })

  it('renders file list with name, size and date', () => {
    const wrapper = mountExplorer({
      files: [
        { name: 'doc.md', type: 'file', size: 1024, updatedAt: 1700000000000 },
        { name: 'folder1', type: 'directory', updatedAt: 1700000000000 },
      ],
    })
    expect(wrapper.text()).toContain('doc.md')
    expect(wrapper.text()).toContain('folder1')
    expect(wrapper.text()).toContain('1.0 KB')
  })

  it('renders search results with relativePath', () => {
    const wrapper = mountExplorer({
      isSearchMode: true,
      searchResults: [
        { name: 'match.md', type: 'file', size: 512, updatedAt: 1700000000000, relativePath: 'a/match.md' },
      ],
    })
    expect(wrapper.text()).toContain('match.md')
    expect(wrapper.text()).toContain('a/match.md')
  })

  it('emits openDirectory on clicking a folder', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'folder1', type: 'directory', updatedAt: 1700000000000 }],
    })
    await wrapper.find('[class*="cursor-pointer"]').trigger('click')
    expect(wrapper.emitted('openDirectory')).toHaveLength(1)
    expect(wrapper.emitted('openDirectory')![0]).toEqual(['folder1'])
  })

  it('does not emit openDirectory on clicking a file', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'doc.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    await wrapper.find('[class*="cursor-pointer"]').trigger('click')
    expect(wrapper.emitted('openDirectory')).toBeUndefined()
  })

  it('emits openDirectory with breadcrumb prefix for nested folders', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'sub', type: 'directory', updatedAt: 1700000000000 }],
      breadcrumb: ['folderA'],
    })
    await wrapper.find('[class*="cursor-pointer"]').trigger('click')
    expect(wrapper.emitted('openDirectory')![0]).toEqual(['folderA/sub'])
  })

  it('renders breadcrumb segments', () => {
    const wrapper = mountExplorer({ breadcrumb: ['A', 'B'] })
    expect(wrapper.text()).toContain('A')
    expect(wrapper.text()).toContain('B')
  })

  it('emits navigateToBreadcrumb with -1 for root', async () => {
    const wrapper = mountExplorer({ breadcrumb: ['A'] })
    await wrapper.findAll('button').find((b) => b.text() === '根目录')!.trigger('click')
    expect(wrapper.emitted('navigateToBreadcrumb')).toHaveLength(1)
    expect(wrapper.emitted('navigateToBreadcrumb')![0]).toEqual([-1])
  })

  it('emits navigateToBreadcrumb with index on segment click', async () => {
    const wrapper = mountExplorer({ breadcrumb: ['A', 'B'] })
    const buttons = wrapper.findAll('button')
    // Find the button with text "A" after root
    const aButton = buttons.find((b) => b.text() === 'A')
    await aButton!.trigger('click')
    expect(wrapper.emitted('navigateToBreadcrumb')![0]).toEqual([0])
  })

  it('emits search on Enter in search input', async () => {
    const wrapper = mountExplorer()
    const inputs = wrapper.findAll('input')
    const searchInput = inputs.find((i) => i.attributes('placeholder') === '搜索文件...')
    await searchInput!.setValue('query')
    await searchInput!.trigger('keyup.enter')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('search')![0]).toEqual(['query'])
  })

  it('emits empty search when input is cleared', async () => {
    const wrapper = mountExplorer()
    const inputs = wrapper.findAll('input')
    const searchInput = inputs.find((i) => i.attributes('placeholder') === '搜索文件...')
    await searchInput!.setValue('')
    await searchInput!.trigger('keyup.enter')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('search')![0]).toEqual([''])
  })

  it('emits importFiles on add button click', async () => {
    const wrapper = mountExplorer()
    const addBtn = wrapper.findAll('button').find((b) => b.text().includes('添加文件'))
    await addBtn!.trigger('click')
    expect(wrapper.emitted('importFiles')).toHaveLength(1)
  })

  it('emits goBack and goForward on navigation buttons', async () => {
    const wrapper = mountExplorer()
    const buttons = wrapper.findAll('button')
    // First two buttons are back/forward
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('goBack')).toHaveLength(1)
    expect(wrapper.emitted('goForward')).toHaveLength(1)
  })

  it('shows blank context menu with new folder on right-clicking blank area', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'doc.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const container = wrapper.find('[data-testid="file-explorer"]')
    await container.trigger('contextmenu')
    expect(wrapper.find('[data-testid="context-menu"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('新建文件夹')
  })

  it('shows file context menu with rename/move/copy/delete on right-clicking a file', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'doc.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')
    const menu = wrapper.find('[data-testid="context-menu"]')
    expect(menu.exists()).toBe(true)
    expect(wrapper.text()).toContain('重命名')
    expect(wrapper.text()).toContain('移动到')
    expect(wrapper.text()).toContain('复制到')
    expect(wrapper.text()).toContain('永久删除')
  })

  it('enters inline rename mode and emits renameFile on save', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'old.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')

    // Click rename button
    const renameBtn = wrapper.findAll('button').find((b) => b.text().includes('重命名'))
    await renameBtn!.trigger('click')
    await nextTick()

    // InlineRename input has border-accent-500 class to distinguish from search input
    const input = wrapper.find('input.border-accent-500')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('old')

    await input.setValue('new')
    await input.trigger('keyup', { key: 'Enter' })

    expect(wrapper.emitted('renameFile')).toHaveLength(1)
    expect(wrapper.emitted('renameFile')![0]).toEqual(['old.md', 'new'])
  })

  it('emits deleteFile when confirming delete in context menu', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(true)
    const wrapper = mountExplorer({
      files: [{ name: 'del.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')

    const deleteBtn = wrapper.findAll('button').find((b) => b.text().includes('永久删除'))
    await deleteBtn!.trigger('click')
    await flushPromises()

    expect(confirmDialog).toHaveBeenCalledWith(
      '确认永久删除文件「del.md」？此操作不可撤销。',
      { title: '提示', kind: 'danger' },
    )
    expect(wrapper.emitted('deleteFile')).toHaveLength(1)
    expect(wrapper.emitted('deleteFile')![0]).toEqual(['del.md'])
  })

  it('does not emit deleteFile when canceling delete in context menu', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    const wrapper = mountExplorer({
      files: [{ name: 'del.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')

    const deleteBtn = wrapper.findAll('button').find((b) => b.text().includes('永久删除'))
    await deleteBtn!.trigger('click')
    await flushPromises()

    expect(confirmDialog).toHaveBeenCalledWith(
      '确认永久删除文件「del.md」？此操作不可撤销。',
      { title: '提示', kind: 'danger' },
    )
    expect(wrapper.emitted('deleteFile')).toBeUndefined()
  })

  it('emits moveFile when clicking move in context menu', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'mv.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')

    const moveBtn = wrapper.findAll('button').find((b) => b.text().includes('移动到'))
    await moveBtn!.trigger('click')

    expect(wrapper.emitted('moveFile')).toHaveLength(1)
    expect(wrapper.emitted('moveFile')![0]).toEqual(['mv.md'])
  })

  it('emits copyFile when clicking copy in context menu', async () => {
    const wrapper = mountExplorer({
      files: [{ name: 'cp.md', type: 'file', size: 100, updatedAt: 1700000000000 }],
    })
    const row = wrapper.find('[class*="cursor-pointer"]')
    await row.trigger('contextmenu')

    const copyBtn = wrapper.findAll('button').find((b) => b.text().includes('复制到'))
    await copyBtn!.trigger('click')

    expect(wrapper.emitted('copyFile')).toHaveLength(1)
    expect(wrapper.emitted('copyFile')![0]).toEqual(['cp.md'])
  })

  it('emits createFolder when clicking new folder in blank context menu', async () => {
    const wrapper = mountExplorer()
    const container = wrapper.find('[data-testid="file-explorer"]')
    await container.trigger('contextmenu')

    const newFolderBtn = wrapper.findAll('button').find((b) => b.text().includes('新建文件夹'))
    await newFolderBtn!.trigger('click')

    expect(wrapper.emitted('createFolder')).toHaveLength(1)
  })
})
