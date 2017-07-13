const {app, Menu, Tray, clipboard} = require('electron')
let ping  = require('ping')

let tray = null
let contextMenu = null
let intervalID = null

let pingHistory = []
let appEnabled = true
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
    {label: 'Average Latency: ' + averageLatency},
    {label: 'Copy Ping History', click: function () {
      clipboardString = ''
      for (let i = 0; i < pingHistory.length; i++)
        clipboardString += pingHistory[i].label + '\n'
      clipboard.writeText(clipboardString)
    }},
    {label: 'Ping History', submenu: pingHistory},
    {type: 'separator'},

    {label: 'Switch to Server on Clipboard', click: function () {
      server = clipboard.readText()
      pingHistory = []
      averageLatency = 'No Returned Pings'
      tray.setImage(questionableLatencyIcon)
      buildMenu()
    }},
    {type: 'separator'},

    {label: appEnabled ? 'Pause' : 'Unpause', click: function () {
      if (appEnabled) {
        appEnabled = false
        clearInterval(intervalID)
      } else {
        appEnabled = true
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
function getAverageLatency (pingHistory) {
  let pingSum = 0
  let numReturnedPings = 0
  for (let i = 0; i < pingHistory.length; i++) {
    if (typeof parseInt(pingHistory[i].label) === 'number') {
      pingSum += parseInt(pingHistory[i].label)
      numReturnedPings++
    }
  }
  return numReturnedPings > 0 ? (pingSum / numReturnedPings).toFixed() + ' ms'  : 'No Returned Pings'
}

function startPinging () {
  intervalID = setInterval(function () {
    ping.promise.probe(server, {min_reply: 1}).then(function(pingResponse) {
      pingHistory.push({label: pingResponse.time.toFixed().toString()})
      if (pingHistory.length > maxPingsToKeep)
        pingHistory.splice(0, pingHistory.length - maxPingsToKeep)

      averageLatency = getAverageLatency(pingHistory)
      if (parseInt(averageLatency) < goodLatencyThreshold) {
        tray.setImage(goodLatencyIcon)
      } else if (parseInt(averageLatency) < questionableLatencyThreshold) {
        tray.setImage(questionableLatencyIcon)
      } else {
        tray.setImage(badLatencyIcon)
      }

      buildMenu()
    })
  }, pingInterval)
}
