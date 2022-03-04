/* 
  *----------------------------------------------*
  |-- endpoint for managing dynamic dashboards --|
  *----------------------------------------------*
*/
const express = require('express')
const path = require('path')
const fs = require('fs')
const sanitize = require('sanitize-filename')

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

//////////////////////
// Filesystem store //
//////////////////////
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

// implement simple caching to avoid frequest fs access
let FILE_CACHE = {}
fs.watch(DIR_DYNAMIC_DASHBOARDS, {}, () => (FILE_CACHE = {}))

function listFiles(callback) {
  if (FILE_CACHE.listFiles) {
    callback(...FILE_CACHE.listFiles)
    return
  }
  fs.readdir(DIR_DYNAMIC_DASHBOARDS, (e, files) => {
    FILE_CACHE.listFiles = [e, files]
    callback(e, files)
  })
}

function readFile(key, extension, callback) {
  const file = sanitize(key + extension)
  if (FILE_CACHE.readFile && FILE_CACHE.readFile[file]) {
    callback(...FILE_CACHE.readFile[file])
    return
  }
  fs.readFile(path.join(DIR_DYNAMIC_DASHBOARDS, file), (e, data) => {
    ;(FILE_CACHE.readFile || (FILE_CACHE.readFile = {}))[file] = [e, data]
    callback(e, data ? data.toString('utf-8') : undefined)
  })
}

function deleteFile(key, extension, callback) {
  const file = sanitize(key + extension)
  fs.unlink(path.join(DIR_DYNAMIC_DASHBOARDS, file), callback)
}

function writeFile(key, extension, body, callback) {
  const file = sanitize(key + extension)
  fs.writeFile(path.join(DIR_DYNAMIC_DASHBOARDS, file), body, {}, callback)
}

//////////////////////
// Router endpoints //
//////////////////////
router.get('/keys', (_req, res) => {
  listFiles((e, files) => {
    if (e) {
      console.error(e)
      res.sendStatus(500)
      return
    }
    const dashboards = files
      .filter((f) => f.endsWith('.json'))
      .map((d) => d.split('.').slice(0, -1).join('.'))
      .filter((d) => d !== 'schema')
    res.json(dashboards)
  })
})

router.get('/svgs', (_req, res) => {
  listFiles((e, files) => {
    if (e) {
      console.error(e)
      res.sendStatus(500)
      return
    }
    const svgs = files
      .filter((f) => f.endsWith('.svg'))
      .map((d) => d.split('.').slice(0, -1).join('.'))
    res.json(svgs)
  })
})

router.get('/dashboard/:key', (req, res) => {
  const key = req.params.key

  readFile(key, '.json', (e, text) => {
    if (e) {
      console.error(e)
      res.status(404)
      res.send(`Dynamic dashboard not found!`)
      return
    }
    res.send(text)
  })
})

router.delete('/dashboard/:key', (req, res) => {
  const key = req.params.key

  deleteFile(key, '.json', (e) => {
    if (e) {
      console.error(e)
      res.status(500)
      res.send(`Failed to delete dashboard!`)
      return
    }

    res.send('')
  })
})

router.get('/svg/:key', (req, res) => {
  const key = req.params.key

  readFile(key, '.svg', (e, text) => {
    if (e) {
      console.error(e)
      res.status(404)
      res.send(`Svg not found!`)
      return
    }
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
    const extSep = name.lastIndexOf('.')
    writeFile(
      name.substring(0, extSep),
      name.substring(extSep),
      req.body,
      (e) => {
        if (e) console.error(e)
        res.sendStatus(!e ? 200 : 500)
      }
    )
  } else {
    res.status(400)
    res.text('invalid filename or extension')
  }
})

module.exports = router
