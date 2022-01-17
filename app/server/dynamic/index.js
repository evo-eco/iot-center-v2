/* 
  *----------------------------------------------*
  |-- endpoint for managing dynamic dashboards --|
  *----------------------------------------------*
*/
const express = require('express')
const path = require('path')
const fs = require('fs')

const router = express.Router()

// TODO: add error escalations

// // source: https://stackoverflow.com/a/26227660
// const DIR_USER_DATA = path.join(
//   process.env.APPDATA ||
//     (process.platform === 'darwin'
//       ? process.env.HOME + '/Library/Preferences'
//       : process.env.HOME + '/.local/share'),
//   'iot-center-v2'
// )
const DIR_USER_DATA = path.join(__dirname, '../../../data')
const DIR_DYNAMIC_DASHBOARDS = path.join(DIR_USER_DATA, 'dynamic')

/**
 * @param {string} logLabel
 * @param {string} path
 * @param {()=>void} [callback]
 */
const createDir = (logLabel, path, callback) => {
  fs.stat(path, (e, stat) => {
    if (stat?.isDirectory?.()) {
      console.log(`${logLabel} directory already exists at:  ${path}`)
      callback?.()
    } else
      fs.mkdir(path, {recursive: true}, (e) => {
        if (!e) {
          console.log(`successfully created ${logLabel} directory at:  ${path}`)
          callback?.()
        } else {
          console.error(
            `failed co create ${logLabel} dir ${
              e?.message ?? 'No error message'
            }`
          )
        }
      })
  })
}
createDir('data', DIR_USER_DATA, () => {
  createDir('dynamic', DIR_DYNAMIC_DASHBOARDS, () => {
    fs.copyFile(
      path.join(__dirname, '../dynamic/demo.json'),
      path.join(DIR_DYNAMIC_DASHBOARDS, 'demo.json'),
      (e) => {
        if (e) console.error(e)
      }
    )
    fs.copyFile(
      path.join(__dirname, '../dynamic/factory.svg'),
      path.join(DIR_DYNAMIC_DASHBOARDS, 'factory.svg'),
      (e) => {
        if (e) console.error(e)
      }
    )
    fs.copyFile(
      path.join(__dirname, '../dynamic/schema.json'),
      path.join(DIR_DYNAMIC_DASHBOARDS, 'schema.json'),
      (e) => {
        if (e) console.error(e)
      }
    )
  })
})

router.get('/keys', (_req, res) => {
  fs.readdir(DIR_DYNAMIC_DASHBOARDS, (e, files) => {
    if (e) return
    const dashboards = files
      .filter((f) => f.endsWith('.json'))
      .map((d) => d.split('.').slice(0, -1).join('.'))
      .filter((d) => d !== 'schema')
    res.json(dashboards)
  })
})

router.get('/dashboard/:key', (req, res) => {
  const key = req.params.key

  fs.readFile(path.join(DIR_DYNAMIC_DASHBOARDS, key + '.json'), (e, data) => {
    if (e) {
      console.error(e)
      res.status(404)
      res.send(`Dynamic dashboard ${key} not found!`)
      return
    }

    const text = data.toString('utf-8')
    res.send(text)
  })
})

// svg should contain xmlns="http://www.w3.org/2000/svg"

router.get('/svg/:key', (req, res) => {
  const key = req.params.key

  fs.readFile(path.join(DIR_DYNAMIC_DASHBOARDS, key + '.svg'), (e, data) => {
    if (e) {
      console.error(e)
      res.status(404)
      res.send(`Svg ${key} not found!`)
      return
    }

    const text = data.toString('utf-8')
    res.send(text)
  })
})

router.get('/dir', (_req, res) => {
  res.send(DIR_DYNAMIC_DASHBOARDS)
})

router.use(express.text({limit: '10mb'}))

// TODO: secure write (don't allow write to different paths etc., reject <script>, on... attributes on svg)
router.post('/upload/:name', (req, res) => {
  const {name} = req.params
  if (name && (name.endsWith('.svg') || name.endsWith('.json'))) {
    fs.writeFile(path.join(DIR_DYNAMIC_DASHBOARDS, name), req.body, {}, (e) => {
      if (e) console.error(e)
      res.status(!e ? 200 : 500).send('')
    })
  } else {
    res.status(400)
    res.text('invalid filename or extension')
  }
})

module.exports = router
