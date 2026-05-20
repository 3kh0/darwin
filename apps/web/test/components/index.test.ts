// @vitest-environment nuxt
import { describe, it, expect } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import IndexPage from '../../app/pages/index.vue'

mockNuxtImport('useFetch', () => () => ({
  data: { value: { effects: ['blur', 'caption', 'flip'] } },
  pending: { value: false },
  error: { value: null },
}))

describe('index page', () => {
  it('renders the darwin heading', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('h1').text()).toBe('darwin')
  })

  it('links to the effects API', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('a[href="/api/effects"]').exists()).toBe(true)
  })

  it('renders a file input accepting images', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const input = wrapper.find('input[type="file"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('accept')).toBe('image/*')
  })

  it('renders a URL input', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('input[type="url"]').exists()).toBe(true)
  })

  it('renders a params textarea', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })

  it('renders the effects select with mocked options', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const labels = wrapper.findAll('select option').map(o => o.text())
    expect(labels).toContain('blur')
    expect(labels).toContain('caption')
    expect(labels).toContain('flip')
  })

  it('pre-selects the first effect', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const select = wrapper.find('select').element as HTMLSelectElement
    expect(select.value).toBe('blur')
  })

  it('renders the Apply button in an enabled state', async () => {
    const wrapper = await mountSuspended(IndexPage)
    const btn = wrapper.find('button')
    expect(btn.text()).toBe('Apply')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('shows "No output yet." before any submission', async () => {
    const wrapper = await mountSuspended(IndexPage)
    expect(wrapper.text()).toContain('No output yet.')
  })

  it('shows an error when Apply is clicked without a file or URL', async () => {
    const wrapper = await mountSuspended(IndexPage)
    await wrapper.find('button').trigger('click')
    expect(wrapper.text()).toContain('Provide a file or URL.')
  })
})
