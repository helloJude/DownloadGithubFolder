var superagent = require('superagent');
var cheerio = require('cheerio');
var fs = require('fs');
var async = require('async')
var urlUtil = require("url");
var queryString = require("querystring");

function convert(urlString) {
    var result = urlUtil.parse(urlString);
    result.host = "api.github.com"

    var pathArray = result.pathname.split('/')
    pathArray.shift()

    if(pathArray.length === 2){
        pathArray.unshift("repos")
        pathArray.push("contents")
        result.pathname = pathArray.join('/')
        return result
    }
    pathArray.unshift("repos")
    pathArray[3] = "contents"
    var branch = pathArray.splice(4, 1)
    result.pathname = pathArray.join('/')
    pathArray.unshift('/')

    result.search = "?ref=" + branch
    return urlUtil.format(result)
}
function getRepositoryName(urlString) {
    var result = urlUtil.parse(urlString);
    var pathArray = result.pathname.split('/')
    pathArray.shift()
    return pathArray[1]
}

var root = process.argv[2]
var project = getRepositoryName(root)
superagent.get(convert(process.argv[2])).end(function (err, res) {
    if (err) {
        console.log(err);
        return;
    }
    var jsonArray = res.body
    mkdirSync(project)
    async.mapLimit(jsonArray, 1, function (item, callback) {
        setTimeout(function () {
            if (item.type == "file") {
                writeFile(item)
            } else if (item.type == "dir") {
                writeFolder(item)
            }
            callback(null, item.name + ' json name');
        }, 2000);
    }, function (err, results) {
        if (err) {
            console.log(err);
            return;
        }
    })
})

function writeFolder(json) {
    mkdirSync(project + "/" + cutOutPath(root,json.path))
    superagent.get(json.url).end(function (err, res) {
        if (err) {
            console.log(err);
            return;
        }
        var jsonArray = res.body
        async.mapLimit(jsonArray, 1, function (item, callback) {
            setTimeout(function () {
                if (item.type == "file") {
                    writeFile(item)
                } else if (item.type == "dir") {
                    writeFolder(item)
                }
                callback(null, item.name + ' json name');
            }, 2000);
        }, function (err, results) {
            if (err) {
                console.log(err);
                return;
            }
        })
    })
}

/**
 * 支持多'/'创建文件夹
 * @param {*} url 
 * @param {*} mode 
 * @param {*} cb 
 */
function mkdirSync(url, mode, cb) {
    var arr = url.split("/");
    mode = mode || 0755;
    cb = cb || function () { };
    if (arr[0] === ".") {//处理 ./aaa
        arr.shift();
    }
    if (arr[0] == "..") {//处理 ../ddd/d
        arr.splice(0, 2, arr[0] + "/" + arr[1])
    }
    function inner(cur) {
        console.log("path=" + cur)
        if (!fs.existsSync(cur)) {//不存在就创建一个
            fs.mkdirSync(cur, mode)
        }
        if (arr.length) {
            console.log("length="+arr.length)
            inner(cur + "/" + arr.shift());
        } else {
            cb();
        }
    }
    arr.length && inner(arr.shift());
}


function writeFile(node) {
    superagent.get(node.download_url).end(function (err, res) {
        if (err) {
            console.log(err);
            return;
        }
        //判断path是否深度为2
        //创建文件夹
        var nodePathArray = cutOutPath(root,node.path).split('/')
        nodePathArray.pop()
        if(nodePathArray.length === 1){
            mkdirSync(project+"/"+nodePathArray[0])
        }
        if(res.text){
            fs.writeFileSync(project + "/" + cutOutPath(root,node.path), res.text, function (err) {
                if (err) {
                    console.log(node.name + "errr" + err)
                }
            })
        }else{
            fs.writeFileSync(project + "/" + cutOutPath(root,node.path), res.body, 'binary');
        }
    })
}
//todo : 要生成大量空的文件夹 ---- 因为 node.path
// todo : 直接 writeFileSync 会出错，因为没有mkdirSync
/**
 * https://github.com/helloJude/PhoneGuard/tree/master/app
 *  "path": "app/libs",
 * @param {*} root 
 * @param {*} aim 
 */

function cutOutPath(root, aim) {
    var result = urlUtil.parse(root);
    var pathArray = result.pathname.split('/')
    pathArray.shift()

    var aimArray = aim.split('/')
    
    for(i=0; i<4 ; i++){
        pathArray.shift()
    }
    for(i=0;i<pathArray.length-1;i++){
        aimArray.shift()
    }
    return aimArray.join('/')
}