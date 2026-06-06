import 'server-only'

import type {
  AboutInfo,
  AdminConfig,
  Config,
  CustomInfo,
  DailyConfig,
  OpenListInfo,
  R2Info,
  S3Info,
} from '~/types'
import { normalizeDefaultTheme } from '~/lib/utils/theme'

export const DEFAULT_ABOUT_ME_MARKDOWN = `![船长头像](/about-avatar.jpeg)

# 船长

专注二次元人像摄影，3 年+ 持续拍摄经验，活动范围主要覆盖江浙沪。

我更在意“角色感”本身：不是只把服装和场景拍清楚，而是通过构图、光线、情绪和动作，把角色的性格、故事氛围和画面张力一起呈现出来。无论是活动现场、外景还是更完整的主题创作，我都会尽量在拍摄前沟通角色方向，在拍摄中根据现场条件调整灯光与引导。

## 擅长方向

- 二次元人像、Cosplay 角色主题拍摄
- 活动现场、外景、棚拍与弱光环境补光
- 使用灯光 / 自然光塑造角色性格与画面氛围
- 根据角色设定设计明暗关系、色彩倾向和镜头语言

## 设备配置

- 机身：Sony Alpha 7R V
- 镜头：Sony FE 35mm F1.4 GM
- 镜头：Sony FE 20-70mm F4 G
- 镜头：Sony FE 50-150mm F2 GM

## 灯光储备

- Nanlite Forza 500B II
- Nanlite FC-500B
- Nanlite Forza 60C
- Nanlite Forza 150B
- Nanlite PavoSlim 60B
- Alien 300C
- Nanlite PavoSlim 240C/CL
- Nanlite PavoTube II 30C × 2
- Nanlux Evoke 900C

## 价格说明

- 单人拍摄：599 元起
- 其余拍摄需求可根据人数、场景、时长、灯光方案与成片要求详谈

## 联系方式

- QQ：774202796
- 微信：13634085297`

// Per-shape mappers that convert the `Config[]` snake_case rows returned by
// `fetchConfigsByKeys` into the flat camelCase objects exposed by the
// `/api/v1/settings/*` and `/api/v1/daily/config` endpoints.
//
// Coercion rules:
//   - boolean fields stored as the string 'true' / 'false' → real `boolean`
//   - the legacy `preview_max_width_limit_switch` flag stored as '0' / '1' is
//     normalised to a boolean (`'1'` → true)
//   - numeric fields parsed via `parseInt` / `parseFloat`; non-numeric values
//     fall back to the documented default for that field
//   - missing rows yield the field default ('' for strings, false for bools,
//     0 / sensible defaults for numbers, null for `dailyLastRefresh`)

const valueOf = (configs: Config[], key: string): string | null | undefined =>
  configs.find((item) => item.config_key === key)?.config_value

const str = (configs: Config[], key: string, fallback = ''): string =>
  valueOf(configs, key) ?? fallback

const bool = (configs: Config[], key: string, fallback = false): boolean => {
  const raw = valueOf(configs, key)
  if (raw === undefined || raw === null) return fallback
  return raw === 'true'
}

const switchBool = (configs: Config[], key: string, fallback = false): boolean => {
  // Legacy '0' / '1' switch flag (e.g. preview_max_width_limit_switch).
  const raw = valueOf(configs, key)
  if (raw === undefined || raw === null) return fallback
  return raw === '1'
}

const int = (configs: Config[], key: string, fallback: number): number => {
  const raw = valueOf(configs, key)
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const float = (configs: Config[], key: string, fallback: number): number => {
  const raw = valueOf(configs, key)
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function toCustomInfo(configs: Config[]): CustomInfo {
  return {
    customTitle: str(configs, 'custom_title'),
    customFaviconUrl: str(configs, 'custom_favicon_url'),
    customAuthor: str(configs, 'custom_author'),
    rssFeedId: str(configs, 'rss_feed_id'),
    rssUserId: str(configs, 'rss_user_id'),
    customIndexStyle: str(configs, 'custom_index_style', '0'),
    customIndexDownloadEnable: bool(configs, 'custom_index_download_enable'),
    previewMaxWidthLimit: int(configs, 'preview_max_width_limit', 2160),
    previewMaxWidthLimitSwitch: switchBool(configs, 'preview_max_width_limit_switch', true),
    previewQuality: float(configs, 'preview_quality', 0.8),
    umamiHost: str(configs, 'umami_host'),
    umamiAnalytics: str(configs, 'umami_analytics'),
    maxUploadFiles: int(configs, 'max_upload_files', 5),
    customIndexOriginEnable: bool(configs, 'custom_index_origin_enable'),
    adminImagesPerPage: int(configs, 'admin_images_per_page', 24),
    defaultTheme: normalizeDefaultTheme(valueOf(configs, 'default_theme')),
  }
}

export function toS3Info(configs: Config[]): S3Info {
  return {
    accesskeyId: str(configs, 'accesskey_id'),
    accesskeySecret: str(configs, 'accesskey_secret'),
    region: str(configs, 'region'),
    endpoint: str(configs, 'endpoint'),
    bucket: str(configs, 'bucket'),
    storageFolder: str(configs, 'storage_folder'),
    forcePathStyle: bool(configs, 'force_path_style'),
    s3Cdn: bool(configs, 's3_cdn'),
    s3CdnUrl: str(configs, 's3_cdn_url'),
    s3DirectDownload: bool(configs, 's3_direct_download'),
  }
}

export function toR2Info(configs: Config[]): R2Info {
  return {
    r2AccesskeyId: str(configs, 'r2_accesskey_id'),
    r2AccesskeySecret: str(configs, 'r2_accesskey_secret'),
    r2AccountId: str(configs, 'r2_account_id'),
    r2Bucket: str(configs, 'r2_bucket'),
    r2StorageFolder: str(configs, 'r2_storage_folder'),
    r2PublicDomain: str(configs, 'r2_public_domain'),
    r2DirectDownload: bool(configs, 'r2_direct_download'),
  }
}

export function toOpenListInfo(configs: Config[]): OpenListInfo {
  return {
    openListUrl: str(configs, 'open_list_url'),
    openListToken: str(configs, 'open_list_token'),
  }
}

export function toAdminConfig(configs: Config[]): AdminConfig {
  return {
    adminImagesPerPage: int(configs, 'admin_images_per_page', 24),
  }
}

export function toAboutInfo(configs: Config[]): AboutInfo {
  return {
    aboutMeMarkdown: str(configs, 'about_me_markdown', DEFAULT_ABOUT_ME_MARKDOWN),
  }
}

export function toDailyConfig(configs: Config[]): DailyConfig {
  return {
    dailyEnabled: bool(configs, 'daily_enabled'),
    dailyRefreshInterval: str(configs, 'daily_refresh_interval', '24'),
    dailyTotalCount: int(configs, 'daily_total_count', 30),
    dailyLastRefresh: valueOf(configs, 'daily_last_refresh') ?? null,
  }
}
