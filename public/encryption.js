self.window = self // For the jsencrypt library to work within the webworker

// Importing the jsencrypt library
self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/jsencrypt/3.2.1/jsencrypt.min.js');

let crypt = null
let privateKey = null

/*listener */
onmessage = function(e) {
  const [ messageType, messageId, text, key ] = e.data
  let result
  switch (messageType) {
    case 'generate-keys':
      result = generateKeypair()
      break
    case 'encrypt':
      result = encrypt(text, key)
      break
    case 'decrypt':
      result = decrypt(text)
      break
  }


  postMessage([ messageId, result ])
}

/*Public key and Private key generating */
function generateKeypair () {
  crypt = new JSEncrypt({default_key_size: 2056})
  privateKey = crypt.getPrivateKey()

  //Hiding PrivateKey
  return crypt.getPublicKey()
}

/*Sending to recipient public key adress */
function encrypt (content, publicKey) {
  crypt.setKey(publicKey)
  return crypt.encrypt(content)
}

// Decrypting the message with  local private_key
function decrypt (content) {
  crypt.setKey(privateKey)
  return crypt.decrypt(content)
}
