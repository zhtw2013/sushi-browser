window.debug = require('debug')('info')
// require('debug').enable("info")
const React = require('react')
import localForage from "localforage"
const {Component} = React
const {render,unmountComponentAtNode} = require('react-dom')
const SplitWindows = require("./SplitWindows")
const WebPageList = require("./WebPageList")
const DownloadList = require("./DownloadList")
const SearchAnything = require("./SearchAnything")
const PubSub = require('./pubsub')
// global.Perf = require('react-addons-perf');
const {remote} = require('electron')
const ipc = require('electron').ipcRenderer
const isDarwin = navigator.userAgent.includes('Mac OS X')
const [longPressMiddle,doubleShift] = ipc.sendSync('get-sync-main-states',['longPressMiddle','doubleShift'])

require('inferno').options.recyclingEnabled = true; // Advanced optimisation
global.lastMouseDown = []
global.lastMouseDownSet = new Set()
global.openerQueue = []

global.zoomMapping = new Map([
  [25,-6],[33,-5],[50,-4],[67,-3],[75,-2],[90,-1],[100,0],
  [110,1],[125,2],[150,3],[175,4],[200,5],[250,6],[300,7],[400,8],[500,9]
])

if(location.href.endsWith("index.html#")){
  try{
    for(let [url,path] of Object.entries(ipc.sendSync('get-sync-main-state','favicons'))){
      localForage.setItem(url,path)
    }
  }catch(e){
    console.log(e)
  }
}


function isFloatPanel(key){
  return key.startsWith('fixed-float')
}

export default class MainContent extends Component{
  handleResize(e) {
    const w = window.innerWidth
    const h = window.innerHeight
    if(w==this.w && h==this.h) return

    PubSub.publish("resizeWindow",{old_w:this.w,old_h:this.h,new_w:w,new_h:h,native:true})
    this.w = w
    this.h = h
  }




  componentDidMount() {
    window.addEventListener('resize', ::this.handleResize,{ passive: true });
    document.addEventListener('mousedown',e=>{
      let ele,key
      global.middleButtonLongPressing = (void 0)
      global.lastMouseDownSet.delete(e.target)
      global.lastMouseDownSet.add(e.target)

      const currentTabId = global.lastMouseDown[1]
      global.lastMouseDown = [e.target,global.lastMouseDown[0] == e.target ? global.lastMouseDown[1] : this.refs.splitWindow.getTabId(e.target)]
      if(currentTabId !== global.lastMouseDown[1]){
        ipc.send('change-tab-infos', [{tabId:global.lastMouseDown[1],active:true}])
      }
       if(e.target.tagName == 'WEBVIEW'){
        const key = e.target.className
        if(isFloatPanel(key)){
          PubSub.publish('float-panel',{key:key.slice(1)})
        }
      }
      else if(ele = e.target.closest('.float-panel')){
        PubSub.publish('float-panel',{ele})
      }

      if(e.button == 1){
        global.middleButtonPressing = Date.now()
      }
      else{
        global.middleButtonPressing = void 0
      }
    },{passive:true})

    document.addEventListener('mouseup',e=>{
      global.middleButtonLongPressing = (void 0)
      if(global.middleButtonPressing) global.middleButtonLongPressing = longPressMiddle && (Date.now() - global.middleButtonPressing > 320)
    },{passive:true})

    // For window level shortcuts that don't work as local shortcuts
    document.addEventListener('keydown', (e) => {
      const isForSecondaryAction = (e) =>
        (e.ctrlKey && !isDarwin) ||
        (e.metaKey && isDarwin) ||
        e.button === 1

      switch (e.which) {
        case 107:
          if (isForSecondaryAction(e)) {
            ipc.send('menu-or-key-events','zoomIn')
          }
          break
        case 109:
          if (isForSecondaryAction(e)) {
            ipc.send('menu-or-key-events','zoomOut')
          }
          break
      }
    }, { passive: true })


    // window.addEventListener('drop', function (event) {
    //   // allow webviews to handle dnd
    //   if (event.target.tagName === 'WEBVIEW') {
    //     return true;
    //   }
    //   event.preventDefault();
    //   return false;
    // }, true);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', ::this.handleResize,{ passive: true })
  }

  render() {
    return <SplitWindows ref="splitWindow"/>
  }
}

render(<WebPageList />, document.querySelector('#wvlist'))
render(<DownloadList />, document.querySelector('#dllist'))
render(<MainContent />, document.querySelector('#content'))

if(doubleShift){
  render(<SearchAnything />, document.querySelector('#anything'))
}

ipc.on('unmount-components',_=>{
  unmountComponentAtNode(document.querySelector('#wvlist'))
  unmountComponentAtNode(document.querySelector('#dllist'))
  unmountComponentAtNode(document.querySelector('#content'))
  unmountComponentAtNode(document.querySelector('#anything'))
})