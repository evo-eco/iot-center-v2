const {queryTimestream} = require('./query')

const query = `SELECT * FROM iot_center_v2.environment WHERE clientId = 'virtual_device' AND time > ago(5m)`

;(async () => {
  const rows = await queryTimestream(query)
  console.log(JSON.stringify(rows).substring(0, 1000))
})()
