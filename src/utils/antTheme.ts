import { theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { readThemeColor, type ResolvedTheme } from './appearance'

export function createAntTheme(mode: ResolvedTheme): ThemeConfig {
  if (mode === 'light') return { algorithm: theme.defaultAlgorithm }
  const color = readThemeColor
  return {
    algorithm: theme.darkAlgorithm,
    token: {
      colorPrimary: color('primary-solid'),
      colorPrimaryHover: color('primary-hover'),
      colorPrimaryActive: color('primary-active'),
      colorPrimaryText: color('link'),
      colorPrimaryTextHover: color('link-hover'),
      colorPrimaryTextActive: color('link'),
      colorPrimaryBg: color('selected'),
      colorPrimaryBgHover: color('selected'),
      colorLink: color('link'),
      colorLinkHover: color('link-hover'),
      colorLinkActive: color('link'),
      colorBgBase: color('canvas'),
      colorBgLayout: color('canvas'),
      colorBgContainer: color('surface'),
      colorBgElevated: color('elevated'),
      colorBgContainerDisabled: color('subtle'),
      colorBgMask: color('overlay'),
      colorText: color('text-primary'),
      colorTextSecondary: color('text-secondary'),
      colorTextTertiary: color('text-tertiary'),
      colorTextQuaternary: color('text-disabled'),
      colorTextPlaceholder: color('text-tertiary'),
      colorTextDisabled: color('text-disabled'),
      colorTextLightSolid: color('on-primary'),
      colorBorder: color('border-input'),
      colorBorderSecondary: color('border'),
      colorFillSecondary: color('hover'),
      colorFillTertiary: color('subtle'),
      colorFillQuaternary: color('subtle'),
      colorSuccess: color('success'), colorSuccessBg: color('success-bg'),
      colorSuccessText: color('success'),
      colorWarning: color('warning'), colorWarningBg: color('warning-bg'),
      colorWarningText: color('warning'),
      colorError: color('danger'), colorErrorBg: color('danger-bg'),
      colorErrorText: color('danger'),
      colorInfo: color('link'), colorInfoBg: color('selected'),
      colorInfoText: color('link'),
      controlOutline: color('focus'),
    },
    components: {
      // Tabs/pagination use colorPrimary for small text; solid button blue is too dim here.
      Tabs: { colorPrimary: color('link'), colorPrimaryHover: color('link-hover'), colorPrimaryActive: color('link') },
      Pagination: { colorPrimary: color('link'), colorPrimaryHover: color('link-hover'), colorPrimaryActive: color('link') },
      Table: { colorFillAlter: color('subtle'), controlItemBgActive: color('selected'), controlItemBgActiveHover: color('hover') },
      Button: { colorError: color('danger-solid'), colorErrorHover: color('danger-hover'), colorErrorActive: color('danger-active') },
    },
  }
}
