import * as React from "react"

export const Logo = ({
  ref,
  ...props
}: React.SVGProps<SVGSVGElement> & {
  ref?: React.Ref<SVGSVGElement | null>
  accentColor?: string
}) => {
  const { accentColor, ...rest } = props
  const stroke = accentColor || "#facc15"
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" {...rest} ref={ref}>
      <title>Flash</title>
      <rect width="64" height="64" rx="15" fill="#0a0a0a" />
      <g fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="32" cy="33" r="18.5" />
        <path d="M37 12 L22 35 h11 L26.5 53 L42 30 h-11 Z" />
      </g>
    </svg>
  )
}
