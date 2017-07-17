const {app, Menu, Tray, clipboard} = require('electron')
let ping  = require('ping')

let tray = null
let contextMenu = null
let intervalID = null

let pingHistory = []
let pingingEnabled = true
let startOnLogin = false

let averageLatency = 'No Returned Pings'
const pingInterval = 5000
let server = 'www.google.com'
const maxPingsToKeep = 20

const goodLatencyThreshold = 100
const questionableLatencyThreshold = 500

const goodLatencyIcon = 'glyphicons-194-ok-sign@2x.png'
const questionableLatencyIcon = 'glyphicons-195-question-sign@2x.png'
const badLatencyIcon = 'glyphicons-193-remove-sign@2x.png'

app.dock.hide()

app.on('ready', () => {
  tray = new Tray(questionableLatencyIcon)
  tray.setToolTip('am-i-connected')
  buildMenu()

  startPinging()
})

function buildMenu () {
  contextMenu = Menu.buildFromTemplate([
    {label: 'Average Latency: ' + averageLatency, enabled: false},
    {label: 'Copy Ping History', click: function () {
      clipboardString = ''
      for (let ping of pingHistory)
        clipboardString += ping.label + '\n'
      clipboard.writeText(clipboardString)
    }},
    {label: 'Ping History', submenu: pingHistory},
    {type: 'separator'},

    {label: 'Server: ' + server, enabled: false},
    {label: 'Switch to Server on Clipboard', click: function () {
      server = clipboard.readText()
      pingHistory = []
      averageLatency = 'No Returned Pings'
      tray.setImage(questionableLatencyIcon)
      buildMenu()
    }},
    {type: 'separator'},

    {label: pingingEnabled ? 'Pause' : 'Unpause', click: function () {
      if (pingingEnabled) {
        pingingEnabled = false
        clearInterval(intervalID)
      } else {
        pingingEnabled = true
        startPinging()
      }
      buildMenu()
    }},
    {label: (startOnLogin ? 'Disable' : 'Enable') + ' Start on Login', click: function () {
      startOnLogin = startOnLogin ? false : true
      buildMenu()
    }},
    {type: 'separator'},

    {label: 'Quit', role: 'quit'}
  ])
  tray.setContextMenu(contextMenu)
}

// Excludes unreturned pings
function updateAverageLatency () {
  let pingSum = 0
  let numReturnedPings = 0
  for (let ping of pingHistory) {
    if (typeof parseInt(ping.label) === 'number') {
      pingSum += parseInt(ping.label)
      numReturnedPings++
    }
  }
  averageLatency = numReturnedPings > 0 ? (pingSum / numReturnedPings).toFixed() + ' ms'  : 'No Returned Pings'

  latencyIsGood = parseInt(averageLatency) < goodLatencyThreshold
  latencyisQuestionable = parseInt(averageLatency) < questionableLatencyThreshold
  if (latencyIsGood) {
    tray.setImage(goodLatencyIcon)
  } else if (latencyisQuestionable) {
    tray.setImage(questionableLatencyIcon)
  } else {
    tray.setImage(badLatencyIcon)
  }
}

function startPinging () {
  intervalID = setInterval(function () {
    ping.promise.probe(server, {min_reply: 1}).then(function(pingResponse) {
      pingHistory.push({label: pingResponse.time.toFixed().toString()})
      if (pingHistory.length > maxPingsToKeep)
        pingHistory.splice(0, pingHistory.length - maxPingsToKeep)

      updateAverageLatency()

      buildMenu()
    })
  }, pingInterval)
}
