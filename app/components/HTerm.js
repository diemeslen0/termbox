import {h, Component} from 'preact'
import {hterm, lib} from 'hterm-umdjs'
import ReconnectingWebSocket from 'reconnecting-websocket'
import themes from '../themes'

hterm.defaultStorage = new lib.Storage.Memory()

function applyTheme({name, values}, term) {

  term.prefs_.resetAll()

  term.prefs_.set('audible-bell-sound', '')
  term.prefs_.set('scroll-wheel-move-multiplier', 15)

  Object.keys(values).forEach((key) => {
    term.prefs_.set(key, values[key])
  })

  localStorage.setItem('termbox-terminal-theme', name)
}

export default class HTerm extends Component {

  shouldComponentUpdate() {
    return false
  }

  componentDidMount() {
    // the first requestAnimationFrame should not be needed since the
    // component should be rendered in componentDidMount()
    // some people however reported issues with this.base not being set
    requestAnimationFrame(() => {
      let elem = document.createElement('div')
      elem.style.position = 'relative'
      elem.style.width = '100%'
      elem.style.height = '100%'
      this.base.append(elem)

      requestAnimationFrame(() => { this.init(this.props, elem) })
    })

  }

  init({onOpen, onError, onClose, podId, getThemeChangeHandler}, elem) {

    let term = new hterm.Terminal()
    term.decorate(elem)

    let theme = themes.find((t) => t.name == localStorage.getItem('termbox-terminal-theme'))
    if(!theme) {
      theme = themes[0]
    }
    applyTheme(theme, term)

    let ws = new ReconnectingWebSocket(`ws${location.protocol === 'https:' ? 's' : ''}://${location.host}/boxes/${podId}/exec`)

    function HTerm(argv) {
      this.io = argv.io.push()
    }

    HTerm.prototype.run = function() {
      this.io.onVTKeystroke = this.io.sendString = (str) => {
        ws.send(JSON.stringify({data: str}))
      }
      this.io.onTerminalResize = (width, height) => {
        ws.send(JSON.stringify({width, height}))
      }
    }

    let initSize = (io) => {
      initSize = false
      ws.send(JSON.stringify({
        width: term.io.columnCount,
        height: term.io.rowCount,
      }))
    }

    ws.onmessage = (ev) => {
      term.io.print(ev.data)
      if(initSize) initSize()
    }

    ws.onclose = () => {
      if(onOpen) onClose()
    }

    ws.onerror = (e) => {
      if(onError) onError(e)
    }

    ws.onopen = () => {
      term.reset()
      term.runCommandClass(HTerm)
      if(onOpen) onOpen()
    }

    if(getThemeChangeHandler) {
      getThemeChangeHandler((theme) => {
        applyTheme(theme, term)
      })
    }
  }

  render() {
    return <div style={{height: '100%'}}></div>
  }
}
