<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons-vue'

type CropShape = 'rectangle' | 'circle'

const props = withDefaults(
  defineProps<{
    open: boolean
    file: File | null
    title: string
    aspectRatio: number
    outputWidth: number
    outputHeight: number
    shape?: CropShape
    loading?: boolean
  }>(),
  {
    shape: 'rectangle',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [file: File]
  error: [message: string]
}>()

const stageRef = ref<HTMLElement | null>(null)
const frameRef = ref<HTMLElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const imageUrl = ref('')
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const baseScale = ref(1)
const zoomPercent = ref(100)
const offsetX = ref(0)
const offsetY = ref(0)
const dragging = ref(false)
const processing = ref(false)

let pointerStartX = 0
let pointerStartY = 0
let dragStartX = 0
let dragStartY = 0

const modalWidth = computed(() => props.shape === 'circle' ? 560 : 780)
const busy = computed(() => props.loading || processing.value)
const ratioLabel = computed(() => props.aspectRatio === 1 ? '1:1' : `${props.aspectRatio}:1`)
const renderedWidth = computed(() => naturalWidth.value * baseScale.value * zoomPercent.value / 100)
const renderedHeight = computed(() => naturalHeight.value * baseScale.value * zoomPercent.value / 100)
const frameStyle = computed(() => ({ aspectRatio: String(props.aspectRatio) }))
const imageStyle = computed(() => ({
  width: `${renderedWidth.value}px`,
  height: `${renderedHeight.value}px`,
  left: `calc(50% + ${offsetX.value}px)`,
  top: `calc(50% + ${offsetY.value}px)`,
}))

function releaseImageUrl() {
  if (imageUrl.value) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = ''
  }
}

watch(
  () => props.file,
  (file) => {
    releaseImageUrl()
    naturalWidth.value = 0
    naturalHeight.value = 0
    if (file) imageUrl.value = URL.createObjectURL(file)
  },
  { immediate: true },
)

watch(zoomPercent, () => constrainOffset())

onBeforeUnmount(releaseImageUrl)

function resetCrop() {
  const frame = frameRef.value
  if (!frame || !naturalWidth.value || !naturalHeight.value) return

  baseScale.value = Math.max(
    frame.clientWidth / naturalWidth.value,
    frame.clientHeight / naturalHeight.value,
  )
  zoomPercent.value = 100
  offsetX.value = 0
  offsetY.value = 0
}

async function handleImageLoad() {
  const image = imageRef.value
  if (!image) return

  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
  await nextTick()
  requestAnimationFrame(resetCrop)
}

function handleAfterOpenChange(isOpen: boolean) {
  if (!isOpen) return
  nextTick(() => requestAnimationFrame(resetCrop))
}

function constrainOffset() {
  const frame = frameRef.value
  if (!frame) return

  const maxX = Math.max(0, (renderedWidth.value - frame.clientWidth) / 2)
  const maxY = Math.max(0, (renderedHeight.value - frame.clientHeight) / 2)
  offsetX.value = Math.min(maxX, Math.max(-maxX, offsetX.value))
  offsetY.value = Math.min(maxY, Math.max(-maxY, offsetY.value))
}

function handlePointerDown(event: PointerEvent) {
  if (busy.value || !naturalWidth.value) return
  dragging.value = true
  pointerStartX = event.clientX
  pointerStartY = event.clientY
  dragStartX = offsetX.value
  dragStartY = offsetY.value
  stageRef.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent) {
  if (!dragging.value) return
  offsetX.value = dragStartX + event.clientX - pointerStartX
  offsetY.value = dragStartY + event.clientY - pointerStartY
  constrainOffset()
}

function stopDragging(event?: PointerEvent) {
  dragging.value = false
  if (event && stageRef.value?.hasPointerCapture(event.pointerId)) {
    stageRef.value.releasePointerCapture(event.pointerId)
  }
}

function adjustZoom(delta: number) {
  zoomPercent.value = Math.min(300, Math.max(100, zoomPercent.value + delta))
}

function handleWheel(event: WheelEvent) {
  adjustZoom(event.deltaY > 0 ? -5 : 5)
}

function handleKeydown(event: KeyboardEvent) {
  const step = event.shiftKey ? 10 : 2
  if (event.key === 'ArrowLeft') offsetX.value -= step
  else if (event.key === 'ArrowRight') offsetX.value += step
  else if (event.key === 'ArrowUp') offsetY.value -= step
  else if (event.key === 'ArrowDown') offsetY.value += step
  else if (event.key === '+' || event.key === '=') adjustZoom(5)
  else if (event.key === '-') adjustZoom(-5)
  else return

  event.preventDefault()
  constrainOffset()
}

function closeModal() {
  if (!busy.value) emit('update:open', false)
}

function croppedFileName() {
  const original = props.file?.name || 'image'
  const baseName = original.replace(/\.[^.]+$/, '')
  const extensionByType: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  const extension = extensionByType[props.file?.type || ''] || 'webp'
  return `${baseName}-cropped.${extension}`
}

