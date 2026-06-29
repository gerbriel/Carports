import Hero from '../components/sections/Hero'
import TrustBar from '../components/sections/TrustBar'
import Services from '../components/sections/Services'
import WhyUs from '../components/sections/WhyUs'
import Process from '../components/sections/Process'
import Reviews from '../components/sections/Reviews'
import Financing from '../components/sections/Financing'
import FAQ from '../components/sections/FAQ'
import CTABanner from '../components/sections/CTABanner'

export default function Home() {
  return (
    <>
      <Hero />
      <TrustBar />
      <Services />
      <WhyUs />
      <Process />
      <Reviews />
      <Financing />
      <FAQ />
      <CTABanner />
    </>
  )
}
