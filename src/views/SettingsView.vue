<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { enable, disable } from '@tauri-apps/plugin-autostart'
import { useLocaleStore } from '../stores/localeStore'
import pandaGuardianUrl from '../assets/panda-guardian.png'
import type { LocaleCode } from '../i18n'
import {
  REQUIRED_SPRITE_ACTION_GROUPS,
  findMissingRequiredActions,
} from '../utils/spriteActions'

interface Config {
  work_interval_minutes: number
  rest_duration_minutes: number
  rest_mode: string
  active_sprite_set: string
  autostart: boolean
  pet_scale: number
}

const localeStore = useLocaleStore()

const config = ref<Config>({
  work_interval_minutes: 45,
  rest_duration_minutes: 5,
  rest_mode: 'A',
  active_sprite_set: '暴躁喵',
  autostart: false,
  pet_scale: 1.0,
})

const spriteSets = ref<string[]>([])
const saveMsg = ref('')
const spritePreviewUrls = ref<Record<string, string>>({})
const dropdownOpen = ref(false)
const uploadSetName = ref('')
const uploadFiles = ref<File[]>([])
const uploadMsg = ref('')
const uploading = ref(false)
const aiSetName = ref('')
const aiPrompt = ref('')
const geminiApiKey = ref('')
const aiMsg = ref('')
const generatingAiSprite = ref(false)

const currentSpritePreview = computed(() => spritePreviewUrls.value[config.value.active_sprite_set])
const requiredActionList = computed(() => REQUIRED_SPRITE_ACTION_GROUPS
  .map(({ label }) => localeStore.locale === 'zh-CN' ? label.zh : label.en)
  .join(' / '))

function tr(key: string, replacements: Record<string, string | number> = {}) {
  return Object.entries(replacements).reduce(
    (message, [name, value]) => message.replace(`{${name}}`, String(value)),
    localeStore.t(key),
  )
}

function displaySpriteName(name: string) {
  if (localeStore.locale === 'zh-CN') return name
  const names: Record<string, string> = {
    '暴躁喵': 'Grumpy Cat',
    '爱坤': 'Aikun',
  }
  return names[name] ?? name
}

function findMissingActions(files: File[]): string[] {
  return findMissingRequiredActions(files, localeStore.locale)
}

async function loadPreviews() {
  const urls: Record<string, string> = {}
  for (const setName of spriteSets.value) {
    try {
      const dir = await invoke<string>('get_sprite_dir', { setName })
      const resp = await fetch(convertFileSrc(`${dir}/manifest.json`))
      if (!resp.ok) continue
      const manifest = await resp.json()
      const entry = manifest.sit ?? manifest.sit_idle ?? manifest.idle ?? manifest.walk
      if (Array.isArray(entry) && entry.length > 0) {
        urls[setName] = convertFileSrc(`${dir}/${entry[0]}`)
      }
    } catch {
      // Skip unavailable previews.
    }
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

function updateLocale(event: Event) {
  localeStore.setLocale((event.target as HTMLSelectElement).value as LocaleCode)
}

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(async () => {
  document.addEventListener('click', onClickOutside)
  try {
    config.value = await invoke<Config>('get_config')
    spriteSets.value = (await invoke<string[]>('get_sprite_sets')).filter(name => name !== 'default-cat')
    if (config.value.active_sprite_set === 'default-cat' || !spriteSets.value.includes(config.value.active_sprite_set)) {
      config.value.active_sprite_set = spriteSets.value[0] ?? '暴躁喵'
    }
    await loadPreviews()
  } catch (e) {
    spriteSets.value = ['暴躁喵', '爱坤']
    if (config.value.active_sprite_set === 'default-cat') config.value.active_sprite_set = '暴躁喵'
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
    saveMsg.value = `${localeStore.t('settings.saved')}!`
    setTimeout(() => { saveMsg.value = '' }, 2000)
  } catch (e) {
    saveMsg.value = String(e)
    return
  }

  try {
    if (config.value.autostart) await enable()
    else await disable()
  } catch {
    // Autostart may fail in dev mode.
  }
}

function onFilePick(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = input.files ? Array.from(input.files) : []
  const existing = new Set(uploadFiles.value.map(file => file.name))
  uploadFiles.value = [
    ...uploadFiles.value,
    ...picked.filter(file => !existing.has(file.name)),
  ]
  uploadMsg.value = ''
  input.value = ''
}

async function uploadSprites() {
  const name = uploadSetName.value.trim()
  if (!name) {
    uploadMsg.value = localeStore.t('settings.uploadNeedName')
    return
  }
  if (uploadFiles.value.length === 0) {
    uploadMsg.value = localeStore.t('settings.uploadNeedFiles')
    return
  }

  const missing = findMissingActions(uploadFiles.value)
  if (missing.length > 0) {
    uploadMsg.value = tr('settings.uploadMissing', { actions: missing.join(', ') })
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
      }),
    )
    await invoke('import_sprite_set', { setName: name, files })
    spriteSets.value = await invoke<string[]>('get_sprite_sets')
    config.value.active_sprite_set = name
    await loadPreviews()
    uploadMsg.value = tr('settings.uploadSuccess', { name })
    uploadSetName.value = ''
    uploadFiles.value = []
    const input = document.getElementById('sprite-file-input') as HTMLInputElement
    if (input) input.value = ''
  } catch (e) {
    uploadMsg.value = tr('settings.uploadFailed', { error: String(e) })
  } finally {
    uploading.value = false
  }
}

