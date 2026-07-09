declare module "vanta/dist/vanta.net.min" {
  type VantaNetOptions = {
    el: HTMLElement
    THREE: unknown
    mouseControls?: boolean
    touchControls?: boolean
    gyroControls?: boolean
    minHeight?: number
    minWidth?: number
    scale?: number
    scaleMobile?: number
    color?: number
    backgroundColor?: number
    points?: number
    maxDistance?: number
    spacing?: number
    showDots?: boolean
  }

  type VantaEffect = {
    destroy?: () => void
  }

  export default function NET(options: VantaNetOptions): VantaEffect
}

declare module "three"
