const app = require('express')()
const bodyParser = require('body-parser')
const cors = require('cors')
const http = require('http').Server(app)
const io = require('socket.io')(http)

function getRequestId(deviceId) {
  return deviceId + Date.now() + Math.random().toString()
}

app.use(bodyParser.json())
app.use(cors())

let pool = {}
let queue = {}
let stateCache = {}

app.get('/hello', (req, res) => {
  res.send('Hello!')
})

app.get('/status', (req, res) => {
  res.send(JSON.stringify(stateCache))
})

app.get('/:deviceId/state', (req, res) => {
  const {deviceId} = req.params

  if (!pool[deviceId]) {
    return res.status(404).send()
  }

  const socket = pool[req.params.deviceId]

  if (!socket) {
    return res.status(404).end()
  }

  let requestId = getRequestId(req.params.deviceId)

  socket.emit('getState', requestId)

  queue[requestId] = res
})

app.put('/:deviceId/state', (req, res) => {
  const {deviceId} = req.params

  if (!pool[deviceId]) {
    return res.status(404).send()
  }

  const requestId = getRequestId(deviceId)
  const {
    amber,
    green,
    red
  } = req.body

  io.emit('setState', requestId, {
    amber,
    green,
    red
  })

  res.end()
})

io.on('connection', socket => {
  socket.on('disconnect', () => {
    const {__signallyId: deviceId} = socket

    if (deviceId) {
      console.log('Device disconnected:', deviceId)

      delete pool[deviceId]
      delete stateCache[deviceId]
    }
  })

  socket.on('register', deviceId => {
    console.log('Device registered:', deviceId)

    socket.__signallyId = deviceId

    pool[deviceId] = socket

    let requestId = getRequestId(deviceId)

    socket.emit('getState', requestId)
  })

  socket.on('state', (requestId, state) => {
    const {__signallyId: deviceId} = socket

    console.log('Client state:', {deviceId, requestId, state})

    if (queue[requestId]) {
      queue[requestId].end(state.toString())

      queue[requestId] = null
    }

    stateCache[deviceId] = state
  })
})

http.listen(process.env.PORT || 3123, () => {
  console.log('Server listening')
})
