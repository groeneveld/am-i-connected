const {app, Menu, Tray, clipboard} = require('electron')
const autostart = require('node-autostart')
const ping  = require('ping')
const path = require('path')

let clipboardString
let tray = null
let contextMenu = null
let intervalID = null

let startOnLogin = false
let pingingEnabled = true

let averageLatency = 'No Returned Pings'
let droppedPingPercentage = 0

const config = {}
config.pingInterval = 5000
config.server = 'www.google.com'
config.maxPingsToKeep = 20

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

  pingEveryInterval()
})

function averageLatencyMenuItem () {
  return {label: 'Average Latency: ' + averageLatency, enabled: false}
}

function copyPingHistoryMenuItem () {
  return {
    label: 'Copy Ping History',
    click: function () {
      clipboardString = ''
      for (let ping of pingHistory) {
        clipboardString += ping.label + '\n'
      }
      clipboard.writeText(clipboardString)
    }
  }
}

function pingHistoryMenuItem () {
  return {label: 'Ping History', submenu: pingHistory}
}

function separator () {
  return {type: 'separator'}
}

function displayServerMenuItem () {
  return {label: 'Server: ' + config.server, enabled: false}
}

function switchServerMenuItem () {
  return {
    label: 'Switch to Server on Clipboard',
    click: function () {
      config.server = clipboard.readText()
      pingHistory = []
      averageLatency = 'No Returned Pings'
      tray.setImage(questionableConnectionIcon)
      buildMenu()
    }
  }
}

function pauseMenuItem () {
  return {
    label: pingingEnabled ? 'Pause' : 'Unpause',
      click: function () {
      if (pingingEnabled) {
        pingingEnabled = false
        tray.setImage(pausedIcon)
        clearInterval(intervalID)
      } else {
        pingingEnabled = true
        pingEveryInterval()
      }
      buildMenu()
    }
  }
}

function startOnLoginMenuItem () {
  return {
    label: (startOnLogin ? 'Disable' : 'Enable') + ' Start on Login',
    click: function () {
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
      buildMenu()
    }
  }
}

function quitMenuItem () {
  return {label: 'Quit', role: 'quit'}
}

function buildMenu () {
  contextMenu = Menu.buildFromTemplate([
    averageLatencyMenuItem(),
    copyPingHistoryMenuItem(),
    pingHistoryMenuItem(),
    separator(),

    displayServerMenuItem(),
    switchServerMenuItem(),
    separator(),

    pauseMenuItem(),
    startOnLoginMenuItem(),
    separator(),

    quitMenuItem()
  ])
  tray.setContextMenu(contextMenu)
}

// Excludes unreturned pings
function calculateAverageLatency () {
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
  averageLatency = numReturnedPings > 0 ? (pingSum / numReturnedPings).toFixed() + ' ms' : 'No Returned Pings'
  return averageLatency
}

function determineStateBasedOnLatency (averageLatency) {
  const averageLatencyIsGood = parseInt(averageLatency) < goodLatencyThreshold
  const tooManyDroppedPings = droppedPingPercentage >= badDropRateThreshold
  const mostRecentPingDropped = pingHistory[pingHistory.length - 1].label === 'Not Returned'
  const mostRecentLatencyIsBad = parseInt(pingHistory[pingHistory.length - 1].label) >= questionableLatencyThreshold
  if (averageLatencyIsGood && !tooManyDroppedPings) {
    return 'good'
  } else if (mostRecentPingDropped || mostRecentLatencyIsBad) {
    return 'bad'
  } else {
    return 'questionable'
  }
}

function setIconBasedOnState (state) {
  if (state === 'good') {
    tray.setImage(goodConnectionIcon)
  } else if (state === 'questionable') {
    tray.setImage(questionableConnectionIcon)
  } else {
    tray.setImage(badConnectionIcon)
  }
}

function updateAverageLatency () {
  const averageLatency = calculateAverageLatency()
  const state = determineStateBasedOnLatency(averageLatency)
  setIconBasedOnState(state)
}

function pingEveryInterval () {
  intervalID = setInterval(doThePing, config.pingInterval)
}

function doThePing () {
  ping.promise.probe(config.server, {min_reply: 1}).then(function (pingResponse) {
    putResponseIntoHistory(pingResponse)
    updateAverageLatency()
    buildMenu()
  })
}

function putResponseIntoHistory (pingResponse) {
  pingHistory.push({label: pingResponse.time.toFixed().toString()})
  if (pingHistory.length > config.maxPingsToKeep) {
    pingHistory.splice(0, pingHistory.length - config.maxPingsToKeep)
  }
}

function getAutostartStatus () {
  autostart.isAutostartEnabled('thisApp').then((isEnabled) => {
    startOnLogin = isEnabled
    buildMenu()
  }).catch((error) => {
    console.error(error)
    buildMenu()
  })
}
