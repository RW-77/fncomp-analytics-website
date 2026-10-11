// Remotion (videos made from React; see remotion/). Lets the compositions use
// the site's Tailwind classes and its `@/` imports, so they can render real
// site components.
import path from "node:path"
import { Config } from "@remotion/cli/config"
import { enableTailwind } from "@remotion/tailwind-v4"

Config.setVideoImageFormat("jpeg")
// Remotion's own static files (staticFile()), apart from the site's public/.
Config.setPublicDir("remotion/public")
Config.overrideWebpackConfig((config) =>
  enableTailwind({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...(config.resolve?.alias ?? {}), "@": path.resolve(process.cwd()) },
    },
  }),
)
