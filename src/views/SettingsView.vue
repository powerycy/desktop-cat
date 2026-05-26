<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { convertFileSrc } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { enable, disable } from '@tauri-apps/plugin-autostart'

interface Config {
  work_interval_minutes: number
  rest_duration_minutes: number
  rest_mode: string
  active_sprite_set: string
  autostart: boolean
  pet_scale: number
}

const config = ref<Config>({
  work_interval_minutes: 45,
  rest_duration_minutes: 5,
  rest_mode: 'A',
  active_sprite_set: 'default-cat',
  autostart: false,
  pet_scale: 1.0,
})

const spriteSets = ref<string[]>([])
const saveMsg = ref('')
const spritePreviewUrls = ref<Record<string, string>>({})
const dropdownOpen = ref(false)
// Upload state
const uploadSetName = ref('')
const uploadFiles = ref<File[]>([])
const uploadMsg = ref('')
const uploading = ref(false)

const REQUIRED_ACTIONS = [
  { key: 'walk',     label: '行走' },
  { key: 'sit_idle', label: '坐着待机' },
  { key: 'sleep',    label: '睡觉' },
  { key: 'sneak',    label: '入场潜行' },
  { key: 'rest',     label: '趴平静止' },
]

function findMissingActions(files: File[]): string[] {
  const names = files.map(f => f.name.toLowerCase())
  return REQUIRED_ACTIONS
    .filter(({ key }) =>
      !names.some(n => /^[a-z_]+_\d+\.png$/.test(n) && n.startsWith(`${key}_`))
    )
    .map(({ label }) => label)
}

async function loadPreviews() {
  const urls: Record<string, string> = {}
  for (const setName of spriteSets.value) {
    try {
      const dir = await invoke<string>('get_sprite_dir', { setName })
      const manifestUrl = convertFileSrc(`${dir}/manifest.json`)
      const resp = await fetch(manifestUrl)
      if (!resp.ok) continue
      const manifest = await resp.json()
      // Pick the first frame of sit_idle as preview
      const entry = manifest.sit_idle ?? manifest.sit ?? manifest.idle ?? manifest.walk
      if (Array.isArray(entry) && entry.length > 0) {
        urls[setName] = convertFileSrc(`${dir}/${entry[0]}`)
      }
    } catch { /* skip */ }
  }
  spritePreviewUrls.value = urls
}

function selectSprite(name: string) {
  config.value.active_sprite_set = name
  dropdownOpen.value = false
}

function onClickOutside(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('.sprite-picker')
  if (!el) dropdownOpen.value = false
}

