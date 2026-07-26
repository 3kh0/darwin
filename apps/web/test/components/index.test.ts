// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import IndexPage from '../../app/pages/index.vue'

describe('index page', () => {
  it('centers the experience on one drag-and-drop target', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('h1').text()).toBe('Drop an image.')
    expect(wrapper.find('.drop').exists()).toBe(true)
    expect(wrapper.find('input[type="url"]').exists()).toBe(false)
  })

  it('accepts every supported image input format', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('input[type="file"]').attributes('accept')).toBe(
      'image/png,image/jpeg,image/webp,image/gif,image/avif',
    )
  })

  it('includes the font and template effects', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const labels = wrapper.findAll('select option').map(option => option.text())
    expect(labels).toContain('Caption')
    expect(labels).toContain('Uncanny')
    expect(labels).toContain('GameXplain')
    expect(labels).toContain('Shutterstock watermark')
  })

  it('shows simple fields for effects that need text', async () => {
    const wrapper = await mountSuspended(IndexPage)
    await wrapper.find('select').setValue('meme')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(2)
  })

  it('requires an image before processing', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })
})
