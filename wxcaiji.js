function HttpPost(data,path,callback) {//发送data到path
    var http = require('http');
    callback = callback || null;
    content = require('querystring').stringify(data);
    var options = {
        method: "POST",
        host: "www.example.com",//注意没有http://，这是服务器的域名。
        port: 80,
        path: path,//接收程序的路径和文件名
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            "Content-Length": content.length
        }
    };
    var req = http.request(options, function (res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('BODY: ' + chunk);
            body += chunk;
        });
        res.on('end', function () {
            if (callback) {
                callback(body);
            }
        });
    });
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message);
    });
    req.write(content);
    req.end();
}

module.exports = {
    *beforeSendResponse(requestDetail, responseDetail)
    {
        if (/mp\/profile_ext\?action=home/i.test(requestDetail.url))    //公众号历史消息页面
        {
            try
            {
                var responseStr = responseDetail.response.body.toString();
                var reg = /var msgList = \'(.*?)\';/;//历史消息
                var ret = reg.exec(responseStr);
                var msgList = ret[1];

                reg = /var username = \"\" \|\| \"(.*?)\";/;
                ret = reg.exec(responseStr);
                var username = ret[1];

                reg = /var headimg = \"(.*?)\"/;
                ret = reg.exec(responseStr);
                var headimg = ret[1];

                reg = /var nickname = \"(.*?)\" \|\| \"\";/;
                ret = reg.exec(responseStr);
                var nickname = ret[1];

                reg = /appid: \"(.*?)\",/;
                ret = reg.exec(responseStr);
                var appid = ret[1];

                HttpPost({msg_list:msgList, user_name:username, head_img:headimg, nick_name:nickname, appid:appid, url:requestDetail.url},"/api/wxcaiji/saveMsgList");//将匹配到的历史消息json发送到服务器

            }
            catch(e)
            {
                console.log(e);
            }
        }
        else if(/mp\/profile_ext\?action=getmsg/i.test(requestDetail.url))  //历史消息页向下翻页后的json接口
        {

            try
            {
                var json = JSON.parse(responseDetail.response.body.toString());
                if (json.general_msg_list != [])
                {
                    HttpPost({msg_list:json.general_msg_list, is_json:1, url:requestDetail.url},"/api/wxcaiji/saveMsgList");//将历史消息的json发送到服务器
                }
            }
            catch(e)
            {
                console.log(e);
            }
        }
        else if(/mp\/getappmsgext/i.test(requestDetail.url))    //公众号文章阅读量和点赞量接口
        {
            try
            {
                var requestStr = requestDetail.requestData.toString();

                reg = /(^|&)mid=([^&]*)($|&)/;
                ret = reg.exec(requestStr);
                var mid = ret[2];

                reg = /(^|&)idx=([^&]*)($|&)/;
                ret = reg.exec(requestStr);
                var idx = ret[2];

                HttpPost({mid:mid, idx:idx, msg_ext:responseDetail.response.body.toString()},"/api/wxcaiji/saveMsgExt");//将文章阅读量点赞量的json发送到服务器
            }
            catch(e)
            {
                console.log(e);
            }
        }
        else if(/\/s\?__biz/i.test(requestDetail.url) || /mp\/rumor/i.test(requestDetail.url) || /appmsg\/show\?__biz/i.test(requestDetail.url))  //公众号文章接口（rumor这个地址是公众号文章被辟谣了）
        {
            try
            {
                var responseStr = responseDetail.response.body.toString();
                var cheerio = require('cheerio');
                var $ = cheerio.load(responseStr);
                var content = $('#js_content').html();
                var originalUrl = $('#js_share_source').attr('href');
                var hasVideo = $('iframe.video_iframe').length > 0 ? 1 : 0;
                var hasAudio = ($('qqmusic.qqmusic_iframe').length > 0 || $('mpvoice.audio_iframe').length > 0) ? 1 : 0;

                var reg = /var _copyright_stat = \"(.*?)\";/;
                var ret = reg.exec(responseStr);
                var copyrightStat = ret[1];

                //var fs = require('fs');
                //fs.writeFile('/tmp/weixin_content', content, function(err) {});

                return new Promise((resolve, reject) => {
                    var newResponse = responseDetail.response;
                    HttpPost({content:content, url:requestDetail.url, copyright_stat:copyrightStat, original_url:originalUrl, has_video:hasVideo, has_audio:hasAudio},"/api/wxcaiji/saveMsgContent", function (body) {
                        if (body)
                        {
                            var reg = /<script nonce="(.*)"/;
                            var ret = reg.exec(responseStr);
                            var nonce = ret[1];
                            newResponse.body += '<script nonce="'+nonce+'" type="text/javascript">'+body+'</script>';
                            resolve({response: newResponse});
                        }
                        else
                        {
                            resolve(null);
                        }
                    });//将文章内容发送到服务器，并获得下一步跳转链接添加到文章结尾
                });
            }
            catch(e)
            {
                console.log(e);
            }
        } 
    }
};
