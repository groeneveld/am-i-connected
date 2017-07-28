const {app, Menu, Tray, clipboard} = require('electron')
const autostart = require('node-autostart')
const ping  = require('ping')
const path = require('path')

let tray = null
let contextMenu = null
let intervalID = null

let startOnLogin = false
let pingingEnabled = true

let pingHistory = []
let server = 'www.google.com'
let averageLatency = 'No Returned Pings'
let droppedPingPercentage = 0
const pingInterval = 1000 //ms
const maxPingsToKeep = 20

const goodLatencyThreshold = 100 //ms
const questionableLatencyThreshold = 300 //ms
const badDropRateThreshold = 11 //percent

const goodConnectionIcon = path.join(__dirname, 'images/running-good@2x.png')
const questionableConnectionIcon = path.join(__dirname, 'images/running-questionable@2x.png')
const badConnectionIcon = path.join(__dirname, 'images/running-bad@2x.png')
const pausedIcon = path.join(__dirname, 'images/paused@2x.png')

app.dock.hide()

app.on('ready', () => {
  tray = new Tray(questionableConnectionIcon)
  tray.setToolTip('am-i-connected')

  getAutostartStatus()

  startPinging()
})

function buildMenu () {
  contextMenu = Menu.buildFromTemplate([
    {label: 'Average Latency: ' + averageLatency, enabled: false},
    {label: 'Dropped Pings: ' + droppedPingPercentage + ' %', enabled: false},
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
      tray.setImage(questionableConnectionIcon)
      buildMenu()
    }},
    {type: 'separator'},

    {label: pingingEnabled ? 'Pause' : 'Unpause', click: function () {
      if (pingingEnabled) {
        pingingEnabled = false
        tray.setImage(pausedIcon)
        clearInterval(intervalID)
      } else {
        pingingEnabled = true
        startPinging()
      }
      buildMenu()
    }},
    {label: (startOnLogin ? 'Disable' : 'Enable') + ' Start on Login', click: function () {
      if (startOnLogin) {
        autostart.disableAutostart('thisApp').then(() => {
          startOnLogin = false
        }).catch((error) => {
          console.error(error)
        })
      } else {
        autostart.enableAutostart('thisApp', 'node start', process.cwd()).then(() => {
          startOnLogin = true
        }).catch((error) => {
          console.error(error)
        })
      }
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
  let numDroppedPings = 0
  for (let ping of pingHistory) {
    if (Number.isInteger(parseInt(ping.label))) {
      pingSum += parseInt(ping.label)
      numReturnedPings++
    } else {
      numDroppedPings++
    }
  }
  averageLatency = numReturnedPings > 0 ? (pingSum / numReturnedPings).toFixed() + ' ms'  : 'No Data'
  droppedPingPercentage = (numDroppedPings / pingHistory.length * 100).toFixed()

  const averageLatencyIsGood = parseInt(averageLatency) < goodLatencyThreshold
  const tooManyDroppedPings = droppedPingPercentage >= badDropRateThreshold
  const mostRecentPingDropped = pingHistory[pingHistory.length - 1].label === 'Not Returned'
  const mostRecentLatencyIsBad = parseInt(pingHistory[pingHistory.length - 1].label) >= questionableLatencyThreshold
  if (averageLatencyIsGood && !tooManyDroppedPings) {
    tray.setImage(goodConnectionIcon)
  } else if (mostRecentPingDropped || mostRecentLatencyIsBad) {
    tray.setImage(badConnectionIcon)
  } else {
    tray.setImage(questionableConnectionIcon)
  }
}

function startPinging () {
  intervalID = setInterval(function () {
    ping.promise.probe(server, {min_reply: 1}).then(function(pingResponse) {

      const pingLabel = pingResponse.alive ? pingResponse.time.toFixed().toString() : 'Not Returned'
      pingHistory.push({label: pingLabel})
      if (pingHistory.length > maxPingsToKeep)
        pingHistory.splice(0, pingHistory.length - maxPingsToKeep)

      updateAverageLatency()

      buildMenu()
    })
  }, pingInterval)
}

function getAutostartStatus() {
  autostart.isAutostartEnabled('thisApp').then((isEnabled) => {
    startOnLogin = isEnabled
    buildMenu()
  }).catch((error) => {
    console.error(error)
    buildMenu()
  })
}
