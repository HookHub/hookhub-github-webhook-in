/* eslint-disable camelcase */
var debug = require('debug')('hookhub:hook:github-webhook-in')
debug('Loading hookhub:hook:github-webhook-in')

var express = require('express')
var router = express.Router()
const xHubSignatureMiddleware = require('x-hub-signature').middleware
var hookhubDoc = require('hookhub-doc')

var config = null

// Perform sanity check
router.use(function (req, res, next) {
  if (req.header('X-Hub-Signature') === undefined || req.header('X-Hub-Signature').length < 40 || req.header('X-GitHub-Event') === undefined || req.header('X-GitHub-Event') === '' || req.rawBody === undefined) {
    res.status(412).send({
      result: 'ERROR',
      message: 'Missing or invalid request arguments'
    })
  } else {
    next()
  }
})

// Check X-Hub-Signature
router.use(xHubSignatureMiddleware({
  algorithm: 'sha1',
  secret: config.credentials.secret,
  require: true,
  getRawBody: function (req) {
    return req.rawBody
  }
}))

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
})

module.exports = router
module.exports.configurable = true
module.exports.config = config
