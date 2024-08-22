const fs = require("fs");
const path = require("path");
const axios = require("axios");
const colors = require("colors");
const readline = require("readline");
const { DateTime } = require("luxon");

class PokeyQuest {
  constructor() {
    this.headers = this.createHeaders.bind(this);
    this.log = this.log.bind(this);
    this.countdown = this.countdown.bind(this);
    this.extractUserData = this.extractUserData.bind(this);
    this.apiRequest = this.apiRequest.bind(this);
    this.readTokens = this.readTokens.bind(this);
    this.writeTokens = this.writeTokens.bind(this);
    this.askQuestion = this.askQuestion.bind(this);
    this.handleFarming = this.handleFarming.bind(this);
    this.upgradeCards = this.upgradeCards.bind(this);
    this.handleFriendCashback = this.handleFriendCashback.bind(this);
    this.main = this.main.bind(this);
  }

  createHeaders(token = "") {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://dapp.pokequest.io",
      Referer: "https://dapp.pokequest.io/",
      "Sec-Ch-Ua":
        '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "cross-site",
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  }

  log(msg) {
    console.log(`[*] ${msg}`);
  }

  async countdown(seconds) {
    const animation = ["|", "/", "-", "\\"];
    let i = 0;
    for (let second = seconds; second >= 0; second--) {
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(
        `[${animation[i % 4]}] Waiting ${second} seconds to continue...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      i++;
    }
    console.log("");
  }

  extractUserData(queryId) {
    const urlParams = new URLSearchParams(queryId);
    const user = JSON.parse(decodeURIComponent(urlParams.get("user")));
    return {
      auth_date: urlParams.get("auth_date"),
      hash: urlParams.get("hash"),
      query_id: urlParams.get("query_id"),
      user: user,
    };
  }

  async apiRequest(method, url, data = null, token = "") {
    try {
      const config = {
        method,
        url,
        headers: this.headers(token),
        timeout: 5000,
      };
      if (data) {
        config.data = data;
      }
      const response = await axios(config);
      return response.data;
    } catch (error) {
      this.log(`Error: ${error.message}`);
      return null;
    }
  }

  readTokens() {
    const tokenFile = path.join(__dirname, "token.json");
    return fs.existsSync(tokenFile)
      ? JSON.parse(fs.readFileSync(tokenFile, "utf8"))
      : {};
  }

  writeTokens(tokens) {
    const tokenFile = path.join(__dirname, "token.json");
    fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), "utf8");
  }

  askQuestion(query) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) =>
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
      })
    );
  }

  async handleFarming(token) {
    const farmInfo = await this.apiRequest(
      "GET",
      "https://api.pokey.quest/pokedex/farm-info",
      null,
      token
    );
    if (farmInfo && farmInfo.error_code === "OK") {
      const { next_farm_time } = farmInfo.data;
      const currentTime = DateTime.now().toMillis();

      if (currentTime > next_farm_time) {
        this.log(`Farming now...`);
        const farmResponse = await this.apiRequest(
          "POST",
          "https://api.pokey.quest/pokedex/farm",
          {},
          token
        );
        if (farmResponse && farmResponse.error_code === "OK") {
          this.log(
            `Farm successful, GOLD received: ${
              farmResponse.data.gold_reward.toString().white
            }`.green
          );
        } else {
          this.log(
            `Farm unsuccessful: ${
              farmResponse ? farmResponse.error_code : "No response data"
            }`.red
          );
        }
      } else {
        this.log(
          `Next farming time: ${
            DateTime.fromMillis(next_farm_time).toLocaleString(
              DateTime.DATETIME_FULL
            ).yellow
          }`.green
        );
      }
    } else {
      this.log(
        `Failed to get farm info: ${
          farmInfo ? farmInfo.error_code : "No response data"
        }`.red
      );
    }
  }

  async upgradeCards(token, balance, friend) {
    const cardListResponse = await this.apiRequest(
      "GET",
      "https://api.pokey.quest/pokedex/list",
      null,
      token
    );

    if (cardListResponse && cardListResponse.error_code === "OK") {
      const cards = cardListResponse.data.data;
      for (let card of cards) {
        if (
          card.amount >= card.amount_card &&
          balance >= card.amount_gold &&
          friend >= card.amount_friend
        ) {
          this.log(
            `Upgrading card ${card.name} with rare ${card.rare}...`.yellow
          );
          const upgradeResponse = await this.apiRequest(
            "POST",
            "https://api.pokey.quest/pokedex/upgrade",
            { card_id: card.id },
            token
          );

          if (upgradeResponse && upgradeResponse.error_code === "OK") {
            this.log(
              `Successfully upgraded card ${card.name} to level ${upgradeResponse.data.level}`
                .green
            );
            balance -= card.amount_gold;
            friend -= card.amount_friend;
          } else {
            this.log(
              `Failed to upgrade card ${card.name}: ${
                upgradeResponse
                  ? upgradeResponse.error_code
                  : "No response data"
              }`.red
            );
          }
        }
      }
    } else {
      this.log(
        `Unable to get card list: ${
          cardListResponse ? cardListResponse.error_code : "No response data"
        }`.red
      );
    }
  }

  async handleFriendCashback(token) {
    const referralList = await this.apiRequest(
      "GET",
      "https://api.pokey.quest/referral/list",
      null,
      token
    );

    if (
      referralList &&
      referralList.error_code === "OK" &&
      Array.isArray(referralList.data.data)
    ) {
      for (let referral of referralList.data.data) {
        if (referral.friend_cashback >= 1) {
          const claimResponse = await this.apiRequest(
            "POST",
            "https://api.pokey.quest/referral/claim-friend",
            { friend_id: referral.id },
            token
          );

          if (claimResponse && claimResponse.error_code === "OK") {
            this.log(
              `Claimed $FRIEND for referral: ${referral.username}`.green
            );
          } else {
            this.log(
              `Failed to claim $FRIEND: ${referral.username}, ${
                claimResponse ? claimResponse.error_code : "No response data"
              }`.red
            );
          }
        }
      }
    } else {
      this.log(
        `Unable to get friend list: ${
          referralList ? referralList.error_code : "No response data"
        }`.red
      );
    }
  }

  async main() {
    const dataFile = path.join(__dirname, "data.txt");
    const userData = fs
      .readFileSync(dataFile, "utf8")
      .replace(/\r/g, "")
      .split("\n")
      .filter(Boolean);

    const upgradeLevel = await this.askQuestion(
      "Do you want to upgrade levels? (y/n): "
    );
    const shouldUpgradeLevel = upgradeLevel.toLowerCase() === "y";
    const tokens = this.readTokens();

    while (true) {
      for (let i = 0; i < userData.length; i++) {
        const queryId = userData[i];
        const data = this.extractUserData(queryId);
        let token = tokens[i + 1];

        if (!token) {
          const apiResponse = await this.apiRequest(
            "POST",
            "https://api.pokey.quest/auth/login",
            data
          );
          if (apiResponse && apiResponse.error_code === "OK") {
            token = apiResponse.data.token;
            tokens[i + 1] = token;
            this.writeTokens(tokens);
          } else {
            this.log(
              `Login unsuccessful: ${
                apiResponse ? apiResponse.error_code : "No response data"
              }`
            );
            continue;
          }
        }

        const userDetail = data.user;
        console.log(
          `\n========== Account ${i + 1} | ${userDetail.first_name} ==========`
            .blue
        );
        let syncResponse = await this.apiRequest(
          "POST",
          "https://api.pokey.quest/tap/sync",
          {},
          token
        );

        if (syncResponse && syncResponse.error_code === "OK") {
          let syncData = syncResponse.data;
          this.log(
            `Remaining energy: ${syncData.available_taps.toString().white}`
              .green
          );
          this.log(
            `Balance: ${Math.floor(
              syncData.balance_coins.find(
                (coin) => coin.currency_symbol === "GOL"
              ).balance
            )}`.cyan
          );
          this.log(
            `FRIEND Balance: ${Math.floor(
              syncData.balance_coins.find(
                (coin) => coin.currency_symbol === "FRI"
              ).balance
            )}`.cyan
          );
          await this.handleFarming(token);
          const balance = Math.floor(
            syncData.balance_coins.find(
              (coin) => coin.currency_symbol === "GOL"
            ).balance
          );
          const friend = Math.floor(
            syncData.balance_coins.find(
              (coin) => coin.currency_symbol === "FRI"
            ).balance
          );
          await this.handleFriendCashback(token);
          await this.upgradeCards(token, balance, friend);
          while (syncData.available_taps > 0) {
            if (syncData.available_taps < 50) {
              this.log(
                `Low energy (${syncData.available_taps}), switching to next account...`
                  .red
              );
              break;
            }

            this.log(`Starting tap...`.white);
            const count = Math.min(
              Math.floor(Math.random() * (50 - 30 + 1)) + 30,
              syncData.available_taps
            );
            const tapResponse = await this.apiRequest(
              "POST",
              "https://api.pokey.quest/tap/tap",
              { count },
              token
            );

            if (tapResponse && tapResponse.error_code === "OK") {
              syncData = tapResponse.data;
              this.log(
                `Energy after tap: ${syncData.available_taps.toString().white}`
                  .green
              );
              this.log(
                `Balance after tap: ${Math.floor(
                  syncData.balance_coins.find(
                    (coin) => coin.currency_symbol === "GOL"
                  ).balance
                )}`.cyan
              );

              if (syncData.dropped_cards.length > 0) {
                this.log(`Dropped Cards:`);
                syncData.dropped_cards.forEach((card) => {
                  console.log(
                    `    - Name: ${card.name.yellow}, Rare: ${card.rare}, Level: ${card.level}`
                  );
                });
              } else {
                this.log(`No dropped cards.`);
              }
            } else {
              this.log(
                `Tap unsuccessful: ${
                  tapResponse ? tapResponse.error_code : "No response data"
                }`
              );
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          if (shouldUpgradeLevel) {
            await this.checkAndUpgrade(
              token,
              Math.floor(
                syncData.balance_coins.find(
                  (coin) => coin.currency_symbol === "GOL"
                ).balance
              )
            );
          }
        } else {
          this.log(
            `Failed to get user data: ${
              syncResponse ? syncResponse.error_code : "No response data"
            }`
          );
        }
      }
      await this.countdown(60);
    }
  }

  async checkAndUpgrade(token, balance) {
    let nextLevelData = await this.apiRequest(
      "GET",
      "https://api.pokey.quest/poke/get-next-level",
      null,
      token
    );

    while (
      nextLevelData &&
      nextLevelData.error_code === "OK" &&
      balance > nextLevelData.data.upgrade_cost
    ) {
      this.log(`Upgraded to ${nextLevelData.data.name}...`.green);

      let upgradeResponse = await this.apiRequest(
        "POST",
        "https://api.pokey.quest/poke/upgrade",
        {},
        token
      );
      if (upgradeResponse && upgradeResponse.error_code === "OK") {
        balance -= nextLevelData.data.upgrade_cost;
        nextLevelData = upgradeResponse;
      } else {
        this.log(
          `Upgrade failed: ${
            upgradeResponse ? upgradeResponse.error_code : "No response data"
          }`
        );
        break;
      }
    }
  }
}

if (require.main === module) {
  const pq = new PokeyQuest();
  pq.main().catch((err) => {
    console.error(err.toString().red);
    process.exit(1);
  });
}
