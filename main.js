const {app, Menu, Tray, clipboard} = require('electron')
const autostart = require('node-autostart')
const ping  = require('ping')

let tray = null
let contextMenu = null
let intervalID = null
let startOnLogin = null

let pingHistory = []
let pingingEnabled = true

let averageLatency = 'No Returned Pings'

const config = {};
config.pingInterval = 5000
config.server = 'www.google.com'
config.maxPingsToKeep = 20

const goodLatencyThreshold = 100
const questionableLatencyThreshold = 500

const goodLatencyIcon = 'images/running-good@2x.png'
const questionableLatencyIcon = 'images/running-questionable@2x.png'
const badLatencyIcon = 'images/running-bad@2x.png'
const pausedIcon = 'images/paused@2x.png'

app.dock.hide()

app.on('ready', () => {
  tray = new Tray(questionableLatencyIcon)
  tray.setToolTip('am-i-connected')

  getAutostartStatus()

  pingEveryInterval()
})

function averageLatencyMenuItem() {
  return {label: 'Average Latency: ' + averageLatency, enabled: false};
}

function copyPingHistoryMenuItem() {
  return {label: 'Copy Ping History', click: function () {
    clipboardString = ''
    for (let ping of pingHistory)
      clipboardString += ping.label + '\n'
    clipboard.writeText(clipboardString)
  }};
}

function pingHistoryMenuItem() {
  return {label: 'Ping History', submenu: pingHistory}
}

function separator() {
  return {type: 'separator'}
}

function displayServerMenuItem() {
  return {label: 'Server: ' + config.server, enabled: false};
}

function switchServerMenuItem() {
  return {label: 'Switch to Server on Clipboard', click: function () {
    config.server = clipboard.readText()
    pingHistory = []
    averageLatency = 'No Returned Pings'
    tray.setImage(questionableLatencyIcon)
    buildMenu()
  }}
}

function pauseMenuItem() {
  return {label: pingingEnabled ? 'Pause' : 'Unpause', click: function () {
    if (pingingEnabled) {
      pingingEnabled = false
      tray.setImage(pausedIcon)
      clearInterval(intervalID)
    } else {
      pingingEnabled = true
      pingEveryInterval()
    }
    buildMenu()
  }}
}

function startOnLoginMenuItem() {
  return {label: (startOnLogin ? 'Disable' : 'Enable') + ' Start on Login', click: function () {
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
  }}
}

function quitMenuItem() {
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
function calculateAverageLatency() {
  let pingSum = 0
  let numReturnedPings = 0
  for (let ping of pingHistory) {
    if (typeof parseInt(ping.label) === 'number') {
      pingSum += parseInt(ping.label)
      numReturnedPings++
    }
  }
  averageLatency = numReturnedPings > 0 ? (pingSum / numReturnedPings).toFixed() + ' ms'  : 'No Returned Pings'
  return averageLatency;
}

function determineStateBasedOnLatency(averageLatency) {
  latencyIsGood = parseInt(averageLatency) < goodLatencyThreshold
  latencyisQuestionable = parseInt(averageLatency) < questionableLatencyThreshold
  if (latencyIsGood) {
    return 'good';
  } else if (latencyisQuestionable) {
    return 'questionable';
  } else {
    return 'bad';
  }
}

function setIconBasedOnState(state) {
  if (state === 'good') {
    tray.setImage(goodLatencyIcon)
  } else if (state === 'questionable') {
    tray.setImage(questionableLatencyIcon)
  } else {
    tray.setImage(badLatencyIcon)
  }
}

function updateAverageLatency () {
  const averageLatency = calculateAverageLatency();
  const state = determineStateBasedOnLatency(averageLatency);
  setIconBasedOnState(state);
}

function pingEveryInterval () {
  intervalID = setInterval(doThePing, config.pingInterval)
}

function doThePing() {
  ping.promise.probe(config.server, {min_reply: 1}).then(function(pingResponse) {
    putResponseIntoHistory(pingResponse);
    updateAverageLatency();
    buildMenu();
  })
}

function putResponseIntoHistory(pingResponse) {
  pingHistory.push({label: pingResponse.time.toFixed().toString()})
  if (pingHistory.length > config.maxPingsToKeep)
    pingHistory.splice(0, pingHistory.length - config.maxPingsToKeep)
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
