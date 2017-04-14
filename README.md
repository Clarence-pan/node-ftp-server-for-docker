# ES6 string HTML template 

这是一个 docker 专用的 FTP 服务器 - 允许通过 FTP 协议来访问 docker 容器中的文件（即使 docker 容器已经启动了也可以的哟）。基于 linux shell `sh` 和 docker 的 `docker cp`.

It is a ftp server for docker - allow accessing files in docker containers even when container already started. Based on `sh` and `docker cp`.

[![NPM version][npm-image]][npm-url]
![Stability][stability]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![David deps][david-image]][david-url]
[![Known Vulnerabilities][snyk-image]][snyk-url]
[![NPM download][download-image]][download-url]


[npm-image]: https://img.shields.io/npm/v/ftp-server-for-docker.svg?style=flat-square
[npm-url]: https://npmjs.org/package/ftp-server-for-docker
[stability]: https://img.shields.io/badge/stability-stable-brightgreen.svg
[travis-image]: https://img.shields.io/travis/Clarence-pan/node-ftp-server-for-docker.svg?style=flat-square
[travis-url]: https://travis-ci.org/Clarence-pan/node-ftp-server-for-docker
[codecov-image]: https://codecov.io/gh/Clarence-pan/node-ftp-server-for-docker/branch/master/graph/badge.svg
[codecov-url]: https://codecov.io/gh/Clarence-pan/node-ftp-server-for-docker
[david-image]: https://img.shields.io/david/Clarence-pan/node-ftp-server-for-docker.svg?style=flat-square
[david-url]: https://david-dm.org/Clarence-pan/node-ftp-server-for-docker
[snyk-image]: https://snyk.io/test/npm/ftp-server-for-docker/badge.svg?style=flat-square
[snyk-url]: https://snyk.io/test/npm/ftp-server-for-docker
[download-image]: https://img.shields.io/npm/dm/ftp-server-for-docker.svg?style=flat-square
[download-url]: https://npmjs.org/package/ftp-server-for-docker

## 运行依赖 Requirements

- [ ] Node.js  5.x      **Not tested**
- [x] Node.js 6.x       **Tested**
- [ ] Node.js 7.x       **Not tested**

## 安装 Install

```
npm install -g ftp-server-for-docker

```

## 运行 Run the server

### 示例 Example

在 `localhost:21` 上启动 FTP 服务器，并运行 `test` 用户通过密码 `123456` 来访问。

Start the FTP server on `localhost:21` and allow user `test` access by password `123456`

```
$ ftp-server-for-docker -H localhost -p 21 --users test:123456
FtpServer start listening at localhost:21
```

### 示例2 Example2

使用 `ftp-server-for-docker` 来浏览容器 `wordpress` 中的文件: 

User `ftp-server-for-docker` to explore files in container `wordpress`:

![](https://raw.githubusercontent.com/Clarence-pan/node-ftp-server-for-docker/master/screenshots/explore-wordpress.gif)

### 查看命令行帮助 Find CLI help

```
$ ftp-server-for-docker --help
Usage: ftp-server-for-docker [options]

Options:
  --port, -p       Specify which port to listen on(default is 21)       [number]
  --host, -H       Specify which host to bind(default is 0.0.0.0)       [string]
  --annoymous, -a  Whether enable annoymous user                       [boolean]
  --users, -u      Specify users (in form like username:password, can be
                   multiple)                                             [array]
  --config, -c     Specify which configuration file to use
  --debug          Whether enable debug mode                           [boolean]
  -h, --help       Show help                                           [boolean]
  -?, --help       Show help                                           [boolean]

Examples:
  ftp-server-for-docker -h localhost -p 21  Start the FTP Server on
  -u test:123                               localhost:21, allow user `test` to
                                            access.

```

## 已知问题 Known Issues

- windows 下中文目录/文件名会乱码
- 被动模式传输有问题（建议切换到主动模式）
