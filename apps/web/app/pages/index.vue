<script setup lang="ts">
import { defaultEffect, effects } from '~/utils/effects'

const effect = ref(defaultEffect.id)
const file = ref<File>()
const fields = ref<Record<string, string | number | boolean>>({ ...defaultEffect.defaults })
const dragging = ref(false)
const loading = ref(false)
const output = ref<{ url: string; extension: string }>()
const error = ref('')

const selected = computed(() => effects.find(item => item.id === effect.value) ?? defaultEffect)

watch(effect, () => { fields.value = { ...selected.value.defaults } })
onBeforeUnmount(() => output.value && URL.revokeObjectURL(output.value.url))

function choose(list: FileList | null) {
  const image = list?.[0]
  if (!image) return
  if (!image.type.startsWith('image/')) { error.value = 'Drop an image file.'; return }
  file.value = image
  error.value = ''
}

function drop(event: DragEvent) {
  dragging.value = false
  choose(event.dataTransfer?.files ?? null)
}

async function apply() {
  if (!file.value) { error.value = 'Drop an image first.'; return }
  error.value = ''
  loading.value = true
  try {
    const result = await processImageLocally(file.value, effect.value, fields.value)
    if (output.value) URL.revokeObjectURL(output.value.url)
    output.value = {
      url: URL.createObjectURL(new Blob([result.data], { type: result.mimeType })),
      extension: result.extension,
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <section>
      <h1>esmbot</h1>
      <label
        class="drop"
        :class="{ dragging, chosen: file }"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="drop"
      >
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" @change="choose(($event.target as HTMLInputElement).files)" />
        <span class="arrow">↓</span>
        <strong>{{ file?.name || 'Drag and drop, or click to browse' }}</strong>
        <small>{{ file ? 'Click or drop to replace' : 'PNG, JPEG, WebP, GIF or AVIF' }}</small>
      </label>

      <div class="controls">
        <label>
          <span>Effect</span>
          <select v-model="effect">
            <option v-for="item in effects" :key="item.id" :value="item.id">{{ item.label }}</option>
          </select>
        </label>

        <label v-for="field in selected.fields" :key="field.name" :class="{ check: field.type === 'checkbox' }">
          <template v-if="field.type === 'checkbox'">
            <input v-model="fields[field.name]" type="checkbox" />
            <span>{{ field.label }}</span>
          </template>
          <template v-else>
            <span>{{ field.label }}</span>
            <input v-model="fields[field.name]" type="text" :placeholder="field.placeholder" />
          </template>
        </label>

        <button :disabled="loading || !file" @click="apply">{{ loading ? 'Working…' : 'Apply effect' }}</button>
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <div v-if="output" class="result">
        <img :src="output.url" :alt="`${selected.label} output`" />
        <a :href="output.url" :download="`darwin-${effect}.${output.extension}`">Download</a>
      </div>
    </section>
  </main>
</template>

<style>
:root {
  color: #17212b;
  background: #f7f8fa;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
* { box-sizing: border-box; }
body { margin: 0; }
button, input, select { font: inherit; }
main { width: min(680px, calc(100% - 32px)); margin: auto; padding-bottom: 64px; }
header { height: 72px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #dfe3e8; }
header strong { font-size: 20px; letter-spacing: -.04em; }
header span, small { color: #68727d; font-size: 12px; }
section { padding-top: clamp(44px, 9vw, 84px); }
h1 { margin: 0; font-size: clamp(42px, 9vw, 68px); line-height: 1; letter-spacing: -.065em; }
section > p { margin: 14px 0 32px; color: #68727d; }
.drop { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px; border: 2px dashed #aeb7c1; border-radius: 16px; background: #fff; text-align: center; cursor: pointer; transition: border-color .15s, background .15s; }
.drop:hover, .drop.dragging { border-color: #276ef1; background: #f1f6ff; }
.drop.chosen { border-style: solid; }
.drop input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.arrow { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 8px; border-radius: 50%; background: #17212b; color: #fff; font-size: 22px; }
.drop strong { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.controls { display: grid; gap: 16px; margin-top: 24px; }
.controls label { display: grid; gap: 7px; }
.controls label > span { font-size: 12px; font-weight: 700; }
select, .controls input[type="text"] { width: 100%; height: 46px; padding: 0 12px; border: 1px solid #cbd1d8; border-radius: 8px; background: #fff; color: inherit; }
.check { display: flex !important; align-items: center; }
.check input { width: 18px; height: 18px; margin: 0; }
button, .result a { min-height: 48px; display: grid; place-items: center; border: 0; border-radius: 8px; background: #276ef1; color: #fff; font-weight: 700; text-decoration: none; cursor: pointer; }
button:disabled { opacity: .45; cursor: not-allowed; }
.error { margin: 16px 0 0; padding: 12px; border-radius: 8px; background: #fff0ee; color: #a62c20; font-size: 13px; }
.result { display: grid; gap: 16px; margin-top: 32px; padding-top: 32px; border-top: 1px solid #dfe3e8; }
.result img { display: block; max-width: 100%; max-height: 620px; margin: auto; border-radius: 8px; }
:focus-visible { outline: 3px solid #276ef1; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
