import { WakaBookingClient } from '~/components/waka/waka-booking-client'

export const metadata = {
  title: '排期 | 哇咔印象',
}

export default function WakaBookingPage() {
  return (
    <div className="min-h-[calc(100svh-2.5rem)] bg-background">
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <WakaBookingClient />
      </section>
    </div>
  )
}
