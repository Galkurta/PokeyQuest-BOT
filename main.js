const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');

class PokeyQuest {
    headers(token = '') {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://dapp.pokequest.io',
            'Priority': 'u=1, i',
            'Referer': 'https://dapp.pokequest.io/',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    log(msg, color = 'white') {
        console.log(`[*] ${msg}`[color]);
    }

    async countdown(minutes) {
        for (let i = minutes; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Wait ${i} minute(s) to continue ...`.yellow);
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
        console.log('');
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    async postToPokeyQuestAPI(data) {
        const url = 'https://api.pokey.quest/auth/login';
        const payload = {
            auth_date: data.auth_date,
            hash: data.hash,
            query_id: data.query_id,
            user: data.user
        };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }

    async postTapSync(token) {
        const url = 'https://api.pokey.quest/tap/sync';

        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }

    async postTapTap(token, count) {
        const url = 'https://api.pokey.quest/tap/tap';
        const payload = { count };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }

    readTokens() {
        const tokenFile = path.join(__dirname, 'token.json');
        if (fs.existsSync(tokenFile)) {
            return JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        }
        return {};
    }

    writeTokens(tokens) {
        const tokenFile = path.join(__dirname, 'token.json');
        fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), 'utf8');
    }

    async getNextLevel(token) {
        const url = 'https://api.pokey.quest/poke/get-next-level';
    
        try {
            const response = await axios.get(url, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }
    
    async upgradeLevel(token) {
        const url = 'https://api.pokey.quest/poke/upgrade';
    
        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }
    
    async checkAndUpgrade(token, balance) {
        let nextLevelData = await this.getNextLevel(token);
    
        while (nextLevelData && nextLevelData.error_code === 'OK' && balance > nextLevelData.data.upgrade_cost) {
            this.log(`Rising up ${nextLevelData.data.name}...`, 'green');
            
            let upgradeResponse = await this.upgradeLevel(token);
            if (upgradeResponse && upgradeResponse.error_code === 'OK') {
                balance -= nextLevelData.data.upgrade_cost;
                nextLevelData = upgradeResponse;
            } else {
                this.log(`Upgrade failure: ${upgradeResponse ? upgradeResponse.error_code : 'No response data'}`, 'red');
                break;
            }
        }
    }

    async getFarmInfo(token) {
        const url = 'https://api.pokey.quest/pokedex/farm-info';
    
        try {
            const response = await axios.get(url, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }
    
    async postFarm(token) {
        const url = 'https://api.pokey.quest/pokedex/farm';
    
        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`, 'red');
            return null;
        }
    }
    
    async handleFarming(token) {
        const farmInfo = await this.getFarmInfo(token);
        if (farmInfo && farmInfo.error_code === 'OK') {
            const { next_farm_time } = farmInfo.data;
            const currentTime = DateTime.now().toMillis();
    
            if (currentTime > next_farm_time) {
                this.log(`Farming now...`, 'yellow');
                const farmResponse = await this.postFarm(token);
                if (farmResponse && farmResponse.error_code === 'OK') {
                    this.log(`Farm successful, Gold received: ${farmResponse.data.gold_reward.toString().white}`.green);
                } else {
                    this.log(`Farm failed: ${farmResponse ? farmResponse.error_code : 'No response data'}`, 'red');
                }
            } else {
                this.log(`Next farm time: ${DateTime.fromMillis(next_farm_time).toLocaleString(DateTime.DATETIME_FULL)}`, 'yellow');
            }
        } else {
            this.log(`Failed to get farm info: ${farmInfo ? farmInfo.error_code : 'No response data'}`, 'red');
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const nangcap = await this.askQuestion('Do you want to upgrade LV? (Y/N): ');
        const hoinangcap = nangcap.toLowerCase() === 'y';
        const tokens = this.readTokens();

        while (true) {
            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                let token = tokens[i + 1];

                if (!token) {
                    const apiResponse = await this.postToPokeyQuestAPI(data);
                    if (apiResponse && apiResponse.error_code === 'OK') {
                        token = apiResponse.data.token;
                        tokens[i + 1] = token;
                        this.writeTokens(tokens);
                    } else {
                        this.log(`Login failed: ${apiResponse ? apiResponse.error_code : 'No response data'}`, 'red');
                        continue;
                    }
                }

                const userDetail = data.user;
                console.log(`\n========== Account ${i + 1} | ${userDetail.first_name} ==========`.blue);
                let syncResponse = await this.postTapSync(token);

                if (syncResponse && syncResponse.error_code === 'OK') {
                    let syncData = syncResponse.data;
                    this.log(`Energy left: ${syncData.available_taps.toString().white}`.green);
                    this.log(`Balance: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);

                    await this.handleFarming(token);

                    while (syncData.available_taps > 0) {
                        if (syncData.available_taps < 50) {
                            this.log(`Low energy (${syncData.available_taps}), switching account...`.red);
                            break;
                        }
                        
                        this.log(`Starting tap...`.white);
                        const count = Math.min(Math.floor(Math.random() * (50 - 30 + 1)) + 30, syncData.available_taps);
                        const tapResponse = await this.postTapTap(token, count);
                    
                        if (tapResponse && tapResponse.error_code === 'OK') {
                            syncData = tapResponse.data;
                            this.log(`Energy after tap: ${syncData.available_taps.toString().white}`.green);
                            this.log(`Balance after tap: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);
                    
                            if (syncData.dropped_cards.length > 0) {
                                this.log(`Dropped Cards:`);
                                syncData.dropped_cards.forEach(card => {
                                    console.log(`    - Name: ${card.name.yellow}, Rare: ${card.rare}, Level: ${card.level}`);
                                });
                            } else {
                                this.log(`No dropped cards.`, 'yellow');
                            }
                        } else {
                            this.log(`Tap failed: ${tapResponse ? tapResponse.error_code : 'No response data'}`, 'red');
                            break;
                        }
                    }

                    if (hoinangcap) {
                        await this.checkAndUpgrade(token, Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance));
                    }
                } else {
                    this.log(`Failed to get data: ${syncResponse ? syncResponse.error_code : 'No response data'}`, 'red');
                }

            }
            await this.countdown(5);  // 5 minutes
        }
    }
}

if (require.main === module) {
    const pq = new PokeyQuest();
    pq.main().catch(err => {
        console.error(err.toString().red);
        process.exit(1);
    });
}