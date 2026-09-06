import { useSyncExternalStore } from 'react'
import { film } from '@/lib/filmStore'

/** Re-renders only when the film crosses a chapter boundary. */
export function useActiveChapter() {
  return useSyncExternalStore(film.subscribeChapter, film.getActive, film.getActive)
}
