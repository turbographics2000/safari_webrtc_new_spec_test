const socket = io();
let pc = null, cnv = null, ctx = null, rafId = null;

navigator.mediaDevices.enumerateDevices().then(devices => {
    const camDevices = devices.filter(device => device.kind === 'videoinput');
    camDevices.forEach((device, i) => {
        createElm('option', [], device.label || `cam-${i}`, device.deviceId, videoSelect);
    });
});

btnConnect.onclick = evt => createPC(true);

btnReload.onclick = evt => {
    socket.emit('sig', { reload: true });
    setTimeout(_ => location.reload(true), 100);
}

btnLogClear.onclick = evt => logList.innerHTML = '';

const filter = {action: null, data: null};
document.querySelectorAll('input[name=logActionTypeFilter]').forEach(elm => filterEventHandler(elm, 'action'));
document.querySelectorAll('input[name=logDataTypeFilter]').forEach(elm => filterEventHandler(elm, 'data'));
function filterEventHandler(elm, type) {
    elm.onclick = evt => {
        filter.data = evt.target.value.split('-');
        if (filter[type].length === 1 && filter[type][0] === '') {
            filter[type] = null;
        }
        logFilter();
    };
}

async function createPC(isCaller) {
    pc = new RTCPeerConnection(null);

    pc.onicecandidate = evt => {
        addLog('pc', 'candidate', 'onicecandidate', evt.candidate);
        addLog('signaling', 'candidate', 'send candidate', evt.candidate);
        socket.emit('sig', { candidate: evt.candidate });
    };

    pc.ontrack = evt => {
        addLog('pc', 'stream', 'ontrack', evt.streams[0]);
        remoteView.srcObject = evt.streams[0];
        addLog('ui', 'stream', 'set remoteView.srcObject', evt.streams[0]);
    };

    pc.onnegotiationneeded = async evt => {
        addLog('pc', 'offer', 'onnegotiationneeded');
        const offer = await pc.createOffer();
        addLog('pc', 'offer', 'createOffer()', offer);
        await pc.setLocalDescription(offer);
        addLog('pc', 'offer', 'setLocalDescription()', offer);
        socket.emit('sig', { offer });
        addLog('signaling', 'offer', 'send offer', offer);
    };

    if (isCaller) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        addLog('ui', 'stream', 'getUserMedia()', stream);
        localView.srcObject = stream;
        addLog('ui', 'stream', 'set localView.srcObject', stream);
        stream.getTracks().forEach(track => {
            pc.addTrack(track, stream);
            addLog('pc', 'stream', 'addTrack()', track);
        });
    } else {
        localView.onloadedmetadata = evt => {
            addLog('ui', 'stream', 'prepaer canvas');
            cnv = document.createElement('canvas');
            cnv.width = localView.videoWidth;
            cnv.height = localView.videoHeight;
            ctx = cnv.getContext('2d');
            rafId = requestAnimationFrame(canvasRender);
            setTimeout(_ => {
                const stream = cnv.captureStream(15);
                addLog('ui', 'stream', 'captureStream()', stream);
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                    addLog('pc', 'stream', 'addTrack()', track);
                });
            });
        };
        localView.src = 'sintel.mp4';
    }
}

socket.on('connect', _ => {
    console.log('socket connect');
    socket.on('sig', async data => {
        if (!pc) {
            createPC();
            addLog('pc', 'pc', 'createPC');
        }
        if (data.offer) {
            addLog('signaling', 'offer', 'receive offer', data.offer);
            await pc.setRemoteDescription(data.offer);
            addLog('pc', 'offer', 'setRemoteDescription', data.offer);
            const answer = await pc.createAnswer();
            addLog('pc', 'answer', 'createAnswer', answer);
            await pc.setLocalDescription(answer);
            addLog('pc', 'answer', 'setLocalDescription', answer);
            socket.emit('sig', { answer });
            addLog('signaling', 'answer', 'send answer', answer);
        } else if (data.answer) {
            addLog('signaling', 'answer', 'receive answer', data.answer);
            await pc.setRemoteDescription(data.answer);
            addLog('pc', 'answer', 'setRemoteDescription', data.answer);
        } else if (data.candidate) {
            addLog('signaling', 'candidate', 'receive candidate', data.candidate);
            await pc.addIceCandidate(data.candidate);
            addLog('pc', 'candidate', 'addIceCandidate', data.candidate);
        } else if (data.reload) {
            location.reload(true);
        }
    });
});


function createElm(tagName, classes = [], text = '', value = '', parent = null) {
    const elm = document.createElement(tagName);
    elm.className = classes.join(' ');
    elm.title = elm.textContent = text;
    if (value) elm.value = value;
    if (parent) parent.appendChild(elm);
    return elm;
}

function addLog(type, subType, msg, data = '') {
    console.log(msg, data);
    const dt = new Date();
    const item = createElm('div', ['item', type]);
    createElm('div', ['time'], [dt.getHours(), dt.getMinutes(), dt.getSeconds()].map(i => `${i}`.padStart(2, '0')).join(':') + '.' + `${dt.getMilliseconds()}`.padStart(3, '0'), item);
    createElm('div', ['msg'], msg, null, item);
    let dataStr = '';
    if (!data) {
        dataStr = null;
    } else if (typeof data === 'string') {
        dataStr = data;
    } else if (data instanceof MediaStream) {
        dataStr = `stream.id: ${data.id} [`;
        dataStr += data.getTracks().map((track, i) => {
            return `track[${i}]: { kind: ${track.kind}, id: ${track.id} }`;
        }).join(', ');
        dataStr += ']';
    } else if (data instanceof MediaStreamTrack) {
        dataStr = `track.kind: ${data.kind}, track.id: ${data.id}`;
    } else {
        dataStr = JSON.stringify(data);
    }
    createElm('div', ['data', subType, data ? '' : 'hide'], dataStr, null, item);
    logList.insertBefore(item, logList.firstChild);
    logFilter();
}

function logFilter() {
    document.querySelectorAll('#logList .item').forEach(item => {
        if ((!filter.action || filter.action.some(type => item.classList.contains(type))) &&
            (!filter.data || filter.data.some(subType => item.querySelector('.data').classList.contains(subType)))
        ) {
            item.classList.add('hilight');
        } else {
            item.classList.remove('hilight');
        }
    });
}

function canvasRender() {
    rafId = requestAnimationFrame(canvasRender);
    ctx.drawImage(localView, 0, 0);
}
