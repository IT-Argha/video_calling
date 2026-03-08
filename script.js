// WhatsApp-Style Video Call JavaScript

class VideoCallApp {
    constructor() {
        // Check for WebRTC support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.');
            return;
        }

        if (!window.RTCPeerConnection) {
            alert('WebRTC PeerConnection is not supported in this browser.');
            return;
        }

        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.roomId = null;
        this.userName = null;
        this.isInitiator = false;
        this.isConnected = false;
        this.callStartTime = null;
        this.timerInterval = null;
        this.localCandidates = [];
        this.dataChannel = null;

        this.initElements();
        this.initEventListeners();
        this.initWebRTC();
    }

    initElements() {
        this.joinScreen = document.getElementById('join-screen');
        this.callScreen = document.getElementById('call-screen');
        this.remoteVideo = document.getElementById('remote-video');
        this.localVideo = document.getElementById('local-video');
        this.status = document.getElementById('status');
        this.timer = document.getElementById('timer');
        this.roomInfo = document.getElementById('room-info');
        this.roomIdDisplay = document.getElementById('room-id-display');
        this.offerText = document.getElementById('offer-text');
        this.answerText = document.getElementById('answer-text');
        this.answerInput = document.getElementById('answer-input');
        this.offerInput = document.getElementById('offer-input');
        this.connectionIndicator = document.getElementById('connection-indicator');

        this.createRoomBtn = document.getElementById('create-room-btn');
        this.joinRoomBtn = document.getElementById('join-room-btn');
        this.roomIdInput = document.getElementById('room-id-input');
        this.userNameInput = document.getElementById('user-name-input');
        this.copyRoomBtn = document.getElementById('copy-room-btn');
        this.copyOfferBtn = document.getElementById('copy-offer-btn');
        this.submitAnswerBtn = document.getElementById('submit-answer-btn');
        this.submitOfferBtn = document.getElementById('submit-offer-btn');
        this.copyAnswerBtn = document.getElementById('copy-answer-btn');

        this.initiatorControls = document.getElementById('initiator-controls');
        this.joinControls = document.getElementById('join-controls');

        this.micBtn = document.getElementById('mic-btn');
        this.camBtn = document.getElementById('cam-btn');
        this.screenShareBtn = document.getElementById('screen-share-btn');
        this.endCallBtn = document.getElementById('end-call-btn');
        this.chatBtn = document.getElementById('chat-btn');
        this.chatPanel = document.getElementById('chat-panel');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendChatBtn = document.getElementById('send-chat-btn');
    }

    initEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.copyRoomBtn.addEventListener('click', () => this.copyToClipboard(this.roomIdDisplay.textContent));
        this.copyOfferBtn.addEventListener('click', () => this.copyToClipboard(this.offerText.value));
        this.submitAnswerBtn.addEventListener('click', () => this.submitAnswer());
        this.submitOfferBtn.addEventListener('click', () => this.submitOffer());
        this.copyAnswerBtn.addEventListener('click', () => this.copyToClipboard(this.answerText.value));

        this.micBtn.addEventListener('click', () => this.toggleMic());
        this.camBtn.addEventListener('click', () => this.toggleCam());
        this.screenShareBtn.addEventListener('click', () => this.toggleScreenShare());
        this.endCallBtn.addEventListener('click', () => this.endCall());
        this.chatBtn.addEventListener('click', () => this.toggleChat());
        this.sendChatBtn.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    initWebRTC() {
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        };
        this.peerConnection = new RTCPeerConnection(configuration);

        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.localCandidates.push(event.candidate);
            }
        };

        this.peerConnection.ontrack = (event) => {
            if (!this.remoteStream) {
                this.remoteStream = new MediaStream();
                this.remoteVideo.srcObject = this.remoteStream;
            }
            this.remoteStream.addTrack(event.track);
        };

        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };

        this.peerConnection.onconnectionstatechange = () => {
            this.updateStatus();
        };
    }

    async startLocalStream() {
        try {
            this.status.textContent = 'Status: Requesting camera/microphone access...';
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            this.localVideo.srcObject = this.localStream;
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
            return true;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Camera/microphone access denied or not available. Error: ' + error.message);
            return false;
        }
    }

    setupDataChannel() {
        this.dataChannel.onmessage = (event) => {
            this.displayMessage('Remote: ' + event.data);
        };
        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.isConnected = true;
            this.displayMessage('System: Chat connected!');
            this.status.textContent = 'Status: Connected - Chat ready!';
        };
        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.isConnected = false;
            this.displayMessage('System: Chat disconnected');
        };
        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.displayMessage('System: Chat error occurred');
        };
    }

    generateRoomId() {
        return Math.random().toString(36).substr(2, 5).toUpperCase();
    }

    waitForIceGathering() {
        return new Promise((resolve) => {
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
            } else {
                this.peerConnection.onicegatheringstatechange = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        resolve();
                    }
                };
            }
        });
    }

    async createRoom() {
        const userName = this.userNameInput.value.trim();
        if (!userName) {
            alert('Please enter your name before joining the call.');
            this.userNameInput.focus();
            return;
        }
        this.userName = userName;

        try {
            this.isInitiator = true;
            this.roomId = this.generateRoomId();
            this.roomIdDisplay.textContent = this.roomId;
            this.roomInfo.classList.remove('hidden');
            this.initiatorControls.classList.remove('hidden');
            this.joinControls.classList.add('hidden');

            this.showCallScreen();
            
            // Start local stream (camera and microphone)
            this.status.textContent = 'Status: Requesting camera/microphone access...';
            const streamSuccess = await this.startLocalStream();
            if (!streamSuccess) {
                return;
            }

            // Create data channel for chat
            this.dataChannel = this.peerConnection.createDataChannel('chat');
            this.setupDataChannel();

            this.status.textContent = 'Status: Creating offer...';
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);

            this.status.textContent = 'Status: Gathering ICE candidates...';
            // Wait for ICE gathering to complete
            await this.waitForIceGathering();

            this.offerText.value = JSON.stringify({
                type: 'offer',
                sdp: offer.sdp,
                candidates: this.localCandidates,
                roomId: this.roomId
            }, null, 2);

            this.status.textContent = 'Status: Offer created, copy and send to joiner';
        } catch (error) {
            console.error('Error creating room:', error);
            alert('Error creating room: ' + error.message);
        }
    }

    async joinRoom() {
        const userName = this.userNameInput.value.trim();
        if (!userName) {
            alert('Please enter your name before joining the call.');
            this.userNameInput.focus();
            return;
        }
        this.userName = userName;

        const roomId = this.roomIdInput.value.trim();
        if (!roomId) {
            alert('Please enter a Room ID');
            return;
        }

        try {
            this.roomId = roomId;
            this.isInitiator = false;
            this.roomInfo.classList.remove('hidden');
            this.initiatorControls.classList.add('hidden');
            this.joinControls.classList.remove('hidden');

            this.showCallScreen();
            
            // Start local stream (camera and microphone)
            this.status.textContent = 'Status: Requesting camera/microphone access...';
            const streamSuccess = await this.startLocalStream();
            if (!streamSuccess) {
                return;
            }
            
            this.status.textContent = 'Status: Ready to join room - paste offer and submit';
        } catch (error) {
            console.error('Error joining room:', error);
            alert('Error joining room: ' + error.message);
        }
    }

    async submitAnswer() {
        try {
            this.status.textContent = 'Status: Processing answer...';
            const answerData = JSON.parse(this.answerInput.value);
            if (answerData.type === 'answer') {
                this.status.textContent = 'Status: Setting remote description...';
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
                    type: 'answer',
                    sdp: answerData.sdp
                }));

                this.status.textContent = 'Status: Adding ICE candidates...';
                // Add remote ICE candidates
                if (answerData.candidates) {
                    for (const candidate of answerData.candidates) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.warn('Error adding ICE candidate:', e);
                        }
                    }
                }

                this.status.textContent = 'Status: Answer submitted, establishing connection...';
            }
        } catch (error) {
            console.error('Error submitting answer:', error);
            this.status.textContent = 'Status: Error processing answer - ' + error.message;
            alert('Error submitting answer: ' + error.message);
        }
    }

    async submitOffer() {
        try {
            this.status.textContent = 'Status: Processing offer...';
            const offerData = JSON.parse(this.offerInput.value);
            if (offerData.type === 'offer') {
                this.status.textContent = 'Status: Setting remote description...';
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription({
                    type: 'offer',
                    sdp: offerData.sdp
                }));

                this.status.textContent = 'Status: Adding ICE candidates...';
                // Add remote ICE candidates
                if (offerData.candidates) {
                    for (const candidate of offerData.candidates) {
                        try {
                            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                        } catch (e) {
                            console.warn('Error adding ICE candidate:', e);
                        }
                    }
                }

                this.status.textContent = 'Status: Creating answer...';
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                this.status.textContent = 'Status: Gathering ICE candidates...';
                // Wait for ICE gathering
                await this.waitForIceGathering();

                this.answerText.value = JSON.stringify({
                    type: 'answer',
                    sdp: answer.sdp,
                    candidates: this.localCandidates,
                    roomId: this.roomId
                }, null, 2);

                this.status.textContent = 'Status: Answer created, copy and send back';
            }
        } catch (error) {
            console.error('Error submitting offer:', error);
            this.status.textContent = 'Status: Error processing offer - ' + error.message;
            alert('Error submitting offer: ' + error.message);
        }
    }

    showCallScreen() {
        this.joinScreen.classList.add('hidden');
        this.callScreen.classList.remove('hidden');
        this.startTimer();
    }

    updateStatus() {
        const state = this.peerConnection.connectionState;
        let statusText = 'Status: ';

        switch (state) {
            case 'new':
                statusText += 'Waiting for connection';
                this.connectionIndicator.textContent = '● Connection not established';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
                break;
            case 'connecting':
                statusText += 'Connecting...';
                this.connectionIndicator.textContent = '● Connecting...';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
                break;
            case 'connected':
                statusText += 'Connected';
                this.connectionIndicator.textContent = '● Connected';
                this.connectionIndicator.className = 'connection-established';
                this.isConnected = true;
                break;
            case 'disconnected':
                statusText += 'Disconnected';
                this.connectionIndicator.textContent = '● Connection lost';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
                break;
            case 'failed':
                statusText += 'Connection failed';
                this.connectionIndicator.textContent = '● Connection failed';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
                break;
            case 'closed':
                statusText += 'Call ended';
                this.connectionIndicator.textContent = '● Call ended';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
                break;
            default:
                statusText += 'Unknown';
                this.connectionIndicator.textContent = '● Unknown status';
                this.connectionIndicator.className = 'connection-not-established';
                this.isConnected = false;
        }

        this.status.textContent = statusText;
    }

    startTimer() {
        this.callStartTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    async toggleMic() {
        if (!this.localStream) {
            // Request audio permission
            try {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                if (!this.localStream) {
                    this.localStream = new MediaStream();
                    this.localVideo.srcObject = this.localStream;
                }
                this.localStream.addTrack(audioStream.getAudioTracks()[0]);
                this.peerConnection.addTrack(audioStream.getAudioTracks()[0], this.localStream);
                this.micBtn.textContent = '🎤';
                this.micBtn.classList.remove('active');
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Microphone access denied or not available. Error: ' + error.message);
                return;
            }
        } else {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.micBtn.classList.toggle('active', !audioTrack.enabled);
                this.micBtn.textContent = audioTrack.enabled ? '🎤' : '🔇';
            }
        }
    }

    async toggleCam() {
        if (!this.localStream || !this.localStream.getVideoTracks().length) {
            // Request video permission
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (!this.localStream) {
                    this.localStream = new MediaStream();
                    this.localVideo.srcObject = this.localStream;
                }
                this.localStream.addTrack(videoStream.getVideoTracks()[0]);
                this.peerConnection.addTrack(videoStream.getVideoTracks()[0], this.localStream);
                this.camBtn.textContent = '📷';
                this.camBtn.classList.remove('active');
            } catch (error) {
                console.error('Error accessing camera:', error);
                alert('Camera access denied or not available. Error: ' + error.message);
                return;
            }
        } else {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.camBtn.classList.toggle('active', !videoTrack.enabled);
                this.camBtn.textContent = videoTrack.enabled ? '📷' : '📷❌';
            }
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.localStream) return;

            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack && videoTrack.getSettings().displaySurface) {
                // Currently screen sharing, switch back to camera
                const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
                const screenTrack = this.localStream.getVideoTracks()[0];
                this.localStream.removeTrack(screenTrack);
                screenTrack.stop();
                this.localStream.addTrack(cameraStream.getVideoTracks()[0]);
                const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(cameraStream.getVideoTracks()[0]);
                }
                this.localVideo.srcObject = this.localStream;
                this.screenShareBtn.classList.remove('active');
            } else {
                // Start screen share
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const cameraTrack = this.localStream.getVideoTracks()[0];
                if (cameraTrack) {
                    this.localStream.removeTrack(cameraTrack);
                    cameraTrack.stop();
                }
                this.localStream.addTrack(screenStream.getVideoTracks()[0]);
                const sender = this.peerConnection.getSenders().find(s => s.track.kind === 'video');
                if (sender) {
                    sender.replaceTrack(screenStream.getVideoTracks()[0]);
                }
                this.localVideo.srcObject = this.localStream;
                this.screenShareBtn.classList.add('active');
            }
        } catch (error) {
            console.error('Error toggling screen share:', error);
            alert('Screen sharing not supported or permission denied');
        }
    }

    endCall() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
        this.status.textContent = 'Status: Call ended';
        this.isConnected = false;

        // Reset to join screen
        setTimeout(() => {
            this.callScreen.classList.add('hidden');
            this.joinScreen.classList.remove('hidden');
            this.roomInfo.classList.add('hidden');
            this.initiatorControls.classList.add('hidden');
            this.joinControls.classList.add('hidden');
            this.localCandidates = [];
            this.dataChannel = null;
        }, 2000);
    }

    toggleChat() {
        const wasHidden = this.chatPanel.classList.contains('hidden');
        this.chatPanel.classList.toggle('hidden');
        
        // If opening chat and data channel is not ready, show warning message
        if (wasHidden && (!this.dataChannel || this.dataChannel.readyState !== 'open')) {
            this.displayMessage('System: Chat not ready yet. Please wait for connection to establish.');
        }
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message) return;

        // Check if data channel is ready
        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.displayMessage('System: Chat not ready yet. Please wait for connection to establish.');
            return;
        }

        this.dataChannel.send(message);
        this.displayMessage(this.userName + ': ' + message);
        this.chatInput.value = '';
    }

    displayMessage(message) {
        const msgDiv = document.createElement('div');
        msgDiv.textContent = message;
        msgDiv.style.marginBottom = '5px';
        msgDiv.style.padding = '5px';
        msgDiv.style.borderRadius = '10px';
        msgDiv.style.maxWidth = '80%';
        msgDiv.style.wordWrap = 'break-word';

        if (this.userName && message.startsWith(this.userName + ':')) {
            msgDiv.style.background = '#25d366';
            msgDiv.style.color = 'white';
            msgDiv.style.alignSelf = 'flex-end';
            msgDiv.style.marginLeft = 'auto';
        } else if (message.startsWith('Remote:')) {
            msgDiv.style.background = 'rgba(255, 255, 255, 0.2)';
            msgDiv.style.color = 'white';
        } else if (message.startsWith('System:')) {
            msgDiv.style.background = 'rgba(255, 255, 0, 0.2)';
            msgDiv.style.color = '#ffff00';
            msgDiv.style.fontStyle = 'italic';
            msgDiv.style.textAlign = 'center';
        }

        this.chatMessages.appendChild(msgDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            alert('Copied to clipboard!');
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoCallApp();
});
