class FireDB {

    init() {
        try {
            const configStr = "xxxxx" // your firebase key
            const config = JSON.parse(atob(configStr))
            firebase.initializeApp(config);
            this.db = firebase.firestore();
            console.log("initialized db")
        } catch(err) {
            console.log("failed to intialize db", err)
        }
    }

    async add(col, obj) {
        try {
            await this.db.collection(col).add(obj)
            console.log("added object")
        } catch(err) {
            console.log("failed to add ")
        }
    }

    async fetch(col) {
        try {
            const querySnapshot = await this.db.collection(col).get()
            return querySnapshot 
        } catch(err) {
            return []
        }
    }
}

class DimensionController {

    constructor() {
        this.w = window.innerWidth 
        this.h = window.innerHeight 
    }

    handleResize() {
        window.onresize = () => {
            this.w = window.innerWidth 
            this.h = window.innerHeight 
        }
    }
}

const fireDb = new FireDB()
fireDb.init()

const dimensionController = new DimensionController()
dimensionController.handleResize()

const delay = 20
const scGap = 0.02 

class Loop {

    animated = false 

    start(cb) {
        if (!this.animated) {
            this.animated = true 
            this.interval = setInterval(cb, delay)
        }    
    }

    stop() {
        if (this.animated) {
            this.animated = false
            clearInterval(this.interval)
        }
    }
}

class State {

    constructor() {
        this.scale = 0 
    }

    update(cb) {
        this.scale += scGap 
        console.log(this.scale)
        if (Math.abs(this.scale) > 1) {
            this.scale = 1 
            cb()
        }
    }
}

class Block {

    constructor(x, y, t) {
        this.x = x 
        this.y = y 
        this.t = t 
        this.state = new State()
    }

    draw(context) {
        const w = dimensionController.w 
        const h = dimensionController.h
        const sf = Math.sin(this.state.scale * Math.PI)
        const size = sf * Math.min(w, h) / 10
        context.save()
        context.translate(this.x, this.y)
        context.fillStyle = '#009688'
        context.fillRect(-size / 2, -size / 2, size, size)
        context.restore()
    }

    update(cb) {
        this.state.update(cb)
    }
}

class Counter {

    constructor() {
        this.t = 0 
        this.dir = 0 
    }

    update() {
        this.t += this.dir 
    }

    start() {
        this.dir = 1
    }
}

class BlockContainer {

    blocks = [] 
    
    addBlock(x, y, t) {
        this.blocks.push(new Block(x, y, t))   
    }

    draw(context) {
        this.blocks.forEach((block) => {
            block.draw(context)
        })
    }

    update() {
        this.blocks.forEach((block) => {
            block.update(() => {
                this.blocks.splice(0, 1)
            })
        })
    }
}

class Renderer {

    bc = new BlockContainer()
    dbBlocks = [] 

    render(context) {
        this.bc.draw(context)
    }

    update() {
        this.bc.update()
    }

    addBlock(x, y, t) {
        if (this.dbBlocks.length == 0) {
            this.bc.addBlock(x, y, t)
        } else {
            console.error("can't add block during render of db blocks")
        }
    }

    addDbBlock(block) {
        this.dbBlocks.push(block)
    }

    sortDBBlocks() {
        this.dbBlocks.sort((block1, block2) => block1.t - block2.t)
    }

    printDBBlocks() {
        this.dbBlocks.forEach((block) => {console.log("Block:", block)})
    }

    prepareRenderForDbBlock(t) {
        if (this.dbBlocks.length != 0 && this.dbBlocks[0].t == t) {
            console.log("Adding block from dbBlock")
            const {x, y, t} = this.dbBlocks[0]
            this.bc.addBlock(x, y, t)
            this.dbBlocks.splice(0, 1)
        }
    }
}

const counter = new Counter()
class Stage {

    init() {
        this.renderer = new Renderer()
        this.canvas = document.createElement('canvas')
        this.canvas.width = dimensionController.w 
        this.canvas.height = dimensionController.h 
        this.context = this.canvas.getContext('2d')
        document.body.appendChild(this.canvas)
    }

    render() {
        this.context.fillStyle = '#bdbdbd'
        this.context.fillRect(0, 0, dimensionController.w, dimensionController.h)
        this.renderer.render(this.context)
    }

    update(t) {
        this.renderer.prepareRenderForDbBlock(t)
        this.renderer.update()
    }
    handleTap() {
        this.canvas.onmousedown = (e) => {
            const {offsetX, offsetY} = e 
            console.log("clicked on ", offsetX, offsetY)
            this.renderer.addBlock(offsetX, offsetY, counter.t)
            fireDb.add('blocks', {
                x : offsetX, 
                y: offsetY, 
                t: counter.t
            })
        }
    }

    handleDb() {
        fireDb.fetch('blocks').then((qs) => {
            
            qs.forEach((doc) => {
                const block = doc.data()
                this.renderer.addDbBlock(block)
            })  
            console.log("starting counter")
            this.renderer.sortDBBlocks()
            this.renderer.printDBBlocks()
            counter.start()  
            
        }).catch((e) => {
            console.error(e)
            counter.start()
        })
    }
}


const stage = new Stage()
dimensionController.handleResize()
stage.init()
stage.handleTap()
stage.handleDb()
const loop = new Loop()
console.log("started up")
loop.start(() => {
    counter.update()
    stage.render()
    stage.update(counter.t)
}) 