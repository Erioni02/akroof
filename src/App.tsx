import { useCallback, useEffect, useState } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

import ChapterLayers from '@/components/ChapterLayers'
import FilmStage from '@/components/FilmStage'
import Footer from '@/components/Footer'
import Loader from '@/components/Loader'
import Nav from '@/components/Nav'

export default function App() {
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)

  // hold the page at the top while the loader is up
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    document.body.dataset.locked = gone ? 'false' : 'true'
  }, [gone])

  const onExit = useCallback(() => {
    setGone(true)
    ScrollTrigger.refresh()
  }, [])

  return (
    <>
      <a
        href="#contact"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[90] focus:bg-bone focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to contact details
      </a>

      <div id="top" />

      <Nav />

      <main>
        <FilmStage onReady={() => setReady(true)}>
          <ChapterLayers />
        </FilmStage>

        <div id="contact">
          <Footer />
        </div>
      </main>

      {!gone && <Loader done={ready} onExit={onExit} />}
    </>
  )
}