async function generateAiSprite() {
  const setName = aiSetName.value.trim() || `AI形象_${Date.now()}`
  const prompt = aiPrompt.value.trim()
  const apiKey = geminiApiKey.value.trim()

  if (!apiKey || !prompt) {
    aiMsg.value = localeStore.t('settings.aiNeedInput')
    return
  }

  generatingAiSprite.value = true
  aiMsg.value = ''
  try {
    const result = await invoke<{ set_name: string }>('generate_ai_sprite_set', {
      request: {
        api_key: apiKey,
        set_name: setName,
        prompt,
      },
    })
    spriteSets.value = await invoke<string[]>('get_sprite_sets')
    config.value.active_sprite_set = result.set_name
    await loadPreviews()
    await save()
    aiSetName.value = ''
    aiPrompt.value = ''
    aiMsg.value = tr('settings.aiSuccess', { name: result.set_name })
  } catch (e) {
    aiMsg.value = tr('settings.aiFailed', { error: String(e) })
  } finally {
    generatingAiSprite.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <aside class="settings-sidebar">
      <div class="brand-block">
        <div class="brand-icon">
          <img :src="pandaGuardianUrl" alt="" />
        </div>
        <div>
          <h1>{{ localeStore.t('settings.title') }}</h1>
          <p>{{ localeStore.t('settings.subtitle') }}</p>
        </div>
      </div>

      <nav class="side-nav">
        <button type="button" @click="scrollToSection('general')">{{ localeStore.t('settings.general') }}</button>
        <button type="button" @click="scrollToSection('focus')">{{ localeStore.t('settings.focusAndBreak') }}</button>
        <button type="button" @click="scrollToSection('ai-sprite')">{{ localeStore.t('settings.aiSprite') }}</button>
        <button type="button" @click="scrollToSection('appearance')">{{ localeStore.t('settings.appearance') }}</button>
        <button type="button" @click="scrollToSection('sprites')">{{ localeStore.t('settings.customSprites') }}</button>
      </nav>
    </aside>

    <main class="settings-main">
      <section id="general" class="settings-section">
        <div class="section-heading">
          <span class="section-icon">Aa</span>
          <div>
            <h2>{{ localeStore.t('settings.general') }}</h2>
            <p>{{ localeStore.t('settings.languageHint') }}</p>
          </div>
        </div>

        <div class="setting-row">
          <div>
            <label>{{ localeStore.t('settings.language') }}</label>
            <p>{{ localeStore.t('settings.languageHint') }}</p>
          </div>
          <select class="control language-select" :value="localeStore.locale" @change="updateLocale">
            <option v-for="option in localeStore.localeOptions" :key="option.code" :value="option.code">
              {{ option.label }}
            </option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <label>{{ localeStore.t('settings.autostart') }}</label>
            <p>{{ localeStore.t('settings.system') }}</p>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="config.autostart" />
            <span />
          </label>
        </div>
      </section>

      <section id="focus" class="settings-section">
        <div class="section-heading">
          <span class="section-icon">25</span>
          <div>
            <h2>{{ localeStore.t('settings.focusAndBreak') }}</h2>
            <p>{{ localeStore.t('settings.restHint') }}</p>
          </div>
        </div>

        <div class="number-grid">
          <label class="number-card">
            <span>{{ localeStore.t('settings.workMinutes') }}</span>
            <input type="number" v-model.number="config.work_interval_minutes" min="1" max="120" />
            <em>{{ localeStore.t('settings.minutes') }}</em>
          </label>
          <label class="number-card">
            <span>{{ localeStore.t('settings.breakMinutes') }}</span>
            <input type="number" v-model.number="config.rest_duration_minutes" min="1" max="30" />
            <em>{{ localeStore.t('settings.minutes') }}</em>
          </label>
        </div>
      </section>

      <section id="ai-sprite" class="settings-section ai-sprite-section">
        <div class="section-heading">
          <span class="section-icon">AI</span>
          <div>
            <h2>{{ localeStore.t('settings.aiSprite') }}</h2>
            <p>{{ localeStore.t('settings.aiSpriteCopy') }}</p>
          </div>
        </div>

        <div class="ai-grid">
          <label>
            <span>{{ localeStore.t('settings.geminiApiKey') }}</span>
            <input
              class="control"
              type="password"
              v-model="geminiApiKey"
              :placeholder="localeStore.t('settings.geminiApiKeyPlaceholder')"
            />
          </label>
          <label>
            <span>{{ localeStore.t('settings.aiSpriteName') }}</span>
            <input
              class="control"
              type="text"
              v-model="aiSetName"
              :placeholder="localeStore.t('settings.aiSpriteNamePlaceholder')"
            />
          </label>
          <label class="wide">
            <span>{{ localeStore.t('settings.aiSpritePrompt') }}</span>
            <textarea
              class="control"
              v-model="aiPrompt"
              :placeholder="localeStore.t('settings.aiSpritePromptPlaceholder')"
            />
          </label>
        </div>

        <div class="upload-actions">
          <button class="secondary-button solid" type="button" :disabled="generatingAiSprite" @click="generateAiSprite">
            {{ generatingAiSprite ? localeStore.t('settings.generatingAiSprite') : localeStore.t('settings.generateAiSprite') }}
          </button>
          <span v-if="aiMsg" :class="aiMsg.includes('失败') || aiMsg.includes('failed') || aiMsg.includes('required') ? 'upload-err' : 'upload-ok'">
            {{ aiMsg }}
          </span>
        </div>
      </section>

      <section id="appearance" class="settings-section">
        <div class="section-heading">
          <span class="section-icon">◐</span>
          <div>
            <h2>{{ localeStore.t('settings.appearance') }}</h2>
            <p>{{ localeStore.t('settings.currentSprite') }}: {{ displaySpriteName(config.active_sprite_set) }}</p>
          </div>
        </div>

        <div class="appearance-layout">
          <div class="sprite-preview">
            <img v-if="currentSpritePreview" :src="currentSpritePreview" alt="" />
            <span v-else>?</span>
          </div>
          <div class="appearance-controls">
            <div class="setting-row compact">
              <div>
                <label>{{ localeStore.t('settings.currentSprite') }}</label>
                <p>{{ displaySpriteName(config.active_sprite_set) }}</p>
              </div>
              <div class="sprite-picker">
                <button class="control sprite-picker-selected" type="button" @click="dropdownOpen = !dropdownOpen">
                  <span>{{ displaySpriteName(config.active_sprite_set) }}</span>
                  <span>{{ dropdownOpen ? '▲' : '▼' }}</span>
                </button>
                <div v-if="dropdownOpen" class="sprite-picker-dropdown">
                  <button
                    v-for="s in spriteSets"
                    :key="s"
                    type="button"
                    class="sprite-picker-option"
                    :class="{ active: s === config.active_sprite_set }"
                    @click="selectSprite(s)"
                  >
                    <img v-if="spritePreviewUrls[s]" :src="spritePreviewUrls[s]" alt="" />
                    <span>{{ displaySpriteName(s) }}</span>
                  </button>
                </div>
              </div>
            </div>

            <label class="scale-control">
              <span>{{ localeStore.t('settings.petScale') }}</span>
              <input type="range" v-model.number="config.pet_scale" min="0.5" max="3" step="0.1" />
              <strong>{{ config.pet_scale.toFixed(1) }}x</strong>
            </label>
          </div>
        </div>
      </section>

      <section id="sprites" class="settings-section sprite-section">
        <div class="section-heading">
          <span class="section-icon">PNG</span>
          <div>
            <h2>{{ localeStore.t('settings.customSprites') }}</h2>
            <p>{{ localeStore.t('settings.spriteGuideCopy') }}</p>
          </div>
        </div>

        <div class="sprite-guide-panel">
          <div class="guide-copy">
            <h3>{{ localeStore.t('settings.spriteGuide') }}</h3>
            <p>{{ localeStore.t('settings.requiredActions') }}: {{ requiredActionList }}</p>
            <p>{{ localeStore.t('settings.optionalActions') }}</p>
          </div>
        </div>

        <div class="upload-grid">
          <label>
            <span>{{ localeStore.t('settings.uploadName') }}</span>
            <input class="control" type="text" v-model="uploadSetName" placeholder="my-guardian" />
          </label>
          <label>
            <span>{{ localeStore.t('settings.choosePng') }}</span>
            <span class="file-picker control">
              <span>{{ localeStore.t('settings.choosePng') }}</span>
              <strong>
                {{ uploadFiles.length > 0 ? tr('settings.selectedFiles', { count: uploadFiles.length }) : localeStore.t('settings.noFilesSelected') }}
              </strong>
              <input id="sprite-file-input" type="file" accept=".png" multiple @change="onFilePick" />
            </span>
          </label>
        </div>

        <p v-if="uploadFiles.length > 0" class="upload-preview">
          {{ localeStore.t('settings.selectedFileNames') }}:
          {{ uploadFiles.map(file => file.name).join(', ') }}
        </p>

        <div class="upload-actions">
          <button class="secondary-button solid" type="button" :disabled="uploading" @click="uploadSprites">
            {{ uploading ? localeStore.t('settings.importing') : localeStore.t('settings.importSprites') }}
          </button>
          <span v-if="uploadMsg" :class="uploadMsg.includes('失败') || uploadMsg.includes('failed') ? 'upload-err' : 'upload-ok'">
            {{ uploadMsg }}
          </span>
        </div>
      </section>
    </main>

    <footer class="save-bar">
      <span v-if="saveMsg" class="save-msg">{{ saveMsg }}</span>
      <button class="primary-button" type="button" @click="save">{{ localeStore.t('settings.saveSettings') }}</button>
    </footer>
  </div>
</template>

<style scoped>
.settings-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: #f6f7f9;
  color: #20232a;
  font-family: system-ui, sans-serif;
  overscroll-behavior: contain;
}

.settings-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: 22px 18px;
  background: #ffffff;
  border-right: 1px solid #e6e8ee;
}

