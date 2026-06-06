import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ABOUT_ME_MARKDOWN = `![船长头像](/about-avatar.jpeg)

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

const INITIAL_CONFIGS = [
  { config_key: 'accesskey_id', config_value: '', detail: '阿里 OSS / AWS S3 AccessKey_ID' },
  { config_key: 'accesskey_secret', config_value: '', detail: '阿里 OSS / AWS S3 AccessKey_Secret' },
  { config_key: 'region', config_value: '', detail: '阿里 OSS / AWS S3 Region 地域，如：oss-cn-hongkong' },
  { config_key: 'endpoint', config_value: '', detail: '阿里 OSS / AWS S3 Endpoint 地域节点，如：oss-cn-hongkong.aliyuncs.com' },
  { config_key: 'bucket', config_value: '', detail: '阿里 OSS / AWS S3 Bucket 存储桶名称，如：picimpact' },
  { config_key: 'storage_folder', config_value: '', detail: '存储文件夹(S3)，严格格式，如：picimpact 或 picimpact/images ，填 / 或者不填表示根路径' },
  { config_key: 'force_path_style', config_value: 'false', detail: '是否强制客户端对桶使用路径式寻址，默认 false。' },
  { config_key: 's3_cdn', config_value: 'false', detail: '是否启用 S3 CDN 模式，路径将返回 cdn 地址，默认 false。' },
  { config_key: 's3_cdn_url', config_value: '', detail: 'cdn 地址，如：https://cdn.example.com' },
  { config_key: 's3_direct_download', config_value: 'false', detail: '是否启用 S3 直接下载模式，默认 false。' },
  { config_key: 'open_list_token', config_value: '', detail: 'Open List 令牌' },
  { config_key: 'open_list_url', config_value: '', detail: 'Open List 地址，如：https://openlist.besscroft.com' },
  { config_key: 'secret_key', config_value: 'pic-impact', detail: 'SECRET_KEY' },
  { config_key: 'r2_accesskey_id', config_value: '', detail: 'Cloudflare AccessKey_ID' },
  { config_key: 'r2_accesskey_secret', config_value: '', detail: 'Cloudflare AccessKey_Secret' },
  { config_key: 'r2_account_id', config_value: '', detail: 'Cloudflare ACCOUNT_ID' },
  { config_key: 'r2_bucket', config_value: '', detail: 'Cloudflare Bucket 存储桶名称，如：picimpact' },
  { config_key: 'r2_storage_folder', config_value: '', detail: '存储文件夹(Cloudflare R2)，严格格式，如：picimpact 或 picimpact/images ，填 / 或者不填表示根路径' },
  { config_key: 'r2_public_domain', config_value: '', detail: 'Cloudflare R2 自定义域（公开访问）' },
  { config_key: 'r2_direct_download', config_value: 'false', detail: '是否启用 R2 直链下载模式，默认 false。' },
  { config_key: 'custom_title', config_value: 'PicImpact', detail: '网站标题' },
  { config_key: 'custom_favicon_url', config_value: '', detail: '用户自定义的 favicon 地址' },
  { config_key: 'custom_author', config_value: '', detail: '网站归属者名称' },
  { config_key: 'rss_feed_id', config_value: '', detail: 'Follow feedId' },
  { config_key: 'rss_user_id', config_value: '', detail: 'Follow userId' },
  { config_key: 'preview_max_width_limit', config_value: '2160', detail: '预览图短边像素限制' },
  { config_key: 'preview_max_width_limit_switch', config_value: '1', detail: '预览图短边限制开关' },
  { config_key: 'preview_quality', config_value: '0.8', detail: '预览图压缩质量' },
  { config_key: 'custom_index_style', config_value: '0', detail: '首页风格：0->默认模式;1->简单模式;2->宝丽来模式' },
  { config_key: 'custom_index_download_enable', config_value: 'false', detail: '是否启用图片下载' },
  { config_key: 'custom_index_origin_enable', config_value: 'false', detail: '首页是否显示原图(精选图片模式)' },
  { config_key: 'max_upload_files', config_value: '5', detail: '最大上传文件数量' },
  { config_key: 'umami_analytics', config_value: '', detail: 'Umami Website ID.' },
  { config_key: 'umami_host', config_value: '', detail: 'Umami Cloud Analytics' },
  { config_key: 'default_theme', config_value: 'light', detail: 'Default theme for users without a saved preference.' },
  { config_key: 'admin_images_per_page', config_value: '8', detail: '管理界面每页显示的图片数量' },
  { config_key: 'daily_enabled', config_value: 'false', detail: '是否启用 Daily 首页模式' },
  { config_key: 'daily_refresh_interval', config_value: '24', detail: 'Daily 首页刷新间隔（小时）：6/12/24/168' },
  { config_key: 'daily_total_count', config_value: '30', detail: 'Daily 首页展示照片总数' },
  { config_key: 'daily_last_refresh', config_value: '', detail: 'Daily 首页上次刷新时间' },
  { config_key: 'about_me_markdown', config_value: ABOUT_ME_MARKDOWN, detail: '关于我页面 Markdown 内容' },
]

export async function main() {
  try {
    if (prisma) {
      await prisma.$transaction(async (tx) => {
        await tx.configs.createMany({
          data: INITIAL_CONFIGS,
          skipDuplicates: true,
        })
      })
      console.log('action boot completed.')
    } else {
      console.error('Database initialization failed, please check your connection information.')
    }
  } catch (e) {
    console.error('Initialization failed. Please try to troubleshoot the issue first. If you cannot resolve it, please carry the logs and submit feedback at: https://github.com/besscroft/PicImpact/issues.', e)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
