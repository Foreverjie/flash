import { log } from "@follow/logger"

export const appLog = (...args: any[]) => {
  if (ELECTRON) log(...args)
  console.info(
    `%c ${APP_NAME} %c`,
    "color: #1a1207; margin: 0; padding: 5px 0; background: #facc15; border-radius: 3px;",
    ...args.reduce((acc, cur) => {
      acc.push("", cur)
      return acc
    }, []),
  )
}
