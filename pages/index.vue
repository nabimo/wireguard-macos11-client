<script setup lang="ts">
import { ref, onMounted } from 'vue'

type Profile = {
  name: string
  fileName: string
  path: string
}

const profiles = ref<Profile[]>([])
const selected = ref<string | null>(null)
const connected = ref(false)
const busy = ref(false)
const status = ref<any>(null)
const error = ref('')
const message = ref('')

const api = () => (window as any).wg

async function refresh() {
  profiles.value = await api().profiles()
  status.value = await api().status()
  connected.value = status.value.connected
}

async function importFiles() {
  error.value = ''
  message.value = ''

  try {
    const result = await api().import()

    if (result?.errors?.length) {
      error.value = result.errors.join('\n')
    }

    if (result?.imported) {
      message.value = `${result.imported} profile(s) imported.`
    } else if (!result?.errors?.length && !result?.canceled) {
      error.value = 'No valid WireGuard profiles found in the selected file.'
    }

    await refresh()
  } catch (e: any) {
    error.value = e?.message || 'Import failed.'
  }
}

async function connect() {
  if (!selected.value) return
  busy.value = true
  error.value = ''
  const result = await api().connect(selected.value)
  if (!result.ok) error.value = result.error || 'Connection failed'
  await refresh()
  busy.value = false
}

async function disconnect() {
  busy.value = true
  error.value = ''
  const result = await api().disconnect()
  if (!result.ok) error.value = result.error || 'Disconnect failed'
  await refresh()
  busy.value = false
}

onMounted(refresh)
</script>

<template>
  <main class="shell">
    <section class="card">
      <div class="header">
        <div>
          <h1>WireGuard Mac</h1>
          <p>Simple client for macOS 11+</p>
        </div>
        <button class="secondary" @click="importFiles">Import .conf / .zip</button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="message" class="message">{{ message }}</div>

      <label>Server</label>
      <select v-model="selected" :disabled="busy || connected">
        <option :value="null">Select a profile</option>
        <option v-for="p in profiles" :key="p.path" :value="p.path">
          {{ p.name }}
        </option>
      </select>

      <div class="state" :class="{ on: connected }">
        <span class="dot"></span>
        {{ connected ? 'CONNECTED' : 'DISCONNECTED' }}
      </div>

      <button v-if="!connected" class="connect" :disabled="!selected || busy" @click="connect">
        {{ busy ? 'CONNECTING…' : 'CONNECT' }}
      </button>
      <button v-else class="disconnect" :disabled="busy" @click="disconnect">
        {{ busy ? 'DISCONNECTING…' : 'DISCONNECT' }}
      </button>

      <div class="stats" v-if="status">
        <div><span>Interface</span><strong>{{ status.interface || '—' }}</strong></div>
        <div><span>Profiles</span><strong>{{ profiles.length }}</strong></div>
      </div>

      <p class="hint">
        Import a single WireGuard <code>.conf</code> or a <code>.zip</code> containing multiple
        <code>.conf</code> files. Nested folders inside ZIPs are supported.
      </p>
    </section>
  </main>
</template>

<style>
*{box-sizing:border-box} body{margin:0;background:#101114;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif}
.shell{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:430px;max-width:100%;background:#191a1f;border:1px solid #2b2d34;border-radius:22px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.35)}
.header{display:flex;justify-content:space-between;gap:16px;align-items:start}h1{font-size:22px;margin:0 0 5px}p{margin:0;color:#9b9da6;font-size:13px}
label{display:block;color:#9b9da6;font-size:12px;margin:28px 0 8px}select{width:100%;background:#111216;color:#fff;border:1px solid #33363e;border-radius:12px;padding:13px;font-size:14px}
button{border:0;border-radius:12px;padding:12px 15px;font-weight:600;cursor:pointer}.secondary{background:#2b2d34;color:#fff;font-size:12px}.connect,.disconnect{width:100%;margin-top:20px;background:#fff;color:#111;padding:14px}.disconnect{background:#2b2d34;color:#fff}.connect:disabled,.disconnect:disabled{opacity:.45;cursor:default}
.state{margin:28px auto 0;width:max-content;display:flex;align-items:center;gap:8px;color:#9b9da6;font-size:13px;font-weight:700}.state.on{color:#7ee787}.dot{width:9px;height:9px;border-radius:50%;background:#777}.on .dot{background:#7ee787}
.stats{display:flex;gap:10px;margin-top:20px}.stats>div{flex:1;background:#111216;border-radius:12px;padding:12px}.stats span{display:block;color:#777b86;font-size:11px}.stats strong{display:block;margin-top:5px;font-size:13px}
.error,.message{margin-top:16px;border-radius:10px;padding:10px;font-size:12px}.error{background:#3a1e22;color:#ffb4b4}.message{background:#1c3222;color:#b7efc2}.hint{margin-top:20px;line-height:1.6}code{background:#272930;padding:2px 5px;border-radius:5px}
</style>