<script setup lang="ts">
const effect = ref('')
const url = ref('')
const file = ref<File | null>(null)
const json = ref('')
const loading = ref(false)
const out = ref('')
const err = ref('')

const { data } = await useFetch('/api/effects')
const effects = computed(() => data.value?.effects ?? [])
watchEffect(() => { if (!effect.value && effects.value.length) effect.value = effects.value[0] })

function pick(e: Event) {
  file.value = (e.target as HTMLInputElement).files?.[0] ?? null
}

async function submit() {
  err.value = ''
  out.value = ''
  if (!file.value && !url.value) { err.value = 'Provide a file or URL.'; return }
  loading.value = true
  try {
    const fd = new FormData()
    fd.append('effect', effect.value)
    if (file.value) fd.append('file', file.value)
    else fd.append('imageUrl', url.value)
    if (json.value.trim()) fd.append('params', json.value)
    const r = await fetch('/api/process', { method: 'POST', body: fd })
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
    out.value = URL.createObjectURL(await r.blob())
  } catch (e) {
    err.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <h1>darwin</h1>
    <p>esmBot media wrapper. <a href="/api/effects" target="_blank">effects list</a></p>

    <h2>Input</h2>
    <p>
      <label>File: <input type="file" accept="image/*" @change="pick" /></label>
    </p>
    <p>
      <label>URL: <input v-model="url" type="url" placeholder="https://example.com/image.png" size="50" /></label>
    </p>

    <h2>Effect</h2>
    <p>
      <select v-model="effect">
        <option v-for="e in effects" :key="e" :value="e">{{ e }}</option>
      </select>
    </p>
    <p>
      <label>Params:<br />
        <textarea v-model="json" rows="3" cols="50" placeholder='{"caption":"hello"}'></textarea>
      </label>
    </p>

    <p>
      <button :disabled="loading" @click="submit">{{ loading ? 'Processing...' : 'Apply' }}</button>
    </p>

    <p v-if="err" style="color:red">{{ err }}</p>

    <hr />
    <h2>Output</h2>
    <p v-if="!out">No output yet.</p>
    <p v-else>
      <img :src="out" :alt="effect" />
      <br />
      <a :href="out" :download="`${effect}.png`">Download</a>
    </p>
  </main>
</template>
