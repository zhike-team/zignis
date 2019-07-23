import chalk from 'chalk'
import repl from 'repl'
import fs from 'fs'
import _ from 'lodash'
import replHistory from 'repl.history'
import yargs = require('yargs')

import { Utils } from '..'

function corepl(cli: repl.REPLServer) {
  var originalEval = cli.eval

  // @ts-ignore
  cli.eval = function coEval(cmd, context, filename, callback) {
    if (cmd.trim() === '?') {
      console.log()
      Utils.outputTable(
        [
          ['quit', 'Quit the REPL, alias: exit, q.'],
          ['yield/await', 'Run generator or promise function.'],
          ['?', 'Show this help info.']
        ],
        'Internal commands:'
      )

      console.log()
      return callback()
    }

    if (['exit', 'quit', 'q'].includes(cmd.replace(/(^\s*)|(\s*$)/g, ''))) {
      console.log(chalk.yellow('Bye!'))
      process.exit(0)
    }

    if (cmd.match(/^yield\s+/)) {
      cmd = 'Utils.co(function *() { let _ = ' + cmd + '; return _;})'
    } else if (cmd.match(/\W*yield\s+/)) {
      cmd = 'Utils.co(function *() {' + cmd.replace(/^\s*(var|let|const)\s+/, '') + '})'
    }

    if (cmd.match(/^await\s+/)) {
      cmd = '(async function() { let _ = ' + cmd + '; return _;})()'
    } else if (cmd.match(/\W*await\s+/)) {
      cmd = '(async function() {' + cmd.replace(/^\s*(var|let|const)\s+/, '') + '})()'
    }

    function done(val: any) {
      return callback(null, val)
    }

    originalEval.call(cli, cmd, context, filename, function(err, res) {
      if (err || !res || typeof res.then !== 'function') {
        return callback(err, res)
      } else {
        return res.then(done, callback)
      }
    })
  }

  return cli
}

export const command = 'repl'
export const aliases = 'r'
export const desc = 'Play with REPL'

async function openRepl(context: any): Promise<any> {
  const { argv } = context
  const r = repl.start('>>> ')
  const Home = process.env.HOME + `/.${argv.scriptName}`
  if (!fs.existsSync(Home)) {
    Utils.exec(`mkdir -p ${Home}`)
  }
  replHistory(r, `${Home}/.${argv.scriptName}_history`)

  // @ts-ignore
  // context即为REPL中的上下文环境
  r.context = Object.assign(r.context, context)

  corepl(r)
}

export const builder = function(yargs: yargs.Argv) {
  yargs.option('hook', {
    describe: 'if or not load all plugins repl hook'
  })
}

export const handler = async function(argv: any) {
  argv.hook = argv.hook || _.get(Utils.getCombinedConfig(), 'commandDefault.repl.hook') || false
  try {
    let context = { Utils, argv }

    if (argv.hook) {
      const pluginsReturn = await Utils.invokeHook(
        'repl',
        _.isBoolean(argv.hook)
          ? {}
          : {
              include: Utils.splitComma(argv.hook)
            }
      )
      context = Object.assign(context, pluginsReturn)
    }

    return await openRepl(context)
  } catch(e) {
    Utils.error(e.stack)
  }
}