.brand-block {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.brand-icon {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  overflow: hidden;
  border-radius: 8px;
  background: #f5f7fb;
  border: 1px solid #e3e7ef;
}

.brand-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.brand-block h1 {
  margin: 0;
  font-size: 20px;
}

.brand-block p {
  margin: 5px 0 0;
  color: #687184;
  font-size: 12px;
  line-height: 1.45;
}

.side-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.side-nav button {
  color: #444b5a;
  border: 0;
  border-radius: 8px;
  padding: 9px 10px;
  background: transparent;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.side-nav button:hover {
  background: #f0f3f8;
  color: #1f3f8b;
}

.settings-main {
  box-sizing: border-box;
  padding: 22px 22px 88px;
  max-width: 920px;
  width: 100%;
  -webkit-overflow-scrolling: touch;
}

.settings-section {
  margin-bottom: 14px;
  padding: 18px;
  background: #fff;
  border: 1px solid #e6e8ee;
  border-radius: 8px;
}

.section-heading {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.section-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 8px;
  background: #eef3ff;
  color: #315bdc;
  font-size: 12px;
  font-weight: 800;
}

.section-heading h2,
.guide-copy h3 {
  margin: 0;
  font-size: 16px;
}

.section-heading p,
.setting-row p,
.guide-copy p,
.upload-preview {
  margin: 4px 0 0;
  color: #687184;
  font-size: 12px;
  line-height: 1.45;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 0;
  border-top: 1px solid #edf0f4;
}

.setting-row:first-of-type {
  border-top: 0;
}

.setting-row.compact {
  padding-top: 0;
  border-top: 0;
}

label,
.setting-row label,
.scale-control span,
.upload-grid span {
  color: #20232a;
  font-size: 13px;
  font-weight: 700;
}

.control {
  min-height: 38px;
  border: 1px solid #d8dce5;
  border-radius: 8px;
  padding: 8px 10px;
  background: #fff;
  color: #20232a;
  font-size: 14px;
}

.language-select {
  width: 180px;
}

.switch {
  position: relative;
  width: 46px;
  height: 26px;
}

.switch input {
  display: none;
}

.switch span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #d7dce5;
  transition: background 160ms ease;
}

.switch span::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
  transition: transform 160ms ease;
}

