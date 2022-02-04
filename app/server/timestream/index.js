const setupTimestreamBroker = require('./broker')
const {queryTimestream} = require('./query')

/** @typedef {import('express').Router} Router */

const isSafeString = (str) => /^([a-zA-Z_\-0-9 ])*$/.test(str)

/**
 * @param {number} agoMS
 * @param {string} clientId
 */
const createQuery = (agoMS, clientId) => {
  if (typeof agoMS !== 'number') throw new Error(`agoMS has to be number`)
  if (!isSafeString(clientId))
    throw new Error(`clientId contains unsafe sybols`)

  return `SELECT measure_name, time, measure_value::double, measure_value::bigint FROM iot_center_v2.environment WHERE clientId = '${clientId}' AND time > ago(${agoMS}ms)`
}

/**
 * @param {Router} router
 */
const startTimestreamEndpoint = async (router) => {
  // TODO: invalid request
  router.get('/timestream/query', async (req, res) => {
    const agoTimeMSQ = req.query?.agoTimeMS ?? Number.NaN
    const clientId = req.query?.clientId ?? ''

    const agoTimeMS = Number.isNaN(+agoTimeMSQ) ? 60 * 1000 : +agoTimeMSQ

    const queryString = createQuery(agoTimeMS, clientId)

    const result = await queryTimestream(queryString)

    res.json(result)
  })

  await setupTimestreamBroker()
}

module.exports = startTimestreamEndpoint
