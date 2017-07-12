const {app, Menu, Tray} = require('electron')

let tray = null
let contextMenu
let pingHistory = [{label: 'blah'}]

app.on('ready', () => {
  tray = new Tray('menuBarIcon@2x.png')
  tray.setToolTip('am-i-connected')
  buildMenu()


})

function buildMenu () {
  contextMenu = Menu.buildFromTemplate([
    {label: 'Average Latency'},
    {label: 'Copy Ping History', click: function () {
      // pingHistory.push({label: 'hi'})
      // buildMenu()
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
