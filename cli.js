#!/usr/bin/env node

process.env.DEBUG = '*'

require('./lib/cli.js').call(process.argv.slice(2))


