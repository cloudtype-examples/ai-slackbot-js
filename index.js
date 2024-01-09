const { App, LogLevel, HTTPReceiver } = require('@slack/bolt');

const env = process.env || {};
const BOT_TOKEN = env.BOT_TOKEN;
const SIGNING_SECRET = env.SIGNING_SECRET;
const APP_TOKEN = env.APP_TOKEN;
const FLOWISE_API_ENDPOINT = env.FLOWISE_API_ENDPOINT;
const FLOWISE_API_KEY = env.FLOWISE_API_KEY;
const SLASH_COMMAND = env.SLASH_COMMAND;
const BOT_TITLE = env.BOT_TITLE || '';

const sleep = (ms) => {
  return new Promise((r) => setTimeout(r, ms));
};

(async () => {
  if (!BOT_TOKEN) {
    console.log(`Environment variable 'BOT_TOKEN' is required. Service will be stopped automatically in 60s`);
    await sleep(60 * 1000);
  }

  if (!SIGNING_SECRET) {
    console.log(`Environment variable 'SIGNING_SECRET' is required. Service will be stopped automatically in 60s`);
    await sleep(60 * 1000);
  }

  if (!APP_TOKEN) {
    console.log(`Environment variable 'APP_TOKEN' is required. Service will be stopped automatically in 60s`);
    await sleep(60 * 1000);
  }

  if (!FLOWISE_API_ENDPOINT) {
    console.log(`Environment variable 'FLOWISE_API_ENDPOINT' is required. Service will be stopped automatically in 60s`);
    await sleep(60 * 1000);
  }

  if (!SLASH_COMMAND) {
    console.log(`Environment variable 'SLASH_COMMAND' is required. Service will be stopped automatically in 60s`);
    await sleep(60 * 1000);
  }

  const app = new App({
    token: BOT_TOKEN,
    signingSecret: SIGNING_SECRET,
    appToken: APP_TOKEN,
    logLevel: LogLevel.DEBUG,
    port: 3000,
    receiver: new HTTPReceiver({
      signingSecret: SIGNING_SECRET,
      unhandledRequestHandler: async ({ logger, response }) => {
        logger.info('Acknowledging this incoming request because 20 seconds already passed...');
        response.writeHead(200);
        response.end();
      },
      unhandledRequestTimeoutMillis: 20000
    })
  });

  app.command(`/${SLASH_COMMAND}`, async ({ command, ack, say }) => {
    await ack();

    const user = command.user_name;
    const userQuestion = command.text;

    const data = {
      question: userQuestion
    };

    try {
      const apiResponse = await query(data);

      if (!apiResponse) {
        return await say(`오류: API 응답 결과가 없습니다.`);
      } else if (typeof apiResponse === 'string') {
        return await say(`오류: ${apiResponse}`);
      } else if (typeof apiResponse === 'object') {
        await say({
          response_type: 'in_channel',
          blocks: [
            {
              type: 'divider'
            },
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: BOT_TITLE
              }
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'plain_text',
                  text: `@${user}`
                }
              ]
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔷 *질문*\n${userQuestion}`
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔶 *답변*\n${apiResponse ? apiResponse.text : `답변을 가져올 수 없습니다.`}`
              }
            },
            {
              type: 'divider'
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: '상세한 내용은 안내책자 참고'
              },
              accessory: {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: '연말정산 안내 PDF 다운로드',
                  emoji: true
                },
                value: 'click_me_123',
                url: 'https://www.nts.go.kr/comm/nttFileDownload.do?fileKey=143949cdeade82ab901580cd2f2a68ae',
                action_id: 'button-action'
              }
            }
          ]
        });
      } else {
        return await say(`오류: 알 수 없는 API 응답 결과(${typeof apiResponse})`);
      }
    } catch (error) {
      console.error(`Error fetching data from API: ${error.message}`, error);
      await say(`오류: ${error.message}`);
    }
  });

  async function query(data) {
    const apiEndpoint = FLOWISE_API_ENDPOINT;
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: Object.assign(
        {
          'Content-Type': 'application/json'
        },
        FLOWISE_API_KEY ? { Authorization: `Bearer ${FLOWISE_API_KEY}` } : {}
      ),
      body: JSON.stringify(data)
    });

    const result = await (async () => {
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        return text;
      }
    })();

    if (~[200, 204].indexOf(response.status)) {
      return result;
    } else if (~[502, 503].indexOf(response.status)) {
      throw new Error(`flowise service is stopped(${response.status})${result ? ': ' + result.message || JSON.stringify(result) : ''}`);
    } else if (~[404].indexOf(response.status)) {
      throw new Error(`not found(${response.status}) api endpoint "${apiEndpoint}"${result ? ': ' + result.message || JSON.stringify(result) : ''}`);
    } else {
      throw new Error(`fetch error(${response.status})${result ? ': ' + result.message || JSON.stringify(result) : ''}`);
    }
  }

  try {
    await app.start();
    console.log('⚡️ Bolt app is running!');
  } catch (error) {
    console.log(`Error occurred: ${error.message}`);
    console.error(error);
    await sleep(60 * 1000);
  }
})();