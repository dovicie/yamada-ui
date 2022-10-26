import * as CSS from 'csstype'
import {
  css,
  StylesProps,
  Token,
  keyframes as emotionKeyframes,
  CSSObject,
  StyledTheme,
} from '@yamada-ui/styled'
import { useTheme } from '@yamada-ui/providers'
import { Dict, isArray, isUndefined, runIfFunc } from '@yamada-ui/utils'
import { useRef, useState } from 'react'
import { useToken } from './'

export type AnimationStyle = {
  keyframes: Record<string, StylesProps<'unresponsive', 'unscheme'>>
  duration?: Token<CSS.Property.AnimationDuration, 'transitionDuration', 'unresponsive', 'unscheme'>
  timingFunction?: Token<
    CSS.Property.AnimationTimingFunction,
    'transitionEasing',
    'unresponsive',
    'unscheme'
  >
  delay?: Token<CSS.Property.AnimationDelay, unknown, 'unresponsive', 'unscheme'>
  iterationCount?: Token<CSS.Property.AnimationIterationCount, unknown, 'unresponsive', 'unscheme'>
  direction?: Token<CSS.Property.AnimationDirection, unknown, 'unresponsive', 'unscheme'>
  fillMode?: Token<CSS.Property.AnimationFillMode, unknown, 'unresponsive', 'unscheme'>
  playState?: Token<CSS.Property.AnimationPlayState, unknown, 'unresponsive', 'unscheme'>
}

const transformConfig = (
  obj: Omit<AnimationStyle, 'keyframes'>,
): Omit<AnimationStyle, 'keyframes'> =>
  Object.entries(obj).reduce((obj, [key, value]) => {
    if (key === 'duration') value = useToken('transitionsDuration', value) ?? value
    if (key === 'timingFunction') value = useToken('transitionsEasing', value) ?? value

    obj[key] = value

    return obj
  }, {} as Dict) as Omit<AnimationStyle, 'keyframes'>

const createAnimation =
  (keyframes: AnimationStyle['keyframes'], config: Omit<AnimationStyle, 'keyframes'>) =>
  (theme: StyledTheme<Dict>): string => {
    const generatedKeyframes = css(keyframes)(theme)

    const {
      duration = '0s',
      timingFunction = 'ease',
      delay = '0s',
      iterationCount = '1',
      direction = 'normal',
      fillMode = 'none',
      playState = 'running',
    } = transformConfig(config)

    const name = emotionKeyframes(generatedKeyframes)

    return `${name} ${duration} ${timingFunction} ${delay} ${iterationCount} ${direction} ${fillMode} ${playState}`
  }

export const useAnimation = (styles: AnimationStyle | AnimationStyle[]): CSSObject => {
  const theme = useTheme()

  const css: CSSObject = {}

  if (isArray(styles)) {
    css.animation = styles
      .map((style) => {
        const { keyframes, ...config } = style

        return createAnimation(keyframes, config)(theme)
      })
      .join(', ')
  } else {
    const { keyframes, ...config } = styles
    css.animation = createAnimation(keyframes, config)(theme)
  }

  return css
}

export const useDynamicAnimation = <
  T extends Array<AnimationStyle> | Record<string, AnimationStyle | AnimationStyle[]>,
>(
  arrayOrObj: T,
  init?: keyof T | (keyof T)[],
): [
  CSSObject | undefined,
  (
    key:
      | keyof T
      | (keyof T)[]
      | ((key: keyof T | (keyof T)[] | undefined) => keyof T | (keyof T)[]),
  ) => void,
] => {
  const theme = useTheme()
  const keys = useRef<string | string[] | undefined>(
    !isUndefined(init) ? (isArray(init) ? init.map(String) : String(init)) : undefined,
  )
  const cache = useRef<Map<string, string>>(new Map<string, string>())
  const [animations, setAnimations] = useState<CSSObject | undefined>(() => {
    for (const [key, styles] of Object.entries(arrayOrObj)) {
      if (cache.current.has(key)) return

      if (isArray(styles)) {
        cache.current.set(
          key,
          styles
            .map(({ keyframes, ...config }) => createAnimation(keyframes, config)(theme))
            .join(', '),
        )
      } else {
        const { keyframes, ...config } = styles

        cache.current.set(key, createAnimation(keyframes, config)(theme))
      }
    }

    const css: CSSObject = {}

    if (isArray(keys.current)) {
      css.animation = keys.current.map((key) => cache.current.get(key)).join(', ')
    } else {
      css.animation = cache.current.get(keys.current ?? '')
    }

    return css
  })

  const setAnimation = (
    keysOrFunc:
      | keyof T
      | (keyof T)[]
      | ((key: keyof T | (keyof T)[] | undefined) => keyof T | (keyof T)[]),
  ) => {
    const args = (() => {
      if (!isUndefined(keys.current) && isArray(arrayOrObj)) {
        return isArray(keys.current) ? keys.current.map(Number) : Number(keys.current)
      } else {
        return keys.current
      }
    })() as keyof T | (keyof T)[] | undefined

    const keyOrArray = runIfFunc(keysOrFunc, args)

    keys.current = isArray(keyOrArray) ? keyOrArray.map(String) : String(keyOrArray)

    const css: CSSObject = {}

    if (isArray(keys.current)) {
      css.animation = keys.current.map((key) => cache.current.get(key)).join(', ')
    } else {
      css.animation = cache.current.get(keys.current ?? '')
    }

    setAnimations(css)
  }

  return [animations, setAnimation]
}
