#!/usr/bin/env node

import { Utils } from '.'
import fs from 'fs'
import path from 'path'
import co from 'co'
import updateNotifier from 'update-notifier'
// import pkg from '../package.json'
import yargs from 'yargs'
import yParser from 'yargs-parser'

const debug = Utils.debug('zignis-core')
debug('zignis started')
const packageConfig = Utils.loadPackageInfo()
updateNotifier({ pkg: packageConfig, updateCheckInterval: 1000 * 60 * 60 * 24 * 7 }).notify({
  defer: false,
  isGlobal: true
})
debug('zignis update notifier')

const parsedArgv = yParser(process.argv.slice(2))
const cache = Utils.getInternalCache()
cache.set('argv', parsedArgv)
debug('zignis set cache argv')

const config = Utils.getCombinedConfig()
yargs.config(config)
const plugins = Utils.getAllPluginsMapping()
debug('zignis get plugins')

// Load local commands
if (packageConfig.name !== 'zignis') {
  yargs.commandDir('commands')
} else if (config.commandDir && fs.existsSync(path.resolve(process.cwd(), config.commandDir))) {
  yargs.commandDir(path.resolve(process.cwd(), config.commandDir))
}

// Load plugin commands
if (plugins) {
  Object.keys(plugins).map(function(plugin) {
    if (fs.existsSync(path.resolve(plugins[plugin], 'src/commands'))) {
      yargs.commandDir(path.resolve(plugins[plugin], 'src/commands'))
    }
  })
}

// Load application commands
if (
  packageConfig.name !== 'zignis' &&
  config.commandDir &&
  fs.existsSync(path.resolve(process.cwd(), config.commandDir))
) {
  yargs.commandDir(path.resolve(process.cwd(), config.commandDir))
}

debug('zignis set commands')

co(function*() {
  if (!parsedArgv.getYargsCompletions) {
    debug('zignis before command hook')
    let beforeHooks = yield Utils.invokeHook('beforeCommand')
    Object.keys(beforeHooks).map(function(hook) {
      beforeHooks[hook](parsedArgv, yargs)
    })
  }

  // eslint-disable-next-line
  yargs
    .help()
    .completion('completion', 'Generate completion script')
    .alias('h', 'help')
    .exitProcess(false)
    .recommendCommands()
    .epilog('Find more information at https://zignis.js.org')
    .wrap(Math.min(120, yargs.terminalWidth())).argv

  if (!parsedArgv.getYargsCompletions) {
    let afterHooks = yield Utils.invokeHook('afterCommand')
    Object.keys(afterHooks).map(function(hook) {
      afterHooks[hook](parsedArgv, yargs)
    })
    debug('zignis after command hook')
  }
}).catch(e => {
  if (!e.name || e.name !== 'YError') {
    Utils.error(e.stack)
  }
})