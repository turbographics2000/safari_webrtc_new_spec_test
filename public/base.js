const socket = io();
let pc = null, cnv = null, ctx = null, rafId = null;
btnConnect.onclick = evt => {
    createPC(true);
};

async function createPC(isCaller) {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = evt => {
        socket.emit('sig', { candidate: evt.candidate });
    }
    pc.ontrack = evt => {
        remoteView.srcObject = evt.streams[0];
    };
    pc.onnegotiationneeded = async evt => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('sig', { offer });
    };
    if (isCaller) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        localView.srcObject = stream;
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
    } else {
        localView.onloadedmetadata = evt => {
            cnv = document.createElement('canvas');
            cnv.width = localView.videoWidth;
            cnv.height = localView.videoHeight;
            ctx = cnv.getContext('2d');
            rafId = requestAnimationFrame(canvasRender);
            const stream = cnv.captureStream(15);
            stream.getTracks().forEach(track => pc.addTrack(track, stream));
        };
        localView.src = 'sintel.mp4';
    }
}

socket.on('connect', _ => {
    socket.on('sig', async data => {
        if (!pc) {
            createPC();
        }
        if (data.offer) {
            await pc.setRemoteDescription(data.offer);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('sig', { answer });
        } else if (data.answer) {
            await pc.setRemoteDescription(data.answer);
        } else if (data.candidate) {
            await pc.addIceCandidate(data.candidate);
        }
    });
});

function canvasRender() {
    rafId = requestAnimationFrame(canvasRender);
    ctx.drawImage(localView, 0, 0);
}
