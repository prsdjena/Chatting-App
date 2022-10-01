
const vm = new Vue ({
  el: '#vue-instance',
  data () {
    return {
      cryptWorker: null,
      socket: null,
      originPublicKey: null,
      destinationPublicKey: null,
      messages: [],
      notifications: [],
      currentRoom: null,
      pendingRoom: Math.floor(Math.random() * 1000),
      draft: ''
    }
  },
  async created () {
    this.addNotification('Welcome! Establishing new Connection.')

    // Initializing crypto-webworker thread
    this.cryptWorker = new Worker('encryption.js')

    // Creating Key-pair 
    this.originPublicKey = await this.getWebWorkerResponse('generate-keys')
    this.addNotification(`Keypair Generated - ${this.getKeySnippet(this.originPublicKey)}`)

    // Initializing socketio
    this.socket = io()
    this.setupSocketListeners()
  },
  methods: {
    setupSocketListeners () {
     
      this.socket.on('connect', () => {
        this.addNotification('Connected To Server.')
        this.joinRoom()
      })

      // when Connection Lost
      this.socket.on('disconnect', () => this.addNotification('Lost Connection'))

      //Showing the message
      this.socket.on('MESSAGE', async (message) => {
        //  decrypting messages that were encrypted with the user's public key
        if (message.recipient === this.originPublicKey) {
          
          // Decrypting the message text in the webworker thread
          message.text = await this.getWebWorkerResponse('decrypt', message.text)
          this.messages.push(message)
        }
      })

      // Sending Public Key to to new User
      this.socket.on('NEW_CONNECTION', () => {
        this.addNotification('Another user joined the room.')
        this.sendPublicKey()
      })

//showing notification
      this.socket.on('ROOM_JOINED', (newRoom) => {
        this.currentRoom = newRoom
        this.addNotification(`Joined Room - ${this.currentRoom}`)
        this.sendPublicKey()
      })

      // Saving another user Public Key
      this.socket.on('PUBLIC_KEY', (key) => {
        this.addNotification(`Public Key Received - ${this.getKeySnippet(key)}`)
        this.destinationPublicKey = key
      })

      //if user got disconnected
      this.socket.on('USER_DISCONNECTED', () => {
        this.addNotification(`User Disconnected - ${this.getKeySnippet(this.destinationPublicKey)}`)
        this.destinationPublicKey = null
      })

      //Room is Full
      this.socket.on('ROOM_FULL', () => {
        this.addNotification(`Cannot join ${this.pendingRoom}, room is full`)

        //Redirecting to another Random room
        this.pendingRoom = Math.floor(Math.random() * 1000)
        this.joinRoom()
      })

     
      this.socket.on('INTRUSION_ATTEMPT', () => {
        this.addNotification('Alert!!! Possible Security Breach.')
      })
    },

  
    async sendMessage () {
     
      if (!this.draft || this.draft === '') { return }

      //  immutable.js for  avoiding  irregularities.
      let message = Immutable.Map({
        text: this.draft,
        recipient: this.destinationPublicKey,
        sender: this.originPublicKey
      })

     
      this.draft = ''

      // Instantly add (unencrypted) message to local UI
      this.addMessage(message.toObject())

      if (this.destinationPublicKey) {
        // Encrypt message with the public key of the other user
        const encryptedText = await this.getWebWorkerResponse(
          'encrypt', [ message.get('text'), this.destinationPublicKey ])
        const encryptedMsg = message.set('text', encryptedText)

        // Emit the encrypted message
        this.socket.emit('MESSAGE', encryptedMsg.toObject())
      }
    },

    //Joining ChatRoom
    joinRoom () {
      if (this.pendingRoom !== this.currentRoom && this.originPublicKey) {
        this.addNotification(`Connecting to Room - ${this.pendingRoom}`)

     
        this.messages = []
        this.destinationPublicKey = null

    
        this.socket.emit('JOIN', this.pendingRoom)
      }
    },

    
    addMessage (message) {
      this.messages.push(message)
      this.autoscroll(this.$refs.chatContainer)
    },

    //Showing Notification
    addNotification (message) {
      const timestamp = new Date().toLocaleTimeString()
      this.notifications.push({ message, timestamp })
      this.autoscroll(this.$refs.notificationContainer)
    },

   
    getWebWorkerResponse (messageType, messagePayload) {
      return new Promise((resolve, reject) => {
        // Generate a random message id to identify the corresponding event callback
        const messageId = Math.floor(Math.random() * 100000)

        // Post the message to the webworker
        this.cryptWorker.postMessage([messageType, messageId].concat(messagePayload))

        // Create a handler for the webworker message event
        const handler = function (e) {
          // Only handle messages with the matching message id
          if (e.data[0] === messageId) {
            // Remove the event listener once the listener has been called.
            e.currentTarget.removeEventListener(e.type, handler)

            // Resolve the promise with the message payload.
            resolve(e.data[1])
          }
        }

        // Assign the handler to the webworker 'message' event.
        this.cryptWorker.addEventListener('message', handler)
      })
    },

    
    sendPublicKey () {
      if (this.originPublicKey) {
        this.socket.emit('PUBLIC_KEY', this.originPublicKey)
      }
    },

   
    getKeySnippet (key) {
      return key.slice(100, 118)
    },

    autoscroll (element) {
      if (element) { element.scrollTop = element.scrollHeight }
    }
  }
})



