const {app, Menu, Tray} = require('electron')
let ping  = require('ping')

let tray = null
let contextMenu = null
let pingHistory = []
let averageLatency = 'No Returned Pings'
const pingInterval = 5000
const server = 'www.google.com'
const maxPingsToKeep = 20

app.on('ready', () => {
  tray = new Tray('menuBarIcon@2x.png')
  tray.setToolTip('am-i-connected')
  buildMenu()

  setInterval(function () {
    ping.promise.probe(server, {min_reply: 1}).then(function(pingResponse) {
      pingHistory.push({label: pingResponse.time.toFixed().toString()})
      if (pingHistory.length > maxPingsToKeep) pingHistory.splice(0, pingHistory.length - maxPingsToKeep)
      averageLatency = getAverageLatency(pingHistory)
      buildMenu()
    })
  }, pingInterval)
})

function buildMenu () {
  contextMenu = Menu.buildFromTemplate([
    {label: 'Average Latency: ' + averageLatency},
    {label: 'Copy Ping History', click: function () {

    }},
    {label: 'Ping History', submenu: pingHistory},
    {type: 'separator'},
    {label: 'Settings', submenu: [
      {label: 'Start on Login', click: function () {

      }},
      {label: 'Disable Start on Login', click: function () {

      }}
    ]},
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