onMounted(async () => {
  document.addEventListener('click', onClickOutside)
  try {
    config.value = await invoke<Config>('get_config')
    spriteSets.value = await invoke<string[]>('get_sprite_sets')
    await loadPreviews()
  } catch (e) {
    console.error(e)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

async function save() {
  try {
    await invoke('save_config', { config: config.value })
    await emit('config-changed')
    saveMsg.value = '已保存！'
    setTimeout(() => { saveMsg.value = '' }, 2000)
  } catch (e) {
    saveMsg.value = '保存失败: ' + e
    return
  }
  try {
    if (config.value.autostart) {
      await enable()
    } else {
      await disable()
    }
  } catch {
    // autostart may fail in dev mode, ignore
  }
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  uploadFiles.value = input.files ? Array.from(input.files) : []
  uploadMsg.value = ''
}

async function uploadSprites() {
  const name = uploadSetName.value.trim()
  if (!name) { uploadMsg.value = '请先输入形象名称'; return }
  if (uploadFiles.value.length === 0) { uploadMsg.value = '请选择 PNG 文件'; return }

  const missing = findMissingActions(uploadFiles.value)
  if (missing.length > 0) {
    uploadMsg.value = `缺少以下动作：${missing.join('、')}`
    return
  }

  uploading.value = true
  uploadMsg.value = ''
  try {
    const files = await Promise.all(
      uploadFiles.value.map(async (f) => {
        const buf = await f.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        return { name: f.name, data: btoa(binary) }
      })
    )
    await invoke('import_sprite_set', { setName: name, files })
    // Refresh sprite sets list and select new set
    spriteSets.value = await invoke<string[]>('get_sprite_sets')
    config.value.active_sprite_set = name
    await loadPreviews()
    uploadMsg.value = `"${name}" 导入成功！`
    uploadSetName.value = ''
    uploadFiles.value = []
    // Reset file input
    const input = document.getElementById('sprite-file-input') as HTMLInputElement
    if (input) input.value = ''
  } catch (e) {
    uploadMsg.value = '导入失败: ' + e
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <div class="settings">
    <h1>⚙️ 设置</h1>

    <div class="sections">
      <section>
        <h2>休息提醒</h2>
        <div class="field">
          <label>工作时长（分钟）</label>
          <input type="number" v-model.number="config.work_interval_minutes" min="1" max="120" />
        </div>
        <div class="field">
          <label>休息时长（分钟）</label>
          <input type="number" v-model.number="config.rest_duration_minutes" min="1" max="30" />
        </div>
        <p class="tip-inline">💡 休息全屏期间按 <kbd>Alt+F4</kbd> 可强制退出</p>
      </section>

      <section>
        <h2>桌宠外观</h2>
        <div class="field">
          <label>当前形象</label>
          <div class="sprite-picker">
            <div class="sprite-picker-selected" @click="dropdownOpen = !dropdownOpen">
              <img v-if="spritePreviewUrls[config.active_sprite_set]"
                   :src="spritePreviewUrls[config.active_sprite_set]"
                   class="sprite-thumb" />
              <span class="sprite-thumb-placeholder" v-else>?</span>
              <span>{{ config.active_sprite_set }}</span>
              <span class="sprite-picker-arrow">{{ dropdownOpen ? '\u25B2' : '\u25BC' }}</span>
            </div>
            <div v-if="dropdownOpen" class="sprite-picker-dropdown">
              <div v-for="s in spriteSets" :key="s"
                   class="sprite-picker-option"
                   :class="{ active: s === config.active_sprite_set }"
                   @click="selectSprite(s)">
                <img v-if="spritePreviewUrls[s]"
                     :src="spritePreviewUrls[s]"
                     class="sprite-thumb" />
                <span class="sprite-thumb-placeholder" v-else>?</span>
                <span>{{ s }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="field">
          <label>大小缩放</label>
          <input type="range" v-model.number="config.pet_scale" min="0.5" max="3" step="0.1" />
          <span>{{ config.pet_scale.toFixed(1) }}x</span>
        </div>
      </section>

      <section>
        <h2>系统</h2>
        <div class="field">
          <label class="checkbox">
            <input type="checkbox" v-model="config.autostart" />
            <span>开机自动启动</span>
          </label>
        </div>
      </section>

      <section class="sprite-guide">
        <h2>📦 自定义形象指南</h2>
        <p>所有图片要求：PNG 透明背景，仅支持单帧文件上传</p>
        <p>命名规则：<code>动作名_序号.png</code>，例如 <code>walk_01.png</code>、<code>walk_02.png</code>、<code>walk_03.png</code> ……</p>

        <table class="sprite-table">
          <thead><tr><th>动作</th><th>文件名</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td>行走</td><td><code>walk_XX.png</code></td><td>桌面漫步</td></tr>
            <tr><td>坐下过渡 <span class="optional-tag">可选</span></td><td><code>sit_XX.png</code></td><td>站→坐，单次播放；缺省时直接进入坐姿</td></tr>
            <tr><td>坐着待机</td><td><code>sit_idle_XX.png</code></td><td>坐姿循环</td></tr>
            <tr><td>睡觉</td><td><code>sleep_XX.png</code></td><td>蜷缩呼吸循环</td></tr>
            <tr class="rest-row"><td>入场潜行</td><td><code>sneak_XX.png</code></td><td>休息时从右侧入场</td></tr>
            <tr class="rest-row"><td>趴下过渡 <span class="optional-tag">可选</span></td><td><code>liedown_XX.png</code></td><td>休息时到达中央后趴下；缺省时直接趴平</td></tr>
            <tr class="rest-row"><td>趴平静止</td><td><code>rest_XX.png</code></td><td>休息时极慢呼吸</td></tr>
          </tbody>
        </table>

        <p class="tip-inline">💡 帧数不限，系统根据同一动作下的文件数量自动识别</p>
        <div class="guide-diagram">
          <img src="../assets/sprite-guide.png" alt="动作示意图" />
        </div>
      </section>

      <section class="upload-section">
        <h2>⬆️ 上传自定义形象</h2>
        <p class="upload-hint">必需 5 种动作：行走、坐着待机、睡觉、入场潜行、趴平静止 ｜ 可选：坐下过渡、趴下过渡</p>
        <div class="field">
          <label>形象名称</label>
          <input
            type="text"
            v-model="uploadSetName"
            placeholder="my-cat"
            style="width: 140px"
          />
        </div>
        <div class="field">
          <label>选择 PNG</label>
          <input
            id="sprite-file-input"
            type="file"
            accept=".png"
            multiple
            @change="onFilePick"
          />
        </div>
        <div v-if="uploadFiles.length > 0" class="upload-preview">
          已选 {{ uploadFiles.length }} 个文件：{{ uploadFiles.map(f => f.name).join('、') }}
        </div>
        <button class="btn-upload" :disabled="uploading" @click="uploadSprites">
          {{ uploading ? '导入中…' : '导入形象' }}
        </button>
        <span v-if="uploadMsg" :class="uploadMsg.includes('失败') ? 'upload-err' : 'upload-ok'">
          {{ uploadMsg }}
        </span>
      </section>
    </div>

    <div class="save-bar">
      <button class="btn-primary" @click="save">保存设置</button>
      <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: system-ui, sans-serif;
  color: #333;
  background: #fff;
}

h1 { font-size: 20px; padding: 16px 20px 12px; border-bottom: 1px solid #eee; margin: 0; }

.sections {
  flex: 1;
  overflow-y: auto;
  padding: 0 20px;
}

section {
  padding: 14px 0;
  border-bottom: 1px solid #eee;
}

h2 { font-size: 13px; color: #888; margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

.field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.field label:first-child {
  width: 120px;
  flex-shrink: 0;
  font-size: 14px;
}

input[type="number"], select {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 14px;
  width: 90px;
}

select { width: 150px; }
input[type="range"] { width: 110px; }

.checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px; }

.save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-top: 1px solid #eee;
  background: #fff;
}

.btn-primary {
  background: #4f6ef7;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 9px 28px;
  font-size: 15px;
  cursor: pointer;
}

.btn-primary:hover { background: #3a5ae0; }

.save-msg { color: #4caf50; font-size: 14px; }

.sprite-guide { border-bottom: none; }
.sprite-guide p { font-size: 13px; line-height: 1.6; color: #555; margin-bottom: 6px; }
.sprite-guide code { background: #eee; padding: 1px 5px; border-radius: 3px; font-family: monospace; }
.sprite-table { width: 100%; border-collapse: collapse; font-size: 12px; margin: 8px 0; }
.sprite-table th { background: #f5f5f5; padding: 5px 8px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #e0e0e0; }
.sprite-table td { padding: 4px 8px; border-bottom: 1px solid #f0f0f0; color: #444; }
.sprite-table .rest-row td { background: #fffbe6; }
.tip { margin-top: 8px; background: #fffbe6; padding: 8px 10px; border-radius: 6px; }
.tip em { font-style: normal; color: #666; font-size: 12px; }
.tip-inline { font-size: 12px; color: #aaa; margin-top: 4px; }
.tip-inline kbd { background: #f0f0f0; border: 1px solid #ccc; border-radius: 3px; padding: 1px 5px; font-size: 11px; font-family: monospace; }

.upload-section { border-bottom: none; }
.upload-hint { font-size: 12px; color: #888; margin: 0 0 10px; }
.upload-preview { font-size: 12px; color: #666; margin: 4px 0 10px; line-height: 1.5; word-break: break-all; }

.sprite-picker {
  position: relative;
  width: 200px;
}
.sprite-picker-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 10px;
  cursor: pointer;
  background: #fff;
  font-size: 14px;
}
.sprite-picker-selected:hover { border-color: #bbb; }
.sprite-picker-arrow { margin-left: auto; font-size: 10px; color: #999; }
.sprite-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 4px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  z-index: 100;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
}
.sprite-picker-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.sprite-picker-option:hover { background: #f3f4ff; }
.sprite-picker-option.active { background: #e8ebff; font-weight: 600; }
.sprite-thumb {
  width: 36px;
  height: 36px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 4px;
  background: #f8f8f8;
  flex-shrink: 0;
}
.sprite-thumb-placeholder {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f0f0;
  border-radius: 4px;
  color: #ccc;
  font-size: 16px;
  flex-shrink: 0;
}
.btn-upload {
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 7px 20px;
  font-size: 14px;
  cursor: pointer;
}
.btn-upload:hover:not(:disabled) { background: #219a52; }
.btn-upload:disabled { opacity: 0.5; cursor: not-allowed; }
.upload-ok { color: #4caf50; font-size: 13px; margin-left: 10px; }
.upload-err { color: #e53935; font-size: 13px; margin-left: 10px; }
.optional-tag { display: inline-block; font-size: 10px; color: #ff9800; background: #fff3e0; padding: 1px 5px; border-radius: 3px; margin-left: 4px; vertical-align: middle; }
.guide-diagram { margin-top: 12px; text-align: center; }
.guide-diagram img { max-width: 100%; border-radius: 8px; border: 1px solid #eee; }
</style>
