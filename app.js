const Koa = require('koa');
const range = require('koa-range');
const Router = require('koa-router');
const serve = require('koa-static');
const app = new Koa();
const router = new Router();

app.use(range);
app.use(serve('./public'));

const server = app.listen(3000);
const io = require('socket.io').listen(server);
io.on('connect', socket => {
    socket.on('sig', data => {
        console.log(data);
        socket.broadcast.emit('sig', data);
    });
});

