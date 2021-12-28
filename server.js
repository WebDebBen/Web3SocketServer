const app = require('express')()
const server = require('http').Server(app)
const io = require('socket.io')(server, {
    cors : {
        credentials: false,
        origin: '*',
    },
    // transports: ['websocket'],
    // upgrade: false
})
const dev = process.env.NODE_ENV !== 'production'

let port = 8080

const Rock = 1;
const Paper = 2;
const Scissors = 3;

let rooms = []

io.on('connect', (socket) => {
    console.log("=================== connected ", socket.id, " connect : ", io.engine.clientsCount)
    socket.on('new_player', (roomId, address) => {
        console.log("connected ", roomId, address)
        let isRoomExist = false

        rooms.forEach((value) => {
            if(roomId == value.roomId) {
                isRoomExist = true

                if(value.player1.address != null && value.player2.address != null && value.player1.address != address && value.player2.address != address) {
                    if(!value.viewers.includes(address)) {
                        value.viewers.push(address)
                        console.log("=== joined as view ===", value.viewers)
                        socket.broadcast.emit('joined_as_view', value.viewers)
                    }
                }
                else {
                    if(value.player1.address == null) {
                        value.player1.address = address
                        value.player1.socketId = socket.id
                        console.log("=== joined ===")
                        socket.emit('joined', value.player2.address)
                        socket.broadcast.emit('joined', address)
                    }
                    else if(value.player2.address == null) {
                        value.player2.address = address
                        value.player2.socketId = socket.id
                        console.log("=== joined ===")
                        socket.emit('joined', value.player1.address)
                        socket.broadcast.emit('joined', address)
                    }
                    // if(value.player1.address != address && value.player2.address != address) {
                    //     value.player2.address = address
                    //     console.log("=== joined ===")
                    //     socket.emit('joined', value.player1.address)
                    //     socket.broadcast.emit('joined', address)
                    // }
                }
            }
        })

        if(!isRoomExist) {
            // in the future
        }
        console.log('rooms - ', rooms)
    })

    socket.on('picked_from_client', async (address, playerStatus) => {
        console.log("=================== connected ", io.engine.clientsCount)
        console.log('picked - ', address, playerStatus)

        let ret = {}
        rooms.forEach((value) => {
            let tmp = value
            // console.log(tmp, address, "======")
            if(address == tmp.player1.address) {
                tmp.player1.pick = playerStatus
                if(tmp.player2.pick != 0) {
                    if( (tmp.player1.pick == Paper && tmp.player2.pick == Scissors) ||
                        (tmp.player1.pick == Scissors && tmp.player2.pick == Paper) ||
                        ( tmp.player1.pick == Paper && tmp.player2.pick == Rock)){

                            tmp.winner_address = address;
                            tmp.player1.winning++;
                    }

                    if( (tmp.player1.pick == Scissors && tmp.player2.pick == Rock) || 
                        (tmp.player1.pick == Paper && tmp.player2.pick == Scissors) || 
                        (tmp.player1.pick == Rock && tmp.player2.pick == Paper)){

                            tmp.winner_address = tmp.player2.address;
                            tmp.player2.winning++;
                    }

                    if( (tmp.player1.pick == Rock && tmp.player2.pick == Rock) || 
                        (tmp.player1.pick == Scissors && tmp.player2.pick == Scissors) || 
                        (tmp.player1.pick == Paper && tmp.player2.pick == Paper)) {

                            tmp.winner_address = '';
                    }
                }
            }
            else if(address == tmp.player2.address) {
                tmp.player2.pick = playerStatus
                if(tmp.player1.pick != 0) {
                    if( (tmp.player1.pick == Paper && tmp.player2.pick == Scissors) || 
                        (tmp.player1.pick == Scissors && tmp.player2.pick == Paper) ||
                        (tmp.player1.pick == Paper && tmp.player2.pick == Rock)) {
                            tmp.winner_address = tmp.player1.address;
                            tmp.player1.winning++;
                    }

                    if( (tmp.player1.pick == Scissors && tmp.player2.pick == Rock) || 
                        (tmp.player1.pick == Paper && tmp.player2.pick == Scissors) || 
                        (tmp.player1.pick == Rock && tmp.player2.pick == Paper)) {
                            tmp.winner_address = address;
                            tmp.player2.winning++;
                    }

                    if( (tmp.player1.pick == Rock && tmp.player2.pick == Rock) || 
                        (tmp.player1.pick == Scissors && tmp.player2.pick == Scissors) || 
                        (tmp.player1.pick == Paper && tmp.player2.pick == Paper)) {
                            tmp.winner_address = '';
                    }
                }
            }
            // console.log(tmp)
            ret = tmp
        })

        let t = {...ret };
        if (t.player1.pick != 0 && t.player2.pick != 0 ){
            //if (ret.roundNo == 5 ){
            //    io.volatile.emit('picked_finished', t )
            //}else{
            if(ret.roundCount == ret.roundNo) {
                if(ret.player1.winning > ret.player2.winning) {
                    io.sockets.sockets.get(ret.player1.socketId).emit('GAMEOVER', 1)
                    io.sockets.sockets.get(ret.player2.socketId).emit('GAMEOVER', -1)
                }
                else if(ret.player1.winning < ret.player2.winning) {
                    io.sockets.sockets.get(ret.player1.socketId).emit('GAMEOVER', -1)
                    io.sockets.sockets.get(ret.player2.socketId).emit('GAMEOVER', 1)
                }
            }
            else {
                io.emit('picked_from_server', t )
                ret.roundNo++;
                ret.player1.pick = 0
                ret.player2.pick = 0
            }
        }
    })

    socket.on('SET_ROUND_COUNT', (roundCount, roomId) => {
        let room = {
            roomId,
            roundNo: 1,
            roundCount,
            player1: { address: null, winning: 0, pick: 0, socketId: null },
            player2: { address: null, winning: 0, pick: 0, socketId: null },
            winner_address: null, game_winner: 0,
            viewers: []
        }
        rooms.push(room)
    })

    socket.on('disconnect', (arg) => {
        console.log('disconnected - ', socket.id, " counnt : ", io.engine.clientsCount)
        rooms.forEach((value) => {
            if(socket.id == value.player1.socketId) {
                resetPlayer(value.player1)
                io.emit("disconnected")
            }
            else if(socket.id == value.player2.socketId) {
                resetPlayer(value.player2)
                io.emit("disconnected")
            }
        })
        console.log("rooms - ", rooms)
    })
})

const resetPlayer = (obj) => {
    obj.address = null
    obj.winning = 0
    obj.pick = 0
    obj.socketId = null
}


app.get('*', (req, res) => {
	// return nextHandler(req, res)
	return res.send('Hello World')
})

server.listen(port, (err) => {
	if(err) throw err
	console.log(`> Ready on http://localhost:${port}`)
})
