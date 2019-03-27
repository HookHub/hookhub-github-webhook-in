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
  githubSignatureHandler = xHubSignatureMiddleware({
    algorithm: 'sha1',
    secret: config.credentials.secret,
    require: true,
    getRawBody: function (req) {
      return req.rawBody
    }
  })
}

// Perform sanity check
router.use(function (req, res, next) {
  if (req.header('X-Hub-Signature') === undefined || req.header('X-Hub-Signature').length < 40 || req.header('X-GitHub-Event') === undefined || req.header('X-GitHub-Event') === '' || req.rawBody === undefined) {
    res.hookhub.stack.push('hookhub-github-webhook-in')
    res.hookhub.result = {
      result: 'ERROR',
      message: 'Missing or invalid request arguments'
    }
    res.hookhub.statusCode = 412
    next('route')
  } else {
    next()
  }
})

// Check X-Hub-Signature
var githubSignatureHandler = xHubSignatureMiddleware({
  algorithm: 'sha1',
  secret: config.credentials.secret,
  require: true,
  getRawBody: function (req) {
    return req.rawBody
  }
})
router.use(githubSignatureHandler)

router.use('/', function (req, res, next) {
  res.hookhub.stack.push('hookhub-github-webhook-in')
})

/* Default handler. */
router.use('/', function (req, res, next) {
  debug('Handling default request')

  let event_type = req.header('X-GitHub-Event')
  let payload = req.body

  let doc = hookhubDoc(event_type, payload.repository.name)

  switch (event_type) {
    case 'push':
      doc.setSource(payload.sender.login, payload.sender.html_url, payload.sender.avatar_url)
      payload.commits.forEach(function (commit) {
        doc.addMessage(commit.id, commit.message, commit.timestamp, commit.url)
      })
      break
  }

  res.hookhub.doc = doc
  res.hookhub.result = { result: 'OK', message: '' }

  next()
})

module.exports = router
module.exports.configurable = configurable
