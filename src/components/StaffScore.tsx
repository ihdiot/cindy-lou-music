import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'

/** Engraved sheet music. The ABC already contains the letter names (w: lines). */
export function StaffScore({ abc }: { abc: string }) {
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!holder.current) return
    abcjs.renderAbc(holder.current, abc, {
      responsive: 'resize',
      add_classes: true,
      paddingtop: 8,
      paddingbottom: 8,
    })
  }, [abc])

  return <div ref={holder} className="staff-holder w-full" data-testid="staff" />
}