.switch input:checked + span {
  background: #315bdc;
}

.switch input:checked + span::after {
  transform: translateX(20px);
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.number-card {
  display: grid;
  grid-template-columns: 1fr 84px auto;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
}

.number-card input {
  width: 84px;
  min-height: 38px;
  border: 1px solid #d8dce5;
  border-radius: 8px;
  padding: 8px;
  font-size: 15px;
}

.number-card em {
  color: #687184;
  font-size: 12px;
  font-style: normal;
}

.action-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
}

.ai-sprite-section {
  display: block;
}

.action-section .section-heading {
  margin-bottom: 0;
}

.action-buttons,
.upload-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.secondary-button,
.primary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  text-decoration: none;
  cursor: pointer;
}

.secondary-button {
  color: #315bdc;
  background: #eef3ff;
  border: 1px solid #dce5ff;
}

.secondary-button.solid,
.primary-button {
  color: #fff;
  background: #315bdc;
  border: 1px solid #315bdc;
}

.secondary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.appearance-layout {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.sprite-preview {
  display: grid;
  place-items: center;
  width: 130px;
  height: 130px;
  border-radius: 8px;
  background:
    linear-gradient(45deg, #eef0f4 25%, transparent 25%),
    linear-gradient(-45deg, #eef0f4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eef0f4 75%),
    linear-gradient(-45deg, transparent 75%, #eef0f4 75%);
  background-size: 18px 18px;
  background-position: 0 0, 0 9px, 9px -9px, -9px 0;
  border: 1px solid #e2e6ee;
}

.sprite-preview img {
  max-width: 96px;
  max-height: 96px;
  object-fit: contain;
  image-rendering: pixelated;
}

.appearance-controls {
  min-width: 0;
}

.sprite-picker {
  position: relative;
  width: 210px;
}

.sprite-picker-selected {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.sprite-picker-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 230px;
  overflow-y: auto;
  padding: 6px;
  background: #fff;
  border: 1px solid #d8dce5;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(20, 30, 50, 0.14);
}

.sprite-picker-option {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  padding: 8px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.sprite-picker-option:hover,
.sprite-picker-option.active {
  background: #eef3ff;
}

.sprite-picker-option img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  image-rendering: pixelated;
}

.scale-control {
  display: grid;
  grid-template-columns: 110px minmax(120px, 1fr) 42px;
  gap: 10px;
  align-items: center;
  margin-top: 12px;
}

.scale-control input {
  width: 100%;
}

.scale-control strong {
  color: #315bdc;
  font-size: 13px;
}

.sprite-guide-panel {
  padding: 14px;
  border: 1px solid #edf0f4;
  border-radius: 8px;
  background: #fbfcfe;
}

.upload-grid {
  display: grid;
  grid-template-columns: minmax(160px, 220px) minmax(220px, 1fr);
  gap: 12px;
  margin-top: 14px;
}

.ai-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.ai-grid label {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.ai-grid label.wide {
  grid-column: 1 / -1;
}

.ai-grid textarea {
  min-height: 92px;
  resize: vertical;
  line-height: 1.45;
}

.upload-grid label {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.file-picker {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.file-picker > span {
  color: #315bdc;
  font-weight: 700;
}

.file-picker strong {
  min-width: 0;
  overflow: hidden;
  color: #687184;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-ok {
  color: #287143;
  font-size: 13px;
}

.upload-err {
  color: #c83b3b;
  font-size: 13px;
}

.save-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 240px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 12px 22px;
  background: rgba(255, 255, 255, 0.94);
  border-top: 1px solid #e6e8ee;
  backdrop-filter: blur(10px);
}

.save-msg {
  color: #287143;
  font-size: 13px;
}

@media (max-width: 760px) {
  .settings-page {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    position: static;
    height: auto;
  }

  .side-nav {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-main {
    height: auto;
    min-height: 0;
    overflow-y: visible;
    padding: 14px 14px 86px;
  }

  .setting-row,
  .action-section {
    align-items: flex-start;
    flex-direction: column;
    display: flex;
  }

  .number-grid,
  .appearance-layout,
  .sprite-guide-panel,
  .upload-grid {
    grid-template-columns: 1fr;
  }

  .save-bar {
    left: 0;
  }
}
</style>
