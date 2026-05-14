import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import HistoryPage from '@/components/HistoryPage.vue'
import { useSessionStore } from '@/stores/session'
import { confirmDialog } from '@/utils/confirm'
import { TransitionStub } from '../stubs'

vi.mock('@/utils/confirm')

function mountPage(storeOverrides?: Record<string, unknown>) {
  const pinia = createTestingPinia({
    stubActions: true,
    initialState: {
      session: {
        tabs: [{ id: 'home', type: 'chat', title: '首页', closable: true }],
        activeTabId: 'home',
        messages: new Map(),
        historySessions: [],
        historyLoading: false,
        historyError: null,
        ...storeOverrides,
      },
    },
  })
  setActivePinia(pinia)

  return mount(HistoryPage, {
    global: {
      plugins: [pinia],
      stubs: {
        Transition: TransitionStub,
      },
    },
  })
}

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(confirmDialog).mockResolvedValue(true)
  })

  it('shows loading state', () => {
    const wrapper = mountPage({ historyLoading: true })
    expect(wrapper.text()).toContain('加载中')
  })

  it('shows error state with retry', () => {
    const wrapper = mountPage({ historyError: '加载失败' })
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('重试')
  })

  it('shows empty state when no history', () => {
    const wrapper = mountPage()
    expect(wrapper.text()).toContain('暂无对话历史')
  })

  it('renders history list items', () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'First Chat', updated_at: Date.now(), summary: 'Hello world', message_count: 3 },
      ],
    })
    expect(wrapper.text()).toContain('First Chat')
    expect(wrapper.text()).toContain('Hello world')
    expect(wrapper.text()).toContain('3 条消息')
  })

  it('calls restoreSession when item clicked', async () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'Chat', updated_at: Date.now(), summary: '', message_count: 1 },
      ],
    })
    const store = useSessionStore()

    await wrapper.find('[data-testid="history-item"]').trigger('click')
    expect(store.restoreSession).toHaveBeenCalledWith('s1')
  })

  it('calls deleteSession after confirm when delete chosen from menu', async () => {
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'Chat', updated_at: Date.now(), summary: '', message_count: 1 },
      ],
    })
    const store = useSessionStore()

    await wrapper.find('[data-testid="history-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="history-delete-btn"]').trigger('click')
    expect(confirmDialog).toHaveBeenCalledWith('确定删除该会话？', { title: '提示', kind: 'warning' })
    expect(store.deleteSession).toHaveBeenCalledWith('s1')
  })

  it('does not delete when confirm cancelled', async () => {
    vi.mocked(confirmDialog).mockResolvedValue(false)
    const wrapper = mountPage({
      historySessions: [
        { id: 's1', title: 'Chat', updated_at: Date.now(), summary: '', message_count: 1 },
      ],
    })
    const store = useSessionStore()

    await wrapper.find('[data-testid="history-menu-btn"]').trigger('click')
    await wrapper.find('[data-testid="history-delete-btn"]').trigger('click')
    await vi.waitFor(() => expect(confirmDialog).toHaveBeenCalled())
    expect(store.deleteSession).not.toHaveBeenCalled()
  })

  it('shows pagination when more than one page of sessions', () => {
    const sessions = Array.from({ length: 7 }, (_, i) => ({
      id: `s${i}`,
      title: `Chat ${i}`,
      updated_at: Date.now(),
      summary: 'x',
      message_count: 1,
    }))
    const wrapper = mountPage({ historySessions: sessions })
    expect(wrapper.text()).toContain('上一页')
    expect(wrapper.text()).toContain('下一页')
  })
})
