const app = require('express')()
const bodyParser = require('body-parser')
const http = require('http').Server(app)
const io = require('socket.io')(http)

function getRequestId(deviceId) {
  return deviceId + Date.now() + Math.random().toString()
}

app.use(bodyParser.json())

let pool = {}
let queue = {}

app.get('/:deviceId/state', (req, res) => {
  const socket = pool[req.params.deviceId]

  if (!socket) {
    return res.status(404).end()
  }

  let requestId = getRequestId(req.params.deviceId)

  socket.emit('getState', requestId)

  queue[requestId] = res
})

app.put('/:deviceId/state', (req, res) => {
  const requestId = getRequestId(req.params.deviceId)
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
  console.log('Connected')

  socket.on('register', deviceId => {
    console.log('Device registered:', deviceId)

    pool[deviceId] = socket
  })

  socket.on('state', (requestId, state) => {
    console.log('Client state:', requestId, state)

    if (queue[requestId]) {
      queue[requestId].end(state.toString())

      queue[requestId] = null
    }
  })
})

http.listen(process.env.PORT || 3123, () => {
  console.log('Server listening')
})
