const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const tough = require('tough-cookie');
const cheerio = require('cheerio');

const cookieJar = new tough.CookieJar();
const instance = wrapper(axios.create({
  withCredentials: true,
  jar: cookieJar,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  },
}));

module.exports = async (req, res) => {
  try {
    const initialUrl = 'https://sso.buaa.edu.cn/login?service=https%3A%2F%2Fapp.buaa.edu.cn%2Fa_buaa%2Fapi%2Fcas%2Findex%3Fredirect%3Dhttps%253A%252F%252Fapp.buaa.edu.cn%252Fsite%252Fcenter%252Fpersonal%26from%3Dwap%26login_from%3D&noAutoRedirect=1';
    let response = await instance.get(initialUrl);

    let loginUrl = response.request.res.responseUrl || response.config.url;

    response = await instance.get(loginUrl);
    let $ = cheerio.load(response.data);

    const lt = $('input[name="lt"]').val();
    const execution = $('input[name="execution"]').val();

    const payload = new URLSearchParams();
    payload.append('username', req.body.username); // 从请求中获取用户名
    payload.append('password', req.body.password); // 从请求中获取密码
    payload.append('lt', lt);
    payload.append('execution', execution);
    payload.append('_eventId', 'submit');

    response = await instance.post(loginUrl, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 303,
    });

    if (response.status === 302 || response.status === 301) {
      let redirectUrl = response.headers.location;
      while (response.status === 302 || response.status === 301) {
        response = await instance.get(redirectUrl, {
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 303,
        });
        redirectUrl = response.headers.location || response.request.res.responseUrl;
      }

      const userInfoUrl = 'https://app.buaa.edu.cn/uc/wap/user/get-info';
      response = await instance.get(userInfoUrl, {
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://app.buaa.edu.cn/site/center/personal',
        },
      });

      res.status(200).json(response.data);
    } else {
      res.status(400).json({ error: '登录失败' });
    }
  } catch (error) {
    res.status(500).json({ error: '服务器错误', details: error.toString() });
  }
};
