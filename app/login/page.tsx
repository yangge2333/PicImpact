import { UserFrom } from '~/components/login/user-from'
import Image from 'next/image'
import fallbackLogo from '~/public/fallback-logo.jpg'
import { getTranslations } from 'next-intl/server'
import { cachedConfigsByKeys } from '~/server/lib/cache'
import { toCustomInfo } from '~/server/lib/config-transform'

export default async function Login() {
  const t = await getTranslations('Login')
  const rows = await cachedConfigsByKeys(['custom_title', 'custom_favicon_url'])
  const info = toCustomInfo(rows)
  const logoSrc = info.customFaviconUrl || fallbackLogo
  const title = info.customTitle || 'PicImpact'

  return (
    <div className="flex min-h-screen">
      {/* Left: Featured photo — hidden on mobile */}
      <div className="hidden lg:block lg:w-1/2 relative bg-muted">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-muted to-accent/20" />
        <div className="absolute bottom-8 left-8 right-8">
          <blockquote className="font-display text-2xl text-foreground/80 italic">
            &ldquo;Photography is the story I fail to put into words.&rdquo;
          </blockquote>
        </div>
      </div>

      {/* Right: Login form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 lg:px-12">
        <div className="w-full max-w-sm space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-6 w-6 items-center justify-center">
                <Image
                  src={logoSrc}
                  alt="Logo"
                  width={36}
                  height={36}
                  className="rounded-md object-cover"
                />
              </div>
              <h1 className="font-display text-3xl font-semibold">{title}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{t('signInDescription', { defaultValue: 'Sign in to continue' })}</p>
          </div>

          <UserFrom />
        </div>
      </div>
    </div>
  )
}
