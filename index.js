/* eslint-disable camelcase */
const debug = require('debug')('hookhub:hook:github-webhook-in')
debug('Loading hookhub:hook:github-webhook-in')

const express = require('express')
const router = express.Router()
const xHubSignatureMiddleware = require('x-hub-signature').middleware
var hookhubDoc = require('hookhub-doc')

var config = {
  credentials: {
    secret: 'x-hub-signature'
  },
  options: {}
}

var configurable = function (newConfig) {
  config = newConfig
  debug('Hot-Plugging githubSignatureHandler')
  githubSignatureHandler = xHubSignatureMiddleware({
    algorithm: 'sha1',
    secret: config.credentials.secret,
    require: true,
    getRawBody: function (req) {
      return req.rawBody
    }
  })
}

// Check X-Hub-Signature
var githubSignatureHandler = xHubSignatureMiddleware({
  algorithm: 'sha1',
  secret: config.credentials.secret,
  require: true,
  getRawBody: function (req) {
    return req.rawBody
  }
})

// Functions
function stackRegistration (req, res, next) {
  res.locals.hookhub.stack.push('hookhub-github-webhook-in')
  next()
}

function sanityChecks (req, res, next) {
  debug('Performing sanity checks')
  if (req.header('X-Hub-Signature') === undefined || req.header('X-Hub-Signature').length < 40 || req.header('X-GitHub-Event') === undefined || req.header('X-GitHub-Event') === '' || req.rawBody === undefined) {
    res.locals.hookhub.result = {
      result: 'ERROR',
      message: 'Missing or invalid request arguments'
    }
    res.locals.hookhub.statusCode = 412
    debug('Sanity checks failed. Skipping...')
    next('error derp')
  } else {
    debug('Sanity checks are clear')
    next()
  }
}

function defaultHandler (req, res, next) {
  debug('Handling default request')

  let event_type = req.header('X-GitHub-Event')
  let payload = (typeof req.body === 'object') ? req.body : JSON.parse(req.rawBody)

  debug('defaultHandler', 'creating hookhubDoc for', event_type, '-', payload.repository.name)
  let doc = hookhubDoc(event_type, payload.repository.name)
  debug('defaultHandler', 'hookhubDoc:', doc)

  debug('defaultHandler', 'switch:', event_type)
  switch (event_type) {
    case 'push':
      doc.setSource(payload.sender.login, payload.sender.html_url, payload.sender.avatar_url)
      payload.commits.forEach(function (commit) {
        doc.addMessage(commit.id, commit.message, commit.timestamp, commit.url)
      })
      break
    default:
      debug('defaultHandler', 'switch:', 'unknown event_type')
      break
  }
  debug('defaultHandler', 'switch - doc:', doc)

  res.locals.hookhub.doc = doc
  res.locals.hookhub.result = { result: 'OK', message: '' }

  next()
}

// Routes
debug('Plugging route')
router.all('/', stackRegistration, sanityChecks, githubSignatureHandler, defaultHandler)

module.exports = router
module.exports.configurable = configurable

