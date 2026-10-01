<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { RollbackOutlined } from '@ant-design/icons-vue'
import * as api from '@/api/playgroundWorkbench'
import type { WorkbenchConfig, WorkbenchResource, WorkbenchModel } from '@/types/playgroundWorkbench'
const props = defineProps<{ open: boolean; tenant: string; config: WorkbenchConfig; resource?: WorkbenchResource; presets: WorkbenchResource[]; models: WorkbenchModel[] }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; changed: []; load: [config: WorkbenchConfig] }>()
const name = ref(''), description = ref(''), updating = ref<string>(), busy = ref(false), current = ref<WorkbenchResource>()
let ticket = 0
const versions = computed(() => current.value?.payload.versions || [])
const latest = computed(() => versions.value.at(-1))
watch([() => props.open, () => props.tenant], () => {
  ticket++; current.value = props.resource; name.value = props.resource?.title || ''; description.value = props.resource?.description || ''; updating.value = undefined; busy.value = false
})
const modelNames = (config: WorkbenchConfig) => config.lanes.map(l => props.models.find(m => m.serviceId === l.serviceId)?.name || '模型已失效').join(' / ')
async function action(callback: () => Promise<WorkbenchResource>) {
  const revision = ticket; busy.value = true
  try { const result = await callback(); if (revision !== ticket) return; current.value = result; name.value = result.title; description.value = result.description || ''; emit('changed'); message.success('预设已保存') }
  catch { /* 统一拦截器已提示。 */ }
  finally { if (revision === ticket) busy.value = false }
}
function save() {
  if (!name.value.trim()) { message.warning('请输入预设名称'); return }
  const existing = current.value || props.presets.find(p => p.id === updating.value)
  void action(() => existing ? api.workbenchUpdate(props.tenant, existing, { title: name.value.trim(), description: description.value, config: props.config }) : api.workbenchCreate(props.tenant, 'presets', name.value.trim(), props.config, description.value))
}
function rename() { if (current.value && name.value.trim()) void action(() => api.workbenchUpdate(props.tenant, current.value!, { title: name.value.trim(), description: description.value })) }
function remove() {
  if (!current.value) return
  const t = props.tenant, id = current.value, revision = ticket
  Modal.confirm({ title: '删除个人预设？', content: '历史会话和调用配置快照会保留。', okText: '删除', okType: 'danger', cancelText: '取消', async onOk() {
    await api.workbenchDelete(t, id); if (revision !== ticket) return; emit('changed'); emit('update:open', false)
  } })
}
</script>
<template>
  <a-modal :open="open" :title="resource ? '个人预设' : '保存个人预设'" :width="720" @cancel="emit('update:open', false)">
    <a-form layout="vertical">
      <a-form-item label="名称"><a-input v-model:value="name" :maxlength="60" :disabled="busy" /></a-form-item>
      <a-form-item label="描述"><a-textarea v-model:value="description" class="description-input" :maxlength="500" :rows="3" :disabled="busy" /></a-form-item>
      <a-form-item v-if="!resource && !current" label="保存方式"><a-select v-model:value="updating" allow-clear placeholder="新建个人预设" :options="presets.map(p => ({ label: `更新 ${p.title}`, value: p.id }))" /></a-form-item>
    </a-form>
    <p class="muted">{{ resource ? modelNames(latest?.config || config) : modelNames(config) }} · 仅当前租户本人可见</p>
    <div v-if="versions.length" class="versions">
      <div v-for="v in [...versions].reverse()" :key="v.number" class="version"><div class="version-content"><strong>v{{ v.number }}</strong> · {{ new Date(v.createdAt).toLocaleString('zh-CN') }}<p>{{ modelNames(v.config) }}</p><details><summary>查看配置快照</summary><pre>{{ JSON.stringify(v.config, null, 2) }}</pre></details></div>
        <a-button class="restore-button" :disabled="busy" @click="action(() => api.workbenchRestore(tenant, current!.id, v.number))"><template #icon><RollbackOutlined /></template>恢复为新版本</a-button></div>
    </div>
    <template #footer>
      <template v-if="resource && latest">
        <a-button danger :disabled="busy" @click="remove">删除</a-button>
        <a-button :disabled="busy || !name.trim()" @click="rename">保存名称与描述</a-button>
        <a-button :disabled="busy" @click="action(() => api.workbenchCreate(tenant, 'presets', `${name.slice(0, 55)} 副本`, latest!.config, description))">复制</a-button>
        <a-button type="primary" :disabled="busy" @click="emit('load', { ...latest.config, presetId: current!.id, presetVersion: latest.number }); emit('update:open', false)">加载新草稿</a-button>
      </template>
      <a-button v-else type="primary" :loading="busy" @click="save">{{ updating || current ? '保存新版本' : '保存预设' }}</a-button>
    </template>
  </a-modal>
</template>
<style lang="scss" scoped>
.muted, .version p { color: $color-text-secondary; font-size: $font-size-caption; margin: 6px 0; }
// 描述框固定高度，长内容内部滚动，避免拖拽改变弹窗布局。
.description-input { height: 88px; min-height: 88px; max-height: 88px; resize: none; overflow-y: auto; }
.versions { max-height: 36vh; overflow: auto; } .version { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; padding: 14px 0; border-top: 1px solid $color-border; }
.version-content { flex: 1; min-width: 0; }
.restore-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid rgba($color-primary, .18);
  border-radius: $radius-button;
  background: rgba($color-primary, .04);
  color: $color-primary;
  font-size: $font-size-caption;
  font-weight: 500;
  box-shadow: none;
  &:hover { border-color: rgba($color-primary, .4); background: rgba($color-primary, .08); color: $color-primary; }
  &:disabled { border-color: $color-border; background: $color-bg-secondary; color: rgba($color-text-secondary, .55); }
}
pre { margin-top: 8px; padding: 12px; border-radius: $radius-input; background: $color-bg-secondary; font-size: $font-size-caption; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 200px; overflow: auto; } summary { cursor: pointer; color: $color-primary; }
@media (max-width: 560px) { .version { flex-wrap: wrap; } .version-content { flex-basis: 100%; } .restore-button { margin-left: auto; } }
</style>
