require('dotenv').config();

const ethers = require('ethers');
const bip39 = require('bip39');

const provider = new ethers.WebSocketProvider('wss://rpc-pulsechain.g4mm4.io');

const partialMnemonic = process.env.MNEMONIC

async function recover() {
    const possibleAddresses = [];
    const possibleWords = [];

    for (const word of bip39.wordlists.english) {
        const fullMnemonic = partialMnemonic.replace('*', word);

        try {
            possibleAddresses.push(ethers.HDNodeWallet.fromPhrase(fullMnemonic).address);
            possibleWords.push(word);
        } catch {
            continue;
        }
    }

    const balances = [];

    for (const address of possibleAddresses) {
        const balance = await provider.getBalance(address);

        balances.push(balance);
    }

    const loadedWalletIndex = balances.findIndex(balance => balance > 0n);

    if (loadedWalletIndex) {
        const recoveredWallet = possibleAddresses[loadedWalletIndex];
        const missingWord = possibleWords[loadedWalletIndex];
        
        console.log('Missing word:', missingWord, '\nYields:', recoveredWallet);
    
        return [missingWord, recoveredWallet];
    } else {
        console.log('Could not find a wallet with a balance greater than 0');
    }
}

recover();