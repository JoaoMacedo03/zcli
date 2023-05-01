import type { RuntimeContext, TemplateErrors } from '../types'
import getManifest from './getManifest'
import getTemplates from './getTemplates'
import getVariables from './getVariables'
import getAssets from './getAssets'
import * as chalk from 'chalk'
import axios from 'axios'
import { CLIError } from '@oclif/core/lib/errors'

export const livereloadScript = (host: string, port: number) => `<script>(() => {
  const socket = new WebSocket('ws://${host}:${port}/livereload');
  socket.onopen = () => console.log('Listening to theme changes');
  socket.onmessage = e => e.data === 'reload' && location.reload();
})()</script>
`

export default async function preview (themePath: string, context: RuntimeContext): Promise<boolean | void> | never {
  const manifest = getManifest(themePath)
  const templates = getTemplates(themePath)
  const variables = getVariables(themePath, manifest.settings, context)
  const assets = getAssets(themePath, context)

  const variablesPayload = variables.reduce((payload, variable) => ({
    ...payload,
    [variable.identifier]: variable.value
  }), {})

  const assetsPayload = assets.reduce((payload, [parsedPath, url]) => ({
    ...payload,
    [parsedPath.base]: url
  }), {})

  const metadataPayload = { api_version: manifest.api_version }

  try {
    console.log(chalk.bold.green('Uploading'), 'Uploading theme')
    const response = await axios({
      method: 'put',
      url: `${context.origin}/hc/api/internal/theming/local_preview`,
      validateStatus: null,
      auth: {
        username: context.username,
        password: context.password
      },
      data: {
        templates: {
          ...templates,
          css: '',
          js: '',
          document_head: `
            <link rel="stylesheet" href="http://${context.host}:${context.port}/guide/style.css">
            ${templates.document_head}
            <script src="http://${context.host}:${context.port}/guide/script.js"></script>
            ${context.livereload ? livereloadScript(context.host, context.port) : ''}
          `,
          assets: assetsPayload,
          variables: variablesPayload,
          metadata: metadataPayload
        }
      }
    })

    if (response.status === 200) {
      console.log(chalk.bold.green('Uploading'), 'OK')
      return true
    } else if (response.status === 403) {
      throw new CLIError('Invalid username and password')
    } else {
      const data = response.data
      if (!data.template_errors) throw new CLIError(response.statusText)
      Object.entries(data.template_errors as TemplateErrors).forEach(([template, errors]) => {
        errors.forEach((error) => {
          console.log(
            chalk.bold.red('Validation error'),
            `${template} L${error.line}:${error.column}: ${error.description}`
          )
        })
      })
      return false
    }
  } catch (error) {
    console.log(chalk.bold.red('Error'), 'Something went wrong')
    throw (error)
  }
}
