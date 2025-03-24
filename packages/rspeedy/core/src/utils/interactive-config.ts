// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises'
import path from 'node:path'

import { logger } from '@rsbuild/core'
import color from 'picocolors'

// Add type definition for inquirer
interface InquirerPrompt {
  type: string
  name: string
  message: string
  choices?: Array<{ name: string, value: string }> | undefined
  default?: unknown
}

interface Inquirer {
  prompt<T>(questions: InquirerPrompt[]): Promise<T>
}

interface ConfigOption {
  name: string
  type: 'boolean' | 'string' | 'number' | 'select'
  description: string
  default?: unknown
  choices?: string[]
}

interface ConfigCategory {
  name: string
  description: string
  options: ConfigOption[]
}

/**
 * Configuration categories with their available options
 */
const CONFIG_CATEGORIES: ConfigCategory[] = [
  {
    name: 'Development',
    description: 'Configure development server settings',
    options: [
      {
        name: 'port',
        type: 'number',
        description: 'The port to use for the development server',
        default: 3000,
      },
      {
        name: 'host',
        type: 'string',
        description: 'The host to use for the development server',
        default: 'localhost',
      },
      {
        name: 'https',
        type: 'boolean',
        description: 'Enable HTTPS for the development server',
        default: false,
      },
      {
        name: 'open',
        type: 'boolean',
        description: 'Open the browser automatically when the server starts',
        default: true,
      },
    ],
  },
  {
    name: 'Build',
    description: 'Configure production build settings',
    options: [
      {
        name: 'target',
        type: 'select',
        description: 'The deployment target environment',
        default: 'web',
        choices: ['web', 'node', 'electron'],
      },
      {
        name: 'minify',
        type: 'boolean',
        description: 'Enable minification for production builds',
        default: true,
      },
      {
        name: 'sourcemap',
        type: 'boolean',
        description: 'Generate source maps for debugging',
        default: false,
      },
    ],
  },
  {
    name: 'Features',
    description: 'Configure optional features',
    options: [
      {
        name: 'react',
        type: 'boolean',
        description: 'Enable React support',
        default: true,
      },
      {
        name: 'typescript',
        type: 'boolean',
        description: 'Enable TypeScript support',
        default: true,
      },
      {
        name: 'cssModules',
        type: 'boolean',
        description: 'Enable CSS Modules',
        default: true,
      },
    ],
  },
]

/**
 * Display an interactive configuration wizard
 */
export async function startInteractiveConfig(cwd: string): Promise<void> {
  try {
    // Before using inquirer, we should check if it's installed and install it if needed
    const hasInquirer = await checkDependency('inquirer')

    if (!hasInquirer) {
      logger.info('To use the interactive configuration, install inquirer:')
      logger.info(color.green('npm install inquirer --save-dev'))
      return
    }

    // Since we confirmed inquirer is available, we can safely use it
    // TypeScript still shows errors, but we know the module exists at runtime

    // This is a workaround for TypeScript not finding the module
    // @ts-expect-error - Using a dynamically resolved module
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, import/no-unresolved
    const inquirerModule = await import('inquirer')

    // Apply type assertions to handle the any type safely
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const inquirer = inquirerModule.default as Inquirer

    logger.info(
      color.bold(
        color.bgCyan(color.white(' RSPEEDY INTERACTIVE CONFIGURATION ')),
      ),
    )
    logger.info('\n')
    logger.info(
      'This wizard will help you create a custom configuration for your Rspeedy project.',
    )
    logger.info('Press ^C at any time to quit.')
    logger.info('\n')

    // Select configuration categories to customize
    interface CategorySelection {
      selectedCategories: string[]
    }

    const { selectedCategories } = await inquirer.prompt<CategorySelection>([
      {
        type: 'checkbox',
        name: 'selectedCategories',
        message: 'Select configuration categories to customize:',
        choices: CONFIG_CATEGORIES.map(cat => ({
          name: `${cat.name} - ${cat.description}`,
          value: cat.name,
        })),
        default: ['Development', 'Build'],
      },
    ])

    const config: Record<string, unknown> = {}

    // For each selected category, prompt for option values
    for (const categoryName of selectedCategories) {
      const category = CONFIG_CATEGORIES.find(cat => cat.name === categoryName)!

      logger.info(
        `\n${color.blue(color.bold(category.name))} - ${category.description}`,
      )

      const categoryConfig: Record<string, unknown> = {}

      for (const option of category.options) {
        const prompt: InquirerPrompt = {
          name: option.name,
          message: `${option.description} (${
            color.dim(String(option.default))
          })`,
          type: '',
        }

        if (option.type === 'boolean') {
          prompt.type = 'confirm'
          prompt.default = option.default
        } else if (option.type === 'number') {
          prompt.type = 'number'
          prompt.default = option.default
        } else if (option.type === 'select') {
          prompt.type = 'list'
          prompt.choices = option.choices?.map(c => ({ name: c, value: c }))
          prompt.default = option.default
        } else {
          prompt.type = 'input'
          prompt.default = option.default
        }

        type AnswerType = Record<string, unknown>
        const answer = await inquirer.prompt<AnswerType>([prompt])
        categoryConfig[option.name] = answer[option.name]
      }

      config[categoryName.toLowerCase()] = categoryConfig
    }

    // Ask where to save the configuration
    interface SaveConfirmation {
      confirmSave: boolean
    }

    const { confirmSave } = await inquirer.prompt<SaveConfirmation>([
      {
        type: 'confirm',
        name: 'confirmSave',
        message: 'Save this configuration to lynx.config.js?',
        default: true,
      },
    ])

    if (confirmSave) {
      await saveConfiguration(cwd, config)
      logger.success('Configuration saved successfully!')
    } else {
      logger.info('Configuration not saved.')
      logger.info('Here is your configuration:')
      logger.info('\n')
      logger.info(JSON.stringify(config, null, 2))
    }
  } catch (error) {
    logger.error('Failed to run interactive configuration:')
    logger.error(error)
  }
}

/**
 * Save the configuration to a file
 */
async function saveConfiguration(
  cwd: string,
  config: Record<string, unknown>,
): Promise<void> {
  const configPath = path.join(cwd, 'lynx.config.js')

  const configContent = `// Generated by Rspeedy Interactive Configuration
// See https://lynxjs.org/rspeedy/config for all options

/** @type {import('@lynx-js/rspeedy').RspeedyConfig} */
export default {
  ${
    Object.entries(config)
      .map(([category, options]) => {
        return `${category}: ${JSON.stringify(options, null, 2)}`
      })
      .join(',\n  ')
  }
};
`

  await fs.writeFile(configPath, configContent, 'utf-8')
}

/**
 * Check if a dependency is installed
 */
async function checkDependency(packageName: string): Promise<boolean> {
  try {
    const { execSync } = await import('node:child_process')
    execSync(`npm list ${packageName} --depth=0`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}
