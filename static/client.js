const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

let stream;
let sending = false;
let socket;

startBtn.onclick = async () => {
  if (!socket) {
    socket = io({transports: ['websocket']});
    socket.on('connect', () => status.innerText = 'Connected to server');
    socket.on('response_frame', (msg) => {
      const img = new Image();
      img.src = msg.image;
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
    });
  }

  stream = await navigator.mediaDevices.getUserMedia({video: { width: 640, height: 480 }, audio: false});
  video.srcObject = stream;
  sending = true;
  sendLoop();
};

stopBtn.onclick = () => {
  sending = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }
  status.innerText = 'Stopped';
};

function captureFrame() {
  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = video.videoWidth;
  tmpCanvas.height = video.videoHeight;
  const tmpCtx = tmpCanvas.getContext('2d');
  tmpCtx.drawImage(video, 0, 0, tmpCanvas.width, tmpCanvas.height);
  return tmpCanvas.toDataURL('image/jpeg', 0.6);
}

async function sendLoop() {
  while (sending) {
    if (video.readyState >= 2 && socket && socket.connected) {
      const frameB64 = captureFrame();
      socket.emit('frame', { image: frameB64 });
    }
    // control send rate: e.g., 4 fps
    await new Promise(r => setTimeout(r, 250));
  }
}
