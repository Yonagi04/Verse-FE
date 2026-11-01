// 绕过卡片等裁剪容器，同时让弹层与所属滚动区保持同一定位坐标系。
const popupContainerSelector = '[data-popup-container], .ant-modal-content, .ant-drawer-body'

export function getPopupContainer(triggerNode?: HTMLElement): HTMLElement {
  return triggerNode?.closest<HTMLElement>(popupContainerSelector) ?? document.body
}
