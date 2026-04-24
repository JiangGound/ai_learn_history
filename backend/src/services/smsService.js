const https = require('https');
const crypto = require('crypto');

/**
 * 阿里云短信服务 (SMS)
 * 需要环境变量：
 *   ALIBABA_ACCESS_KEY_ID      (RAM AccessKey ID)
 *   ALIBABA_ACCESS_KEY_SECRET  (RAM AccessKey Secret)
 *   SMS_SIGN_NAME              (短信签名，例如：历史AI)
 *   SMS_TEMPLATE_CODE          (模板Code，例如：SMS_123456789)
 *
 * 模板变量：${code}（填入6位验证码）
 *
 * 若未配置，走开发者模式：直接在 API 响应里返回验证码（方便测试）
 */

const DEV_MODE = !process.env.ALIBABA_ACCESS_KEY_ID;

function formatDate(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/!/g, '%21').replace(/'/g, '%27')
    .replace(/\(/g, '%28').replace(/\)/g, '%29')
    .replace(/\*/g, '%2A');
}

function sign(params, secret) {
  const sorted = Object.keys(params).sort()
    .map(k => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');
  const toSign = 'GET&%2F&' + percentEncode(sorted);
  return crypto.createHmac('sha1', secret + '&').update(toSign).digest('base64');
}

/**
 * @returns {Promise<{ devCode?: string }>}
 *   devCode 只在开发模式下返回，生产环境为 undefined
 */
function sendCode(phone, code) {
  if (DEV_MODE) {
    console.log(`[DEV SMS] ${phone} → 验证码: ${code}`);
    return Promise.resolve({ devCode: code });
  }

  return new Promise((resolve, reject) => {
    const params = {
      AccessKeyId:        process.env.ALIBABA_ACCESS_KEY_ID,
      Action:             'SendSms',
      Format:             'JSON',
      PhoneNumbers:       phone,
      SignName:           process.env.SMS_SIGN_NAME,
      SignatureMethod:    'HMAC-SHA1',
      SignatureNonce:     crypto.randomUUID(),
      SignatureVersion:   '1.0',
      TemplateCode:       process.env.SMS_TEMPLATE_CODE,
      TemplateParam:      JSON.stringify({ code }),
      Timestamp:          formatDate(new Date()),
      Version:            '2017-05-25',
    };
    params.Signature = sign(params, process.env.ALIBABA_ACCESS_KEY_SECRET);

    const qs = Object.keys(params)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
      .join('&');

    https.get(`https://dysmsapi.aliyuncs.com/?${qs}`, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const json = JSON.parse(data);
        if (json.Code === 'OK') resolve({});
        else reject(new Error(json.Message || '短信发送失败'));
      });
    }).on('error', reject);
  });
}

module.exports = { sendCode, DEV_MODE };
