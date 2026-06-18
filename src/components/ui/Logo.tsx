import type { SVGProps } from 'react'

/**
 * The Recipe Manager mark: a cheeky face — a crooked chef's toque, two tiny
 * eyes, and an orange tongue poking out. Cream + orange, designed to sit on the
 * royal-blue header. No tile background (use the PNG icons for the app icon).
 */
export function ChefLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="none" role="img" aria-label="Recipe Manager" {...props}>
      <g transform="translate(256 278) scale(0.94) translate(-256 -278)">
        <g transform="rotate(-10 256 300)">
          <g fill="#F4F0E5">
            <rect x="176" y="248" width="160" height="70" rx="16" />
            <circle cx="205" cy="236" r="52" />
            <circle cx="256" cy="202" r="68" />
            <circle cx="307" cy="238" r="50" />
          </g>
          <g stroke="#2C20D4" strokeWidth="7" strokeLinecap="round">
            <line x1="216" y1="266" x2="216" y2="304" />
            <line x1="256" y1="266" x2="256" y2="304" />
            <line x1="296" y1="266" x2="296" y2="304" />
          </g>
        </g>
        <circle cx="233" cy="348" r="11" fill="#F4F0E5" />
        <circle cx="279" cy="348" r="11" fill="#F4F0E5" />
        <rect x="228" y="360" width="56" height="62" rx="28" fill="#FF5E33" />
        <line x1="256" y1="368" x2="256" y2="394" stroke="#D9491F" strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  )
}
