/* eslint-disable no-template-curly-in-string */
import { defineConfig } from "nbump"

export default defineConfig({
  leading: [
    "git pull --rebase",
    "tsx scripts/apply-changelog.ts ${NEW_VERSION}",
    "git add changelog",
    "pnpm eslint --fix package.json",
    "pnpm prettier --ignore-unknown --write package.json",
    "git add package.json",
  ],
  trailing: [
    "plutil -replace CFBundleShortVersionString -string ${NEW_VERSION} ios/Flash/Info.plist",
    "CURRENT_BUILD=$(plutil -extract CFBundleVersion raw ios/Flash/Info.plist) && plutil -replace CFBundleVersion -string $((CURRENT_BUILD + 1)) ios/Flash/Info.plist",
    "git add ios/Flash/Info.plist",
    "git checkout -b release/mobile/${NEW_VERSION}",
  ],
  finally: [
    "git push origin release/mobile/${NEW_VERSION}",
    "gh pr create --title 'release(mobile): Release v${NEW_VERSION}' --body 'v${NEW_VERSION}' --base mobile-main --head release/mobile/${NEW_VERSION}",
  ],
  push: false,
  commitMessage: "release(mobile): release v${NEW_VERSION}",
  tagPrefix: "mobile@",
  tag: false,
  changelog: false,
  allowedBranches: ["dev"],
})
