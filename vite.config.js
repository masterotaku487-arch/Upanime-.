import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import JavaScriptObfuscator from 'javascript-obfuscator'
import fs from 'fs'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),

    {
      name: 'obfuscate-build',
      apply: 'build',

      closeBundle() {
        const assetsDir = path.resolve('dist/assets')

        if (!fs.existsSync(assetsDir)) return

        for (const file of fs.readdirSync(assetsDir)) {
          if (!file.endsWith('.js')) continue

          const filePath = path.join(assetsDir, file)
          const code = fs.readFileSync(filePath, 'utf8')

          const result = JavaScriptObfuscator.obfuscate(code, {
            compact: true,

            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.2,

            deadCodeInjection: false,

            debugProtection: false,
            disableConsoleOutput: false,

            identifierNamesGenerator: 'hexadecimal',
            renameGlobals: false,
            selfDefending: false,

            stringArray: true,
            stringArrayThreshold: 0.75,
            unicodeEscapeSequence: false,
          })

          fs.writeFileSync(
            filePath,
            result.getObfuscatedCode()
          )
        }
      },
    },
  ],

  base: '/',

  server: {
    port: 3000,
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
