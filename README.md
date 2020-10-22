# Chat Server

카카오톡 HVO 메신저봇을 위한 REST API 서버입니다.

## Description

Google Firebase Functions 서비스를 사용한 Serverless API 서버입니다.

refreshToken을 저장해두어 Google OAuth 인증에 사용합니다. 이후 메신저봇으로부터 Request를 받아 인증된 클라이언트로 유튜브 API를 처리하여 Response를 보내줍니다.

- API
  - `GET` /api/playlistItem : 플레이리스트 아이템을 가져오는 API 입니다.
    - query(random) : 값이 true 이면 플레이리스트 중 랜덤한 값을 가져옵니다.
  - `POST` /api/playlistItem : 플레이리스트에 아이템을 저장하는 API 입니다. 가장 최근 생성된 플레이리스트의 항목 개수가 200개 이상이라면 새로운 플레이리스트를 만들어 그 곳에 저장해줍니다.
    - body(videoId) : videoID 값을 전달하여 해당 비디오를 저장해줍니다.

## Installation

npm 으로 firebase CLI 설치 및 depency 설치

```bash
npm install -g firebase-tools

npm install
```

## Usage

1. Google Client ID와 Secret, Oauth callback url 설정

2. serve 명령어로 로컬 환경 실행, deploy로 프로덕션 환경 배포

```bash
firebase serve --only functions, hosting

firebase deploy
```