async function createCroppedFile() {
  const image = imageRef.value
  const frame = frameRef.value
  if (!image || !frame || !props.file || !naturalWidth.value) {
    throw new Error('图片尚未加载完成，请稍后重试')
  }

  const displayScale = baseScale.value * zoomPercent.value / 100
  const sourceWidth = frame.clientWidth / displayScale
  const sourceHeight = frame.clientHeight / displayScale
  const sourceX = naturalWidth.value / 2 - offsetX.value / displayScale - sourceWidth / 2
  const sourceY = naturalHeight.value / 2 - offsetY.value / displayScale - sourceHeight / 2
  const canvas = document.createElement('canvas')
  canvas.width = props.outputWidth
  canvas.height = props.outputHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器不支持图片裁剪')

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(
    image,
    Math.max(0, sourceX),
    Math.max(0, sourceY),
    Math.min(sourceWidth, naturalWidth.value),
    Math.min(sourceHeight, naturalHeight.value),
    0,
    0,
    props.outputWidth,
    props.outputHeight,
  )

  const outputType = ['image/jpeg', 'image/png', 'image/webp'].includes(props.file.type)
    ? props.file.type
    : 'image/webp'
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, outputType, 0.92)
  })
  if (!blob) throw new Error('图片裁剪失败，请更换图片后重试')

  return new File([blob], croppedFileName(), {
    type: outputType,
    lastModified: Date.now(),
  })
}

async function handleConfirm() {
  if (busy.value) return
  processing.value = true
  try {
    emit('confirm', await createCroppedFile())
  } catch (error) {
    emit('error', error instanceof Error ? error.message : '图片裁剪失败')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <a-modal
    :open="open"
    :title="title"
    :width="modalWidth"
    :closable="!busy"
    :keyboard="!busy"
    :mask-closable="false"
    :confirm-loading="busy"
    ok-text="裁剪并上传"
    cancel-text="取消"
    @after-open-change="handleAfterOpenChange"
    @cancel="closeModal"
    @ok="handleConfirm"
  >
    <div class="crop-ratio-tip">
      固定比例 {{ ratioLabel }} · 输出尺寸 {{ outputWidth }} × {{ outputHeight }} px
    </div>
    <div
      ref="stageRef"
      class="crop-stage"
      :class="{ dragging, circle: shape === 'circle' }"
      role="application"
      tabindex="0"
      aria-label="图片裁剪区域，可拖动图片或使用方向键调整位置"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="stopDragging"
      @pointercancel="stopDragging"
      @wheel.prevent="handleWheel"
      @keydown="handleKeydown"
    >
      <img
        v-if="imageUrl"
        ref="imageRef"
        class="crop-image"
        :src="imageUrl"
        :style="imageStyle"
        alt="待裁剪图片"
        draggable="false"
        @load="handleImageLoad"
      />
      <div
        ref="frameRef"
        class="crop-frame"
        :class="{ circle: shape === 'circle' }"
        :style="frameStyle"
      >
        <span v-if="shape === 'rectangle'" class="grid-line vertical first" />
        <span v-if="shape === 'rectangle'" class="grid-line vertical second" />
        <span v-if="shape === 'rectangle'" class="grid-line horizontal" />
      </div>
    </div>

    <p class="crop-help">拖动图片调整位置，使用滑杆或滚轮缩放；裁剪框比例不可改变。</p>
    <div class="zoom-control">
      <MinusOutlined />
      <a-slider v-model:value="zoomPercent" :min="100" :max="300" :step="1" />
      <PlusOutlined />
      <span class="zoom-value">{{ zoomPercent }}%</span>
    </div>
  </a-modal>
</template>

<style lang="scss" scoped>
.crop-ratio-tip {
  margin: -8px 0 12px;
  color: $color-text-secondary;
  font-size: $font-size-caption;
}

.crop-stage {
  position: relative;
  height: 360px;
  overflow: hidden;
  border-radius: 10px;
  outline: none;
  background: #101828;
  cursor: grab;
  touch-action: none;
  user-select: none;

  &.dragging {
    cursor: grabbing;
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.28);
  }
}

.crop-image {
  position: absolute;
  max-width: none;
  transform: translate(-50%, -50%);
  pointer-events: none;
  user-select: none;
}

.crop-frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(100% - 48px);
  max-width: 640px;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.52);
  pointer-events: none;

  &.circle {
    width: min(300px, calc(100% - 48px));
    max-width: none;
    border-radius: 50%;
  }
}

.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.52);

  &.vertical {
    top: 0;
    bottom: 0;
    width: 1px;

    &.first {
      left: 33.333%;
    }

    &.second {
      left: 66.666%;
    }
  }

  &.horizontal {
    top: 50%;
    right: 0;
    left: 0;
    height: 1px;
  }
}

.crop-help {
  margin: 12px 0 0;
  color: $color-text-secondary;
  font-size: 13px;
}

.zoom-control {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto 44px;
  align-items: center;
  gap: 12px;
  max-width: 480px;
  margin: 14px auto 2px;

  :deep(.ant-slider) {
    margin: 10px 0;
  }
}

.zoom-value {
  color: $color-text-secondary;
  font-size: $font-size-caption;
  text-align: right;
}

@media (max-width: 640px) {
  .crop-stage {
    height: 280px;
  }

  .crop-frame.circle {
    width: min(232px, calc(100% - 32px));
  }
}
</style>
