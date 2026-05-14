import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import MoveCopyDialog from '@/components/MoveCopyDialog.vue'
import { useKnowledgeBaseStore } from '@/stores/knowledgeBase'
import { setBackend, resetBackend, FakeBackendTransport } from '@goferbot/backend-adapters'
import { TeleportStub, DialogPortalStub } from '../stubs'

describe('MoveCopyDialog', () => {
  let fakeBackend: FakeBackendTransport

  beforeEach(() => {
    fakeBackend = new FakeBackendTransport()
    fakeBackend.when('GET', '/knowledge-bases/kb1/files').respond(200, { items: [] })
    setBackend(fakeBackend)
  })

  afterEach(() => {
    resetBackend()
  })

  function mountDialog(props: { visible: boolean; mode: 'move' | 'copy'; sourceKbId: string; sourcePath: string }) {
    const pinia = createTestingPinia({
      stubActions: false,
      initialState: {
        knowledgeBase: {
          knowledgeBases: [
            { id: 'kb1', name: 'KB1', path: '/a', created_at: 1, deleted_at: null, is_pinned: 0, sort_order: 0, icon: 'mdi-database' },
          ],
        },
      },
    })
    setActivePinia(pinia)

    return mount(MoveCopyDialog, {
      props,
      global: {
        plugins: [pinia],
        stubs: {
          Teleport: TeleportStub,
          DialogPortal: DialogPortalStub,
        },
      },
    })
  }

  it('shows move title in move mode', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await flushPromises()
    expect(wrapper.text()).toContain('移动到')
  })

  it('shows copy title in copy mode', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'copy', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await flushPromises()
    expect(wrapper.text()).toContain('复制到')
  })

  it('emits close on cancel button click', async () => {
    const wrapper = mountDialog({ visible: true, mode: 'move', sourceKbId: 'kb1', sourcePath: 'file.txt' })
    await flushPromises()
    const buttons = wrapper.findAll('button')
    const cancelBtn = buttons.find((b) => b.text() === '取消')
    expect(cancelBtn).toBeDefined()
    await cancelBtn!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
