const {MQTT_TOPIC} = require('../env')
const createClient = require('../mqtt/createClient')
const parseLineProtocol = require('../mqtt/ws/lpParser')
const writePointsTimeStream = require('./write')

/** @typedef {import("../mqtt/ws/lpParser.js").Point} Point */

// const SEND_INTERVAL = 10

// /**
//  * wait given time of ms, resolve then
//  * @param {number} ms
//  */
// const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** @returns {Point[]} */
function parseLineProtocolWithTopic(topic, buffer) {
  const points = parseLineProtocol(buffer)
  if (!points || points.length === 0) return
  const topicTagPair = `topic=${topic}`
  points.forEach((x) => x.tagPairs.push(topicTagPair))
  return points
}

/**
 * Setups express router to forward and filter MQTT messages
 * to web sockets according to their subscriptions.
 */
async function setupTimestreamBroker() {
  const client = await createClient()

  // subscribe to MQTT
  await client.subscribe(MQTT_TOPIC)

  // /** @type {Point[]} */
  // const batch = []

  // let timeoutRunning = false

  // const doWriteBatch = () => writePointsTimeStream(batch.splice(0))

  // const batchWriteDone = () => {
  //   timeoutRunning = false
  // }

  // /** @param {Point[]} points */
  // const pushBatch = (points) => {
  //   points.forEach((x) => batch.push(x))
  //   if (!timeoutRunning) {
  //     timeoutRunning = true

  //     sleep(SEND_INTERVAL).then(doWriteBatch).finally(batchWriteDone)
  //   }
  // }

  // route to web sockets
  client.on('message', function (topic, buffer) {
    try {
      const points = parseLineProtocolWithTopic(topic, buffer)
      if (!points || points.length === 0) return
      writePointsTimeStream(points)
    } catch (e) {
      process.stderr.write('Error while processing MQTT message ' + e + '\n')
    }
  })
}

module.exports = setupTimestreamBroker
