# TuneMate
A Social Network for Music

![github](https://github.com/tiz314/TuneMate/assets/63679072/0961b6f3-9e63-4040-953b-a2f046f3527f)

TuneMate is an Express.js-based social media to search for songs, add them to personal playlists and share them with other people!

## Live demo

A live demo is available ![here](https://tunemate.tiz314.it)

## How to deploy
It is possible to deploy TuneMate by using the `npm start` command (see `package.json`). 

Alternatively, it is possible to deploy it by using Docker by using the following commands run in the `src` folder:
```
docker build -t tunemate .
docker run -d --name tunemate -p 8080:8080 tunemate --restart always
```
