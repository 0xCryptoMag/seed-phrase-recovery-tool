# Introduction
A quick tool to recover a seed phrase if you are only missing one word. The tool requires the user to download node.js which is a JavaScript execution environment (similar to a web browser but usually for server side code). If you are using Windows you can download node.js here: [https://nodejs.org/en/download/package-manager]. Choose the Prebuilt Installer tab for an easier installation.

If you are using Linux, you can just install node version manager using this command in your terminal: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash`. Then close and reopen your terminal, then use this command `nvm install --lts` for the latest long term support version.

Once installed on your computer download this repository by using `git clone https://github.com/0xCryptoMag/seed-phrase-recovery-tool`, or if you don't have git installed on your computer, on the Github page of this repository hit the green Code button, then hit the Download ZIP button at the bottom. Unzip the folder if needed.

In your terminal use `cd path/to/folder` where path to folder is the path to the folder. Alternatively you can open up the file on file explorer then select Open in Terminal. Once the terminal is in the directory of the project folder use the command `npm install` to install all dependencies.

The dependencies this project uses are ethersjs (v6), bip39, and dotenv. A list of all dependencies that will get installed from `npm install` will be listed in the `package.json` file. All these dependencies are standard and widely used, but feel free to go to [npmjs.com] (the site node package manager (npm) pull it's packages from) to look at them yourselves.

The tool is run by putting `node index.js`. This will run the code that is in that Javascript file.


# Using the tool
The tool is very simple to use. First take the `.env.example` and change the name to `.env`, then put the seed phrase inside the quotation markes of the first line. The missing word can be anywhere on the seed phrase, but you must put an `*` where the missing word is, and make sure to SAVE your changes. Once done go back to your terminal and run `node index.js`.

It could take a while for it to finish. The script will go through all 2048 words on the BIP39 wordlist and replace the `*` with that word. It will attempt to create an HD wallet, and if the words pass checksum it will hash out the master seed. We take the address from that seed and push it to an array along with the word used to create it. We then attempt see if that address has a pls balance greater than 0. If an address is found with a balance, we return the wallet address and the word used to create it. If not, we give a failure message.


# Donations
Use this tool freely as you please, but if you want to donate you can send a little change to

sparechange.pls
or
0xe9eeAA8202AD0010eB7b72c5a454A14FE32fA290